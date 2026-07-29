# Lunara Financial Transactions Audit

_Last updated: 2026-07-29 (gap remediation pass) · Re-verified line-by-line against source code (previous version dated 2026-06-27 had gone stale)_

---

## 1. Overview

Lunara operates a double-entry ledger to track all money movement across four parties: **customers**, **partners** (laundry shops), **riders**, and the **platform** (Lunara itself). Every peso that enters the system has a corresponding ledger trail that can be reconciled.

**Lunara earns revenue through two mechanisms:**
- **Partner commission** — a percentage of each order's laundry subtotal (not delivery fee), taken at settlement time. Default 20%, per-branch configurable.
- **Recovered rider delivery cost** — since 2026-07-29, the actual rider pickup+delivery cost for each settlement's orders is deducted from the partner's payout and credited to Lunara instead of being paid separately out of `platform_cash` with nothing to show for it. See §3 and gap #4 (now fixed).

Riders are not charged a fee. Lunara pays riders flat per-leg task fees. PayMongo processing costs (3.5% + ₱15/transaction) are now modelled as a real ledger expense — see §3 and gap #3 (now fixed).

---

## 2. Ledger Architecture

### 2.1 Double-Entry Model

File: `apps/api/src/modules/ledger/schemas/ledger-entry.schema.ts`
Service: `apps/api/src/modules/ledger/ledger.service.ts`

Each financial event creates at least two `LedgerEntry` records that balance: total debits = total credits. Entries are grouped by `transactionRef`. The service validates balance before writing — an unbalanced transaction throws `BadRequestException`. A `LedgerTransactionMarker` row (unique index on `transactionRef`) is inserted first so concurrent posts of the same ref race on the unique index rather than a check-then-act read — closing the double-post window.

| Field | Description |
|---|---|
| `transactionRef` | Groups a transaction's entries. Idempotent — posting the same ref twice is a no-op. |
| `accountType` | Which account this entry touches (see §2.2) |
| `accountSubject` | Entity ID (partnerId, riderUserId, userId) or empty for platform-wide accounts |
| `direction` | `debit` or `credit` |
| `amount` | Non-negative. Direction determines sign. |
| `sourceType` | `settlement`, `settlement_clawback`, `remittance`, `withdrawal`, `rider_earning`, `payment`, `refund`, `wallet_topup`, `chargeback` |
| `sourceId` | Reference to the originating record (`_id`) |

### 2.2 Account Types

12 accounts exist in code (`LEDGER_ACCOUNT_TYPES`):

| Account | Subject | Balance Formula | What it Represents |
|---|---|---|---|
| `order_revenue_clearing` | — | Credits − Debits | Holding account for order revenue from payment until settlement. Should trend toward zero. |
| `platform_revenue` | — | Credits − Debits | Lunara's earned commission **plus recovered rider delivery cost** (since 2026-07-29). Posted at settlement, reversed (partially) on a post-settlement refund/chargeback clawback. Pure P&L. |
| `platform_cash` | — | Credits − Debits | Actual cash received: PayMongo payments **net of processing fee** (since 2026-07-29), verified rider remittances, wallet topups. Also credited on a post-settlement chargeback clawback (real cash pulled back). |
| `partner_payable` | partnerId | Credits − Debits | **Legacy account.** No longer credited by current settlement code (which posts `cash_out` instead) — retained for historical records only. |
| `rider_payable` | riderUserId | Credits − Debits | What Lunara owes a rider for completed tasks. Grows per task earned, shrinks on withdrawal approval. |
| `rider_remittance_receivable` | riderUserId | Credits − Debits | Cash a rider holds that must be returned to Lunara (net of their task fee). |
| `cash_out` | payout method (`gcash`/`maya`/`bank`) or partner | Credits − Debits | Real cash paid out to riders and partners, **net of rider delivery cost recovered and any outstanding clawback the admin chose to recover** (since 2026-07-29). Accounting-only — no disbursement API. |
| `customer_wallet_liability` | userId | Credits − Debits | What Lunara owes a customer. Must equal `Wallet.balance` for that user. |
| `rider_payout_expense` | — | Debits − Credits | P&L expense for rider task fees and bonus/adjustment earnings. |
| `rider_wage_expense` | — | Debits − Credits | P&L expense for **salaried employee-rider wage payments** specifically — a separate account from `rider_payout_expense`, credited only via `creditManualEarning(type: 'wage')`. |
| `refund_expense` | — | Debits − Credits | P&L expense for goodwill compensation (lost items) and post-settlement **refund** clawback shortfalls. (Chargeback clawbacks credit `platform_cash` instead — see below.) |
| `payment_processing_expense` | — | Debits − Credits | **New (2026-07-29).** PayMongo's processing fee (3.5% + ₱15/transaction), booked on every digital order payment and PayMongo wallet top-up. Fixes gap #3. |

### 2.3 Transaction Reference Formats

| Source Type | Format | Notes |
|---|---|---|
| `payment` | `payment:{paymentId}` | Digital order payment, wallet-funded order payment, and wallet topup all use this. |
| `rider_earning` | `rider-earning:{orderId}:{type}` | Task-completion earnings. |
| `rider_earning` (manual) | `rider-earning:{referenceId}` | Bonus / adjustment / wage. |
| `remittance` (created) | `remittance-created:{remittanceId}` | Cash netted at collection time. |
| `remittance` (topup) | `remittance-topup:{remittanceId}` | Posted only in `full_amount` remittance mode. |
| `remittance` (verified) | `remittance:{remittanceId}` | Admin verification. |
| `withdrawal` | `withdrawal:{withdrawalId}` | Rider payout. |
| `settlement` | `settlement:{settlementId}` | Partner settlement. |
| `settlement_clawback` | `settlement-clawback:{orderId}` | Post-settlement refund reversal. |
| `chargeback` | `chargeback-clawback:{orderId}` | **New (2026-07-29).** Post-settlement chargeback reversal — same mechanics as `settlement_clawback` but credits `platform_cash` instead of `refund_expense`. See §4 Event 13. |
| `chargeback` (not yet settled, or wallet topup) | `chargeback:{paymentId}` | **New (2026-07-29).** |
| `refund` (customer-initiated cancel) | `cancel-refund:{paymentId}` | Distinct format from admin-approved refunds; see Event 10. |
| `refund` (admin-approved) | `refund:{refundId}` | |
| `refund` (lost item) | `lost-item-{ticketId}` | |
| `wallet_topup` (dev-mode only) | `topup-dev-{userId}-{timestamp}` | |

---

## 3. How Lunara Earns Revenue

### From Partners — Commission on Laundry Subtotal

```
normalFee              = order.subtotal × commissionRate         // legacy pricing model
                        = order.subtotal − order.baseSubtotal     // current 'commission'/'shop_markup' model
platformFundedDiscount = order.discountFundedBy === 'partner' ? 0 : max(0, order.discount)
lunaraFee               = max(0, normalFee − platformFundedDiscount)

riderCostRecovered     = Σ actual rider pickup+delivery cost for this settlement's orders
                          (read from the ledger — LedgerService.getRiderCostByOrderId — not estimated;
                          correctly ₱0 for orders an employee rider handled)
clawbackRecoveryApplied = opt-in: outstanding balance from earlier post-settlement refunds/chargebacks
                          on this partner's orders, applied against this settlement (see below)

partnerPayout          = order.total − lunaraFee − riderCostRecovered − clawbackRecoveryApplied
platform_revenue credit = lunaraFee + riderCostRecovered
```

- Default commission rate: **20%**, per-branch override on `Branch.commissionRate`.
- `discountFundedBy` is set at booking time from whichever promotion was applied (`'platform'` for admin promos/signup codes, `'partner'` for a partner's own self-service promo). This determines whether a discount comes out of Lunara's fee or the partner's payout.
- **Fixed 2026-07-29 (was gap #4):** `order.total` includes the full customer-facing `deliveryFee`. Previously this flowed entirely into `partnerPayout` while Lunara paid riders separately out of `platform_cash` with nothing connecting the two — the partner was effectively paid for a delivery leg they didn't run. `createSettlement()` now looks up the *actual* rider cost for that settlement's orders from the ledger and deducts it from `partnerPayout`, crediting it to `platform_revenue` instead. Policy chosen: commission itself still excludes `deliveryFee` (no change to how `lunaraFee` is computed) — the partner funds the delivery cost out of the delivery-fee revenue they already received, and Lunara recovers what it actually pays riders. See the revenue-computation artifact for the breakeven analysis this closed.
- **Fixed 2026-07-29 (was gap #1):** `PartnerSettlement.clawbackTotal` was tracked per refund but never read anywhere — no way to see or recover it. `PartnerOperationsService.getOutstandingClawbackBalance(partnerId)` now sums it across a partner's settlements, surfaced in admin-web before creating a new settlement with an opt-in "recover outstanding clawback" checkbox (`CreateSettlementDto.recoverClawback`). No existing settlement's math is touched — recovery only ever happens on a *new* settlement the admin explicitly opts into.

**Example** (current defaults: 20% commission, ₱70 flat rider cost, no discount, no outstanding clawback):
```
Order total:            ₱1,000  (subtotal ₱850 + delivery ₱150)
Commission:              ₱850 × 20% = ₱170
Rider cost recovered:    ₱70 (actual, from the ledger)
platform_revenue credit: ₱170 + ₱70 = ₱240
Partner payout:          ₱1,000 − ₱170 − ₱70 = ₱760
```

### From Riders — None

Riders pay no platform fee. Lunara pays a **flat per-leg task fee**, admin-configurable, defaulting to ₱35/₱35:

| Task | Default amount | Configured via |
|---|---|---|
| Pickup completed | ₱35 | `PlatformSettings.riderPickupFee` |
| Delivery completed | ₱35 | `PlatformSettings.riderDeliveryFee` |
| Bonus / Adjustment | Admin-specified | — |
| Wage (employee riders only) | Admin-specified | — |

Source of the live values: `SettingsService.getRiderFeeAmounts()`. Fallback constants if settings are somehow unavailable: `packages/utils/src/rider-ops.ts` → `RIDER_PICKUP_PAYOUT = 35`, `RIDER_DELIVERY_PAYOUT = 35`.

**Employee riders are a special case:** riders with `employmentType === 'employee'` get `amount = 0` on task-completion earnings — no `rider_payout_expense`/`rider_payable` posting happens for them at all, and they remit 100% of any cash collected (no netting). Employee compensation instead runs entirely through the separate `rider_wage_expense` account via manual admin wage credits.

**Fixed 2026-07-29 (was gap #7):** rider fee settings are live-configurable, so an old ledger entry's `amount` alone doesn't tell you what rate produced it if the setting has since changed. Both the rider task-fee and settlement commission ledger descriptions now embed the rate/amount actually applied at posting time (e.g. `"...— rate ₱35"`, `"...(rate 20.0%)"`) so the audit trail doesn't require cross-referencing `PlatformSettings`' current value against historical entries.

---

## 4. Complete Transaction Event Map

### Event 1 — Digital Order Payment (PayMongo: GCash, Maya, Card)

File: `apps/api/src/modules/payments/payments.service.ts → markOrderPaid()`

```
transactionRef:  payment:{paymentId}
sourceType:      payment

processingFee =  payment.amount × 3.5% + ₱15   (calculatePaymongoFee(), fixed 2026-07-29 — was gap #3)
netCash       =  payment.amount − processingFee

Dr  platform_cash                    [netCash]
Dr  payment_processing_expense       [processingFee]   ← only if netCash < amount
  Cr  order_revenue_clearing         [payment.amount]
```

Full order revenue is still recognized in `order_revenue_clearing` regardless of the fee — the fee only reduces actual cash received, booked as a real expense rather than silently making `platform_cash` overstate cash on hand.

### Event 2 — Wallet-Funded Order Payment

Same function, same `transactionRef`/`sourceType` — a conditional source account inside one shared code path. **No PayMongo fee** — the fee was already charged once, at wallet top-up time (Event 3):

```
Dr  customer_wallet_liability:[customerId]   [payment.amount]
  Cr  order_revenue_clearing                 [payment.amount]
```

### Event 3 — Customer Wallet Topup (PayMongo)

File: `apps/api/src/modules/payments/payments.service.ts → markWalletTopupPaid()`

```
transactionRef:  payment:{paymentId}
sourceType:      wallet_topup

processingFee =  topup.amount × 3.5% + ₱15   (fixed 2026-07-29 — was gap #3)
netCash       =  topup.amount − processingFee

Dr  platform_cash                         [netCash]
Dr  payment_processing_expense            [processingFee]   ← only if netCash < amount
  Cr  customer_wallet_liability:[userId]  [topup.amount]
```

The customer's wallet is still credited the full amount they topped up — the fee is Lunara's cost, not deducted from what the customer receives.

### Event 3b — Dev-Mode Wallet Topup *(previously undocumented)*

File: `apps/api/src/modules/wallets/wallets.service.ts → topUp()`

**Trigger:** Only fires when `PAYMONGO_SECRET_KEY` is unset (local/dev environments without a payment provider configured).

```
transactionRef:  topup-dev-{userId}-{timestamp}
sourceType:      wallet_topup

Dr  platform_cash                         [amount]
  Cr  customer_wallet_liability:[userId]  [amount]
```

Low real-world risk — inert wherever PayMongo is actually configured — but a genuine ledger-writing path that existed outside the documented list.

### Event 4 — Rider Earns Task Fee (Pickup or Delivery)

File: `apps/api/src/modules/riders/riders.service.ts → creditEarning()`

```
transactionRef:  rider-earning:{orderId}:{type}
sourceType:      rider_earning

Dr  rider_payout_expense              [riderPickupFee or riderDeliveryFee — live from PlatformSettings, default ₱35]
  Cr  rider_payable:[riderUserId]     [same amount]
```

**Employee riders:** function returns early before any ledger call — `amount = 0`, nothing posted. Wage compensation for employees is separate (Event 5, `type: 'wage'`).

Rider's `Rider.walletBalance` is also credited via `creditFromTask()` in `RiderWalletService` (Mongo-only, not a ledger posting itself).

### Event 5 — Rider Manual Bonus / Adjustment / Wage (Admin)

File: `apps/api/src/modules/riders/riders.service.ts → creditManualEarning()`

```
transactionRef:  rider-earning:{referenceId}
sourceType:      rider_earning

Dr  {rider_wage_expense if type='wage', else rider_payout_expense}   [amount]
  Cr  rider_payable:[riderUserId]                                    [amount]
```

`type: 'wage'` is only valid for `employmentType === 'employee'` riders — throws otherwise. This is the **only** way an employee rider's compensation reaches the ledger.

### Event 6 — Cash Collected by Rider at Pickup or Delivery

File: `apps/api/src/modules/riders/rider-wallet.service.ts → netEarningsAgainstCash()`

```
earningOffset  = riderEarningAmount(stage)      // live ₱35/₱35, or ₱0 for employee riders
netRemittance  = max(0, cashAmount − earningOffset)
```

```
transactionRef:  remittance-created:{remittanceId}   ← only if netRemittance > 0
sourceType:      remittance

Dr  rider_remittance_receivable:[riderUserId]  [netRemittance]
  Cr  order_revenue_clearing                   [netRemittance]
```

Rider's `walletBalance` is debited by `earningOffset` immediately (netted against the +`earningOffset` credit from `creditEarning()`). Employee riders: `earningOffset = 0`, so they remit the full cash amount with no netting at all.

### Event 6b — Remittance "Full Amount" Top-up *(previously undocumented)*

File: `apps/api/src/modules/riders/rider-wallet.service.ts → submitRemittance()`

**Trigger:** Rider chooses `mode: 'full_amount'` (remit everything collected, keep the earned fee in wallet) instead of the default `net_of_fee`.

```
transactionRef:  remittance-topup:{remittanceId}
sourceType:      remittance

Dr  rider_remittance_receivable:[riderUserId]  [earningOffset]
  Cr  order_revenue_clearing                   [earningOffset]
```

Tops up the receivable that Event 6 under-booked (since Event 6 only nets the amount, assuming `net_of_fee`), so the full cash amount is properly tracked as owed to the platform.

### Event 7 — Cash Remittance Verified by Admin

File: `apps/api/src/modules/riders/rider-wallet.service.ts → verifyRemittanceBatch()`

For each remittance where the tracked receivable is `> 0`:

```
transactionRef:  remittance:{remittanceId}
sourceType:      remittance

Dr  platform_cash                                  [amountReceived]
  Cr  rider_remittance_receivable:[riderUserId]    [amountReceived]
```

`amountReceived = remittanceMode === 'full_amount' ? cashAmount : netRemittance` — accounts for whichever of Event 6 / Event 6b actually ran.

### Event 8 — Rider Withdrawal Approved

File: `apps/api/src/modules/riders/rider-wallet.service.ts → approveWithdrawal()`

```
transactionRef:  withdrawal:{withdrawalId}
sourceType:      withdrawal

Dr  rider_payable:[riderUserId]      [withdrawal.amount]
  Cr  cash_out:[method]              [withdrawal.amount]     // method = gcash | maya | bank
```

Balance-sufficiency check runs before approval — throws if the rider's withdrawable balance is now insufficient.

### Event 9 — Partner Settlement Created

File: `apps/api/src/modules/partner/partner-operations.service.ts → createSettlement()`

**Selection changed since the previous audit:** no longer a date-range query. Admin passes explicit `orderIds`; they're atomically claimed via `updateMany({_id: {$in: orderIds}, settlementId: {$exists: false}}, {$set: {settlementId}})`, and `periodStart`/`periodEnd` are derived from the claimed orders' own timestamps afterward.

```
totalAmount             = Σ order.total                        (includes delivery fee — see §3)
lunaraFee               = Math.round(Σ computeOrderFee(order))  (accounts for discountFundedBy — see §3)
riderCostRecovered      = Σ LedgerService.getRiderCostByOrderId(orders)   (fixed 2026-07-29 — was gap #4)
clawbackRecoveryApplied = opt-in, capped at remaining payout      (fixed 2026-07-29 — was gap #1)
partnerPayout           = totalAmount − lunaraFee − riderCostRecovered − clawbackRecoveryApplied
```

```
transactionRef:  settlement:{settlementId}
sourceType:      settlement

Dr  order_revenue_clearing               [totalAmount]
  Cr  cash_out                           [partnerPayout]
  Cr  platform_revenue                   [lunaraFee + riderCostRecovered]
```

`clawbackRecoveryApplied` needs no separate ledger line — the offsetting debit was already posted against `cash_out` at the original clawback (Event 9b), so a smaller credit here is what actually completes the recovery; the source settlements' `clawbackRecovered` field is incremented in the same call to keep `getOutstandingClawbackBalance()` accurate.

### Event 9b — Settlement Clawback

File: `apps/api/src/modules/partner/partner-operations.service.ts → recordSettlementClawback()`

**Trigger:** `refunds.service.ts` refunds an order (or `recordChargeback()` charges one back — see Event 13) that was already paid out in a settlement — the partner was already paid and Lunara already recognized commission; both need reversing.

```
feeShare    = min(computeOrderFee(order), refundAmount)
payoutShare = refundAmount − feeShare
```

```
transactionRef:  settlement-clawback:{orderId}
sourceType:      settlement_clawback

Dr  platform_revenue    [feeShare]      ← reverses Lunara's previously-recognized commission
Dr  cash_out            [payoutShare]   ← reverses the payout portion owed back from the partner
  Cr  refund_expense    [feeShare + payoutShare]
```

A genuine **three-line** posting — not the simple two-line pattern most other events in this doc follow. There is no automatic recovery of the actual money from the partner beyond the clawback record itself — **fixed 2026-07-29 (gap #1):** admin can now see the outstanding balance (`getOutstandingClawbackBalance()`) and opt to deduct it from the partner's *next* settlement (Event 9's `clawbackRecoveryApplied`) instead of it sitting invisible forever.

Also increments `PartnerSettlement.clawbackTotal`/`clawbackOrderCount` on the original settlement — these fields existed before 2026-07-29 but were **write-only**: nothing read them. `clawbackRecovered` (new) tracks how much has since been recovered against a later settlement.

### Event 10 — Order Cancelled Before Dispatch (Customer-Initiated)

File: `apps/api/src/modules/orders/orders.service.ts → cancelByCustomer()`

**Corrected:** this does **not** create a `RefundRequest` document or route through `refunds.service.ts` at all — it's a direct inline wallet credit, with its own distinct ref format:

```
transactionRef:  cancel-refund:{paymentId}
sourceType:      refund

Dr  order_revenue_clearing                      [payment.amount]
  Cr  customer_wallet_liability:[customerId]    [payment.amount]
```

Guard: only fires for `PENDING_DISPATCH` orders (no branch assigned yet), and only for `WALLET`- or PayMongo-method paid payments — cash orders cannot be cancelled via this path.

### Event 11 — Refund Request Approved (Admin)

File: `apps/api/src/modules/refunds/refunds.service.ts → executeRefund()`

```
transactionRef:  refund:{refundId}
sourceType:      refund

Dr  order_revenue_clearing                      [approvedAmount]
  Cr  customer_wallet_liability:[customerId]    [approvedAmount]
```

`isRefundablePaymentMethod()` guard — throws for cash payment orders. If the underlying order was already settled, this is where `recordSettlementClawback()` (Event 9b) also fires.

### Event 12 — Lost-Item Compensation (Support Ticket)

File: `apps/api/src/modules/support/support.service.ts`

```
transactionRef:  lost-item-{ticketId}
sourceType:      refund

Dr  refund_expense                             [compensationAmount]
  Cr  customer_wallet_liability:[customerId]  [compensationAmount]
```

One-time only — throws if `compensationCreditedAt` is already set. No prior revenue entry is reversed; this is a direct goodwill expense.

### Event 13 — Chargeback Recorded (Admin) *(new 2026-07-29 — fixes gap #6)*

File: `apps/api/src/modules/refunds/refunds.service.ts → recordChargeback()`

**Trigger:** Admin-recorded — there's no PayMongo webhook wired up for actual chargebacks yet, so an admin enters one after seeing it in the PayMongo dashboard (`POST /admin/payments/:paymentId/chargeback`). Deliberately mirrors the refund flow (per policy decision) but differs in one important way: **no customer wallet credit is issued** (the customer didn't request anything — the card network pulled the money back), and the reversal hits `platform_cash` directly instead of `refund_expense`, since real cash actually left Lunara's account rather than just converting a receivable into a wallet liability.

Guarded: only a `PAID` payment can be charged back, only once (`payment.chargedBackAt` set), and only for `isPaymongoMethod()` payments (cash was never processed by PayMongo, so can't be charged back).

**Order payment, not yet settled:**
```
transactionRef:  chargeback:{paymentId}
sourceType:      chargeback

Dr  order_revenue_clearing      [chargebackAmount]
  Cr  platform_cash             [chargebackAmount]
```

**Order payment, already settled** — reuses Event 9b's clawback mechanism with `kind: 'chargeback'`, crediting `platform_cash` instead of `refund_expense`:
```
transactionRef:  chargeback-clawback:{orderId}
sourceType:      chargeback

Dr  platform_revenue    [feeShare]
Dr  cash_out            [payoutShare]
  Cr  platform_cash     [feeShare + payoutShare]
```

**Wallet top-up chargeback** — reverses the wallet credit granted at top-up time:
```
transactionRef:  chargeback:{paymentId}
sourceType:      chargeback

Dr  customer_wallet_liability:[userId]   [chargebackAmount]
  Cr  platform_cash                      [chargebackAmount]
```
This debits the customer's wallet directly (`WalletsService.debit()`), which throws `BadRequestException` if the customer has since spent below the chargeback amount — a genuine edge case with no clean automatic resolution, left as an admin-facing error rather than silently going negative or writing off the difference.

---

## 5. End-to-End Money Flow Diagram

Digital (GCash/Maya/card) order, for the fee posting to apply — this trace uses digital, not the
cash example threaded through §4's individual events, to show the processing-fee line in context.

```
CUSTOMER pays ₱1,000 via GCash (subtotal ₱850 + delivery ₱150, no discount)
│
├─ [PayMongo payment]
│    processingFee = ₱1,000 × 3.5% + ₱15 = ₱50
│    Dr  platform_cash                 ₱950     ← net of PayMongo's cut
│    Dr  payment_processing_expense    ₱50
│      Cr  order_revenue_clearing      ₱1,000   ← full order value still recognized
│
├─ Order assigned → RIDER dispatched
│
├─ RIDER completes pickup (default ₱35 fee)
│    Dr  rider_payout_expense       ₱35
│      Cr  rider_payable:[rider]    ₱35
│
├─ RIDER completes delivery (default ₱35 fee)
│    Dr  rider_payout_expense       ₱35
│      Cr  rider_payable:[rider]    ₱35
│
├─ ADMIN selects this order + others, creates partner settlement
│    commission          = ₱850 × 20% = ₱170
│    riderCostRecovered  = ₱35 + ₱35 = ₱70   (looked up from the ledger, not estimated)
│    partnerPayout       = ₱1,000 − ₱170 − ₱70 = ₱760
│    Dr  order_revenue_clearing     ₱1,000
│      Cr  cash_out                 ₱760     ← partner (manual transfer)
│      Cr  platform_revenue         ₱240     ← ₱170 commission + ₱70 rider cost recovered
│
├─ RIDER requests withdrawal of ₱70 (₱35 pickup + ₱35 delivery earned)
│    Dr  rider_payable:[rider]      ₱70
│      Cr  cash_out:gcash           ₱70     ← rider receives ₱70 via GCash
│
└─ RESULT
     Lunara earns:      ₱240  (platform_revenue — commission + recovered rider cost)
     Lunara spent:      ₱70   (rider_payout_expense — task fees) + ₱50 (processing fee)
     Partner payout:    ₱760  (cash_out)
     Rider payout:      ₱70   (cash_out:gcash)
     True net to Lunara on this order: ₱240 − ₱70 − ₱50 = ₱120
     (before 2026-07-29's fix, this order would have shown Lunara earning only ₱170 while
      separately spending ₱70 on rider pay with nothing recovering it — a ₱70 gap now closed;
      see the revenue-computation artifact for the historical breakeven analysis this replaces)
```

---

## 6. Revenue Reconciliation

Use `GET /admin/ledger/trial-balance` to reconcile. Expected balances on a healthy system:

| Account | Expected State |
|---|---|
| `platform_revenue` | Cumulative `PartnerSettlement.lunaraFee + riderCostRecovered`, minus clawback/chargeback `feeShare` reversals |
| `platform_cash` | PayMongo received (net of processing fee) + verified remittances + wallet topups (net of processing fee), minus any chargeback clawbacks |
| `order_revenue_clearing` | Near zero — oscillates as orders are paid and settled |
| `cash_out` | Total paid to partners (net of recovered rider cost and any recovered clawback) and riders (all methods) |
| `rider_payable:[id]` | Rider's task earnings minus paid withdrawals |
| `rider_remittance_receivable:[id]` | Cash the rider holds but hasn't had verified yet |
| `customer_wallet_liability:[id]` | Must equal `Wallet.balance` for that customer |
| `rider_payout_expense` | Total task fees + bonuses (non-employee) |
| `rider_wage_expense` | Total employee wage payments |
| `refund_expense` | Goodwill compensation + post-settlement **refund** clawback shortfalls (chargeback clawbacks hit `platform_cash` instead — see Event 13) |
| `payment_processing_expense` | Total PayMongo fees across digital payments and top-ups |
| `partner_payable` | Should be near-zero (legacy, unused by current settlement code) |

**Spot check:** `platform_revenue` net credit = Σ (`lunaraFee` + `riderCostRecovered`) on paid settlements − Σ `feeShare` on clawbacks/chargebacks.
**Spot check:** `customer_wallet_liability:[userId]` net credit = `Wallet.balance` for that user.
**Spot check:** `getOutstandingClawbackBalance(partnerId)` = Σ (`clawbackTotal − clawbackRecovered`) across that partner's settlements — should trend toward zero as admins opt to recover it on new settlements.

---

## 7. Known Gaps & Limitations

| # | Gap | Impact | Severity | Status |
|---|---|---|---|---|
| 1 | **No automatic settlement reversal on refund** | `recordSettlementClawback()` books the accounting reversal correctly (Event 9b), but recovering the actual cash from a partner who was already paid was invisible — `clawbackTotal` was tracked but never read. | High | **Fixed 2026-07-29** — `getOutstandingClawbackBalance()` + opt-in `recoverClawback` on `createSettlement()`. Actually collecting the wire transfer back from the partner (if the recovery exceeds what a future settlement can absorb) is still a manual step. |
| 2 | **No actual fund transfer** | `cash_out` is accounting-only. Bank/GCash transfers happen manually outside the system. | — | By design |
| 3 | **PayMongo fees not modelled** | ~2–3.5% processing fees weren't deducted from `platform_cash`. Effective margin was overstated. | Medium | **Fixed 2026-07-29** — `payment_processing_expense` account, 3.5% + ₱15/transaction, posted on every digital order payment and PayMongo wallet top-up (Events 1 & 3). |
| 4 | **Delivery fee flowed entirely to the partner, not Lunara** | `computeOrderFee()` never subtracted `deliveryFee` from `partnerPayout`; the whole delivery fee the customer paid went to the partner while riders were paid separately from `platform_cash`, unconnected to that fee. | High | **Fixed 2026-07-29** — actual rider cost per settlement is now looked up from the ledger and deducted from `partnerPayout`, credited to `platform_revenue` (Event 9). See revenue-computation artifact for the historical breakeven table this replaces. |
| 5 | **Legacy orders have no `discountFundedBy`** | Orders created before this field existed default to `'platform'` behavior at settlement (Lunara absorbs the discount) — the safer assumption, but a break in consistency when reconciling historical numbers against new ones. | Low | Open, by design |
| 6 | **No chargeback handling** | PayMongo chargebacks had no ledger reversals. `platform_cash` would overstate cash received. | Low | **Fixed 2026-07-29** — `RefundsService.recordChargeback()`, admin-triggered (no PayMongo webhook integration yet), mirrors the refund/clawback flow but credits `platform_cash` instead of `refund_expense` (Event 13). |
| 7 | **Rider fee amounts are live, not fixed** | Any admin change to `PlatformSettings.riderPickupFee`/`riderDeliveryFee` retroactively changes what's shown as "the" rider fee — historical ledger entries use whatever rate was in effect at posting time (correct), but nothing made that rate legible without cross-referencing settings history. | Low | **Fixed 2026-07-29** — ledger descriptions now embed the rate/amount actually applied at posting time. |
| 8 | **Chargebacks require manual admin entry** | No PayMongo webhook integration exists for chargeback events — an admin has to notice one in the PayMongo dashboard and record it via `POST /admin/payments/:paymentId/chargeback`. | Low | Open, by design for this pass |

Previously listed gaps (dev-mode wallet topup bypassed ledger, rider wallet backfill bypassed ledger, `getLedgerBalance()` reading stale `partner_payable`) from the 2026-06-27 version remain **Fixed** — no evidence of regression found in this pass.

---

## 8. Key File Reference

| Area | File |
|---|---|
| Ledger schema (12 account types) | `apps/api/src/modules/ledger/schemas/ledger-entry.schema.ts` |
| Ledger posting service, `getRiderCostByOrderId()` | `apps/api/src/modules/ledger/ledger.service.ts` |
| Partner settlements, commission, rider-cost recovery, clawback | `apps/api/src/modules/partner/partner-operations.service.ts` |
| Outstanding clawback balance, `PartnerSettlement` clawback/riderCost fields | `apps/api/src/modules/partner/schemas/partner-settlement.schema.ts` |
| Rider earnings (task fee, bonus, wage) | `apps/api/src/modules/riders/riders.service.ts` |
| Rider withdrawals, remittance, netting | `apps/api/src/modules/riders/rider-wallet.service.ts` |
| Rider earning fallback constants | `packages/utils/src/rider-ops.ts` |
| Live rider fee settings | `apps/api/src/modules/settings/settings.service.ts` → `getRiderFeeAmounts()` |
| Payment processing (PayMongo), processing fee | `apps/api/src/modules/payments/payments.service.ts`, `packages/utils/src/payment.ts` → `calculatePaymongoFee()` |
| Customer wallet, dev-mode topup | `apps/api/src/modules/wallets/wallets.service.ts` |
| Refund processing, chargeback recording | `apps/api/src/modules/refunds/refunds.service.ts` |
| Order cancellation | `apps/api/src/modules/orders/orders.service.ts` |
| Lost-item compensation | `apps/api/src/modules/support/support.service.ts` |
| Delivery-fee formula, promotions funding | `docs/delivery-pricing-and-approval.md`, `docs/platform-commission.md` |
| Full per-order money-flow analysis + breakeven (superseded by gap #4 fix) | Revenue-computation artifact (published separately) |
| Settlement schema | `apps/api/src/modules/partner/schemas/partner-settlement.schema.ts` |
| Rider wallet / withdrawal schema | `apps/api/src/modules/riders/schemas/rider-wallet.schema.ts` |
| Customer wallet schema | `apps/api/src/modules/wallets/schemas/wallet.schema.ts` |
