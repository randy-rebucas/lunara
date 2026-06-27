# Lunara Financial Transactions Audit

_Last updated: 2026-06-27 · Verified against source code_

---

## 1. Overview

Lunara operates a double-entry ledger to track all money movement across four parties: **customers**, **partners** (laundry shops), **riders**, and the **platform** (Lunara itself). Every peso that enters the system has a corresponding ledger trail that can be reconciled.

**Lunara earns revenue through one primary mechanism:**
- **Partner commission** — 20% of each order's laundry subtotal (not including delivery fee), taken at settlement time.

Riders are not charged a fee. Lunara absorbs PayMongo payment processing costs.

---

## 2. Ledger Architecture

### 2.1 Double-Entry Model

File: `apps/api/src/modules/ledger/schemas/ledger-entry.schema.ts`
Service: `apps/api/src/modules/ledger/ledger.service.ts`

Each financial event creates at least two `LedgerEntry` records that balance: total debits = total credits. Entries are grouped by `transactionRef`. The service validates balance before writing — an unbalanced transaction throws `BadRequestException`.

| Field | Description |
|---|---|
| `transactionRef` | Groups a transaction's entries. Idempotent — posting the same ref twice is a no-op (silent return, no error). |
| `accountType` | Which account this entry touches (see section 2.2) |
| `accountSubject` | Entity ID (partnerId, riderUserId, userId) or empty for platform-wide accounts |
| `direction` | `debit` or `credit` |
| `amount` | Non-negative. Direction determines sign. |
| `sourceType` | What triggered the entry: `settlement`, `remittance`, `withdrawal`, `rider_earning`, `payment`, `refund`, `wallet_topup` |
| `sourceId` | Reference to the originating record (`_id`) |

### 2.2 Account Types

| Account | Subject | Balance Formula | What it Represents |
|---|---|---|---|
| `order_revenue_clearing` | — | Credits − Debits | Holding account for order revenue from payment until settlement. Should trend toward zero. Grows when orders are paid or cash collected; shrinks when settled or refunded. |
| `platform_revenue` | — | Credits − Debits | Lunara's earned commission. Posted once per settlement. Pure P&L. |
| `platform_cash` | — | Credits − Debits | Actual cash received by Lunara: PayMongo payments, verified rider remittances, wallet topups. |
| `partner_payable` | partnerId | Credits − Debits | **Legacy account only.** Historical records from before the settlement ledger fix (pre-2026-06-27). No longer credited during settlement. `getLedgerBalance()` still reads this account — it will be near-zero on a corrected system. |
| `rider_payable` | riderUserId | Credits − Debits | What Lunara owes a rider for completed tasks. Grows with each task earned, shrinks when withdrawal is approved. |
| `rider_remittance_receivable` | riderUserId | Credits − Debits | Cash a rider holds that must be returned to Lunara (net of their task fee). Grows when cash is collected, cleared when admin verifies remittance. |
| `cash_out` | payout method (`gcash`, `maya`, `bank`) or partner | Credits − Debits | Real cash paid out to riders and partners via `approveWithdrawal` and `createSettlement`. |
| `customer_wallet_liability` | userId | Credits − Debits | What Lunara owes a customer (their wallet balance). Should equal `Wallet.balance` for each user. |
| `rider_payout_expense` | — | Debits − Credits | P&L expense for rider task fees and bonuses. Paired with `rider_payable` credit. |
| `refund_expense` | — | Debits − Credits | P&L expense for goodwill compensation (lost items) not reversing prior revenue. |

### 2.3 Transaction Reference Formats

All `transactionRef` values follow a consistent pattern and enforce idempotency:

| Source Type | Format | Example |
|---|---|---|
| `payment` | `payment:{paymentId}` | `payment:507f1f77bcf86cd799439011` |
| `wallet_topup` | `payment:{paymentId}` | `payment:507f1f77bcf86cd799439012` |
| `rider_earning` | `rider-earning:{orderId}:{type}` | `rider-earning:...abc:pickup` |
| `rider_earning` (manual) | `rider-earning:{referenceId}` | `rider-earning:...xyz` |
| `remittance` (created) | `remittance-created:{remittanceId}` | `remittance-created:...abc` |
| `remittance` (verified) | `remittance:{remittanceId}` | `remittance:...abc` |
| `withdrawal` | `withdrawal:{withdrawalId}` | `withdrawal:...abc` |
| `settlement` | `settlement:{settlementId}` | `settlement:...abc` |
| `refund` | `refund:{refundId}` | `refund:...abc` |
| `lost-item` | `lost-item-{ticketId}` | `lost-item-...abc` |

---

## 3. How Lunara Earns Revenue

### From Partners — Commission on Laundry Subtotal

Lunara takes **20% of the order subtotal** (excluding delivery fee) at settlement time.

**Formula:**
```
lunaraFee    = Math.round( sum(order.subtotal × commissionRate) for all orders in period )
partnerPayout = totalAmount − lunaraFee
totalAmount  = sum(order.total)   ← includes delivery fee
```

- Default commission rate: **20%** (`0.20`), read from `Branch.commissionRate ?? 0.20`
- Per-branch override available in `Branch.commissionRate`
- Rate snapshot stored on `PartnerSettlement.commissionRate` — the per-order breakdown always uses the rate at time of settlement, not the current branch rate

**Example:**
```
Order total:     ₱1,000
  Subtotal:      ₱900  (laundry)
  Delivery fee:  ₱100

Commission:      ₱900 × 20% = ₱180  → Lunara (platform_revenue)
Partner payout:  ₱1,000 − ₱180 = ₱820
```

### From Riders — None

Riders pay no platform fee. Lunara pays riders a **fixed task fee** per completed task:

| Task | Amount |
|---|---|
| Pickup completed | ₱80 |
| Delivery completed | ₱120 |
| Bonus / Adjustment | Admin-specified |

Source: `packages/utils/src/rider-ops.ts` — `RIDER_PICKUP_PAYOUT = 80`, `RIDER_DELIVERY_PAYOUT = 120`

These are operating expenses recorded in `rider_payout_expense`.

---

## 4. Complete Transaction Event Map

### Event 1 — Digital Order Payment (PayMongo: GCash, Maya, Card)

File: `apps/api/src/modules/payments/payments.service.ts → markOrderPaid()`

**Trigger:** Customer completes PayMongo checkout for an order.

```
transactionRef:  payment:{paymentId}
sourceType:      payment

Dr  platform_cash                [order.total]
  Cr  order_revenue_clearing     [order.total]
```

Cash received → held in clearing until settled to partner.

---

### Event 2 — Wallet-Funded Order Payment

File: `apps/api/src/modules/payments/payments.service.ts → markOrderPaid()`

**Trigger:** Customer pays for an order using their Lunara wallet balance (`PaymentMethod.WALLET`).

```
transactionRef:  payment:{paymentId}
sourceType:      payment

Dr  customer_wallet_liability:[customerId]   [order.total]
  Cr  order_revenue_clearing                 [order.total]
```

No new cash to platform (already received at wallet topup time). Customer's wallet liability decreases; order enters clearing.

---

### Event 3 — Customer Wallet Topup (PayMongo)

File: `apps/api/src/modules/payments/payments.service.ts → markWalletTopupPaid()`

**Trigger:** Customer tops up their Lunara wallet via PayMongo.

```
transactionRef:  payment:{paymentId}
sourceType:      wallet_topup

Dr  platform_cash                         [topup.amount]
  Cr  customer_wallet_liability:[userId]  [topup.amount]
```

Cash received by Lunara. Platform now owes customer that balance.

---

### Event 4 — Rider Earns Task Fee (Pickup or Delivery)

File: `apps/api/src/modules/riders/riders.service.ts → creditEarning()`

**Trigger:** Rider completes a pickup collection or delivery confirmation.

```
transactionRef:  rider-earning:{orderId}:{type}
sourceType:      rider_earning

Dr  rider_payout_expense              [80 or 120 PHP]
  Cr  rider_payable:[riderUserId]     [80 or 120 PHP]
```

Operating expense for Lunara. Rider's payable balance grows by the fixed task fee.
Rider's `Rider.walletBalance` is also credited via `creditFromTask()` in `RiderWalletService`.

---

### Event 5 — Rider Manual Bonus / Adjustment (Admin)

File: `apps/api/src/modules/riders/riders.service.ts → creditManualEarning()`

**Trigger:** Admin credits a rider with a bonus or adjustment.

```
transactionRef:  rider-earning:{referenceId}
sourceType:      rider_earning

Dr  rider_payout_expense               [amount]
  Cr  rider_payable:[riderUserId]      [amount]
```

Amount is admin-specified. Negative amounts (adjustments) are allowed by the schema.

---

### Event 6 — Cash Collected by Rider at Pickup or Delivery

File: `apps/api/src/modules/riders/rider-wallet.service.ts → netEarningsAgainstCash()`

**Trigger:** Rider marks cash payment as collected from the customer at pickup or delivery.

```
earningOffset  = riderEarningAmount(stage)          // ₱80 (pickup) or ₱120 (delivery)
netRemittance  = max(0, cashAmount − earningOffset)
```

```
transactionRef:  remittance-created:{remittanceId}   ← only posted if netRemittance > 0
sourceType:      remittance

Dr  rider_remittance_receivable:[riderUserId]  [netRemittance]
  Cr  order_revenue_clearing                   [netRemittance]
```

The rider's task fee is netted against the cash they owe. Rider's `walletBalance` is debited by `earningOffset` immediately (before `creditEarning()` runs, which later re-credits it). A `RiderCashRemittance` record is created with status `pending`.

**If `cashAmount ≤ earningOffset` (small order):** No ledger entry is posted. `netRemittance = 0`. Rider still owes nothing beyond what their earning already covers.

**Example (pickup, ₱1,000 cash order):**
```
Cash collected:   ₱1,000
Earning offset:   ₱80  (pickup)
Net remittance:   ₱920  (rider must remit ₱920 to platform)
Rider wallet:     −₱80  (immediate debit; creditEarning later adds back +₱80)
```

---

### Event 7 — Cash Remittance Verified by Admin

File: `apps/api/src/modules/riders/rider-wallet.service.ts → verifyRemittanceBatch()`

**Trigger:** Admin verifies a submitted cash remittance batch. Accepts `pending` or `submitted` remittances.

For each remittance where `netRemittance > 0`:

```
transactionRef:  remittance:{remittanceId}
sourceType:      remittance

Dr  platform_cash                                  [netRemittance]
  Cr  rider_remittance_receivable:[riderUserId]    [netRemittance]
```

Cash is now physically in Lunara's hands. Rider's receivable liability is cleared. Remittance status becomes `remitted`.

---

### Event 8 — Rider Withdrawal Approved

File: `apps/api/src/modules/riders/rider-wallet.service.ts → approveWithdrawal()`

**Trigger:** Admin approves a rider's pending withdrawal request.

```
transactionRef:  withdrawal:{withdrawalId}
sourceType:      withdrawal

Dr  rider_payable:[riderUserId]      [withdrawal.amount]
  Cr  cash_out:[method]               [withdrawal.amount]
```

Where `method` = `gcash`, `maya`, or `bank`.

Rider's payable balance is debited. Cash-out is credited. Rider's `walletBalance` is also debited in the same operation. A balance sufficiency check runs before approval — throws `BadRequestException` if rider's withdrawable balance is now insufficient.

---

### Event 9 — Partner Settlement Created

File: `apps/api/src/modules/partner/partner-operations.service.ts → createSettlement()`

**Trigger:** Admin creates a settlement for a partner covering a date range.

**Process:**
1. Find all completed orders in the period for partner's branch (`status: { $in: COMPLETED_STATUSES }`, `updatedAt` between `periodStart` and `periodEnd`)
2. `totalAmount = sum(order.total)` — includes laundry subtotal + delivery fee
3. `lunaraFee = Math.round( sum(order.subtotal ?? order.total) × commissionRate )`
4. `partnerPayout = totalAmount − lunaraFee`
5. Create `PartnerSettlement` with status `paid` immediately (no pending state)

```
transactionRef:  settlement:{settlementId}
sourceType:      settlement

Dr  order_revenue_clearing               [totalAmount]
  Cr  cash_out                           [partnerPayout]
  Cr  platform_revenue                   [lunaraFee]
```

- `order_revenue_clearing` is cleared for all settled orders
- `cash_out` records the payout to the partner (actual bank transfer happens manually)
- `platform_revenue` records Lunara's commission earned

---

### Event 10 — Order Cancelled Before Dispatch (Auto-Refund)

File: `apps/api/src/modules/orders/orders.service.ts → cancelByCustomer()`

**Trigger:** Customer cancels a `PENDING_DISPATCH` order with a paid PayMongo or wallet payment.

```
transactionRef:  refund:{refundId}
sourceType:      refund

Dr  order_revenue_clearing                      [paidAmount]
  Cr  customer_wallet_liability:[customerId]    [paidAmount]
```

Revenue in clearing is reversed. Refund credited to customer's wallet. `Wallet.balance += paidAmount`. Cash orders cannot be cancelled via this path.

---

### Event 11 — Refund Request Approved (Admin)

File: `apps/api/src/modules/refunds/refunds.service.ts → executeRefund()`

**Trigger:** Admin processes an approved refund request.

```
transactionRef:  refund:{refundId}
sourceType:      refund

Dr  order_revenue_clearing                      [approvedAmount]
  Cr  customer_wallet_liability:[customerId]    [approvedAmount]
```

Amount may be partial (admin-specified as `approvedAmount`). Customer wallet balance increases. Payment status is updated to `REFUNDED`. Cannot be applied to cash payment orders — `isRefundablePaymentMethod()` guard prevents it.

---

### Event 12 — Lost-Item Compensation (Support Ticket)

File: `apps/api/src/modules/support/support.service.ts`

**Trigger:** Admin compensates a customer for a lost item via a support investigation ticket (`InvestigateAction.COMPENSATE`). Outcome must be set to `COMPENSATED` first. One-time only — throws if `compensationCreditedAt` is already set.

```
transactionRef:  lost-item-{ticketId}
sourceType:      refund

Dr  refund_expense                             [compensationAmount]
  Cr  customer_wallet_liability:[customerId]  [compensationAmount]
```

This is a goodwill payment — no prior revenue entry is reversed. Recorded as a direct `refund_expense`. Customer wallet balance increases.

---

## 5. End-to-End Money Flow Diagram

```
CUSTOMER pays ₱1,000 (subtotal ₱900 + delivery ₱100)
│
├─ [PayMongo payment]
│    Dr  platform_cash              ₱1,000
│      Cr  order_revenue_clearing   ₱1,000
│
├─ Order assigned → RIDER dispatched
│
├─ RIDER completes pickup
│    Dr  rider_payout_expense       ₱80          ← task fee earned
│      Cr  rider_payable:[rider]    ₱80
│
│   [Cash order: rider collects ₱1,000 at pickup]
│    earningOffset = ₱80
│    netRemittance = ₱1,000 − ₱80 = ₱920
│    Dr  rider_remittance_receivable:[rider]  ₱920
│      Cr  order_revenue_clearing             ₱920
│    Rider.walletBalance −= ₱80 (netting, then +₱80 from creditEarning = net 0)
│
├─ RIDER completes delivery
│    Dr  rider_payout_expense       ₱120
│      Cr  rider_payable:[rider]    ₱120
│
│   [If delivery-timing cash: similar netting for delivery earning]
│
├─ RIDER submits remittance
│    Status: pending → submitted  (no ledger change)
│
├─ ADMIN verifies remittance
│    Dr  platform_cash                          ₱920
│      Cr  rider_remittance_receivable:[rider]  ₱920
│
├─ ADMIN creates partner settlement
│    commission = ₱900 × 20% = ₱180
│    payout     = ₱1,000 − ₱180 = ₱820
│    Dr  order_revenue_clearing     ₱1,000
│      Cr  cash_out                 ₱820     ← partner receives ₱820 (manual transfer)
│      Cr  platform_revenue         ₱180     ← Lunara earns ₱180
│
├─ RIDER requests withdrawal of ₱200 (₱80 pickup + ₱120 delivery earned)
│    Dr  rider_payable:[rider]      ₱200
│      Cr  cash_out:gcash           ₱200     ← rider receives ₱200 via GCash
│
└─ RESULT
     Lunara earns:    ₱180  (platform_revenue — commission)
     Lunara spent:    ₱200  (rider_payout_expense — task fees)
     Partner payout:  ₱820  (cash_out)
     Rider payout:    ₱200  (cash_out:gcash)
     Net to Lunara:   ₱180 − ₱200 = −₱20 on this single order
                      (profitable at scale as commission >> rider costs per order volume)
```

---

## 6. Revenue Reconciliation

Use `GET /admin/ledger/trial-balance` to reconcile. Expected balances on a healthy system:

| Account | Expected State |
|---|---|
| `platform_revenue` | Cumulative sum of all `PartnerSettlement.lunaraFee` across all paid settlements |
| `platform_cash` | PayMongo received + verified remittances + wallet topups (total cash in) |
| `order_revenue_clearing` | Near zero — should oscillate around 0 as orders are paid and settled |
| `cash_out` | Total paid out to partners and riders (all methods combined) |
| `rider_payable:[id]` | Rider's `totalEarnings` minus paid withdrawals |
| `rider_remittance_receivable:[id]` | Cash the rider holds but hasn't had verified yet |
| `customer_wallet_liability:[id]` | Must equal `Wallet.balance` for that customer |
| `rider_payout_expense` | Total rider task fees + bonuses (operating cost) |
| `refund_expense` | Total goodwill compensation paid (lost items) |
| `partner_payable` | Should be near-zero after migration (historical only) |

**Spot check:** `platform_revenue` net credit = sum of `lunaraFee` on all `PartnerSettlement` records.

**Spot check:** `customer_wallet_liability:[userId]` net credit = `Wallet.balance` for that user. If these diverge, a wallet credit or debit was posted without the corresponding ledger entry.

---

## 7. Known Gaps & Limitations

| # | Gap | Impact | Severity | Status |
|---|---|---|---|---|
| 1 | **No settlement reversal** | If an order is refunded after settlement, `order_revenue_clearing` goes negative and `platform_revenue` is not reversed. The ledger overstates Lunara's revenue. | High | Open — operational gap. Requires manual corrective ledger entries. |
| 2 | **No actual fund transfer** | `cash_out` is accounting-only. The actual bank/GCash transfer to partners and riders happens manually outside the system. | — | By design — no escrow/disbursement API integrated. |
| 3 | **PayMongo fees not modelled** | PayMongo charges ~2–3.5% processing fees. These are not deducted from `platform_cash`. Lunara's effective margin is lower than `platform_revenue` alone shows. | Medium | Open — no fee rate config available. |
| 4 | **Dev-mode wallet topup bypassed ledger** | `WalletsService.topUp()` credited wallet but posted no ledger entry for `platform_cash` / `customer_wallet_liability`. | Low | **Fixed** — `LedgerModule` added to `WalletsModule`, `LedgerService` injected, ledger post added to `topUp()`. |
| 5 | **Rider wallet backfill bypassed ledger** | `maybeBackfillWallet()` created a wallet transaction but posted no ledger entry, leaving `rider_payable` understated. | Low | **Fixed** — ledger post (`rider_payout_expense` debit / `rider_payable` credit) added with `.catch(() => {})` to not break wallet reads. |
| 6 | **No chargeback handling** | PayMongo chargebacks have no ledger reversals. `platform_cash` would overstate cash received. | Low | Open — manual process required. |
| 7 | **`getLedgerBalance()` read stale `partner_payable` account** | New settlements credit `cash_out`, not `partner_payable`. Outstanding balance shown on partner-web was effectively always 0 post-migration. | Medium | **Fixed** — `getLedgerBalance()` now computes from `PartnerSettlement` records with `status = 'pending'`. |

---

## 8. Key File Reference

| Area | File |
|---|---|
| Ledger schema | `apps/api/src/modules/ledger/schemas/ledger-entry.schema.ts` |
| Ledger posting service | `apps/api/src/modules/ledger/ledger.service.ts` |
| Partner settlements & commission | `apps/api/src/modules/partner/partner-operations.service.ts` |
| Rider earnings | `apps/api/src/modules/riders/riders.service.ts` |
| Rider withdrawals & remittance | `apps/api/src/modules/riders/rider-wallet.service.ts` |
| Rider earning amounts (constants) | `packages/utils/src/rider-ops.ts` |
| Payment processing (PayMongo) | `apps/api/src/modules/payments/payments.service.ts` |
| Customer wallet | `apps/api/src/modules/wallets/wallets.service.ts` |
| Refund processing | `apps/api/src/modules/refunds/refunds.service.ts` |
| Order cancellation | `apps/api/src/modules/orders/orders.service.ts` |
| Lost-item compensation | `apps/api/src/modules/support/support.service.ts` |
| Settlement schema | `apps/api/src/modules/partner/schemas/partner-settlement.schema.ts` |
| Rider wallet / withdrawal schema | `apps/api/src/modules/riders/schemas/rider-wallet.schema.ts` |
| Customer wallet schema | `apps/api/src/modules/wallets/schemas/wallet.schema.ts` |
| Financial types | `packages/types/src/partner.ts` |
