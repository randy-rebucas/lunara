# Sample Transaction Walkthrough

A single order followed end-to-end — booking, payment, rider fulfillment,
partner settlement, and (optionally) refund — with concrete numbers and the
actual ledger postings each step produces. Cross-references:
[revenue-computation.md](revenue-computation.md) for how revenue is summed,
[platform-commission.md](platform-commission.md) for the commission math,
and [`LEDGER.md`](../apps/api/src/modules/ledger/LEDGER.md) for account
definitions.

## Scenario

- Customer books a standard wash-and-fold order, pays by **GCash via
  PayMongo**.
- Branch commission rate: **20%**, using the `shop_markup` pricing model
  (30% markup baked into price at booking — see platform-commission.md).
- Rider is an independent contractor paid a flat pickup + delivery fee.
- Partner is later paid out in a batch settlement.

| Field | Value |
|---|---|
| `basePrice` (partner's shop price) | ₱308 |
| `subtotal` (`basePrice × 1.30`) | ₱400 |
| `baseSubtotal` | ₱308 |
| `deliveryFee` | ₱50 |
| `discount` | ₱0 |
| **`total`** (`subtotal − discount + deliveryFee`) | **₱450** |
| `lunaraFee` (`subtotal − baseSubtotal`) | ₱92 |
| Rider pickup fee | ₱30 |
| Rider delivery fee | ₱30 |

---

## Step 1 — Order created

Order document created with `status: PENDING`, the fields above set,
`pricingModel: 'shop_markup'`. No ledger entries yet — nothing has been
paid.

## Step 2 — Customer pays (PayMongo, GCash)

PayMongo webhook confirms payment. `payments.service.ts:markOrderPaid` posts:

```
transactionRef: order:<orderId>:payment
Dr platform_cash              450
Cr order_revenue_clearing     450
```

Real cash of ₱450 has landed in Lunara's PayMongo balance. The full ₱450 —
not just Lunara's cut — sits in `order_revenue_clearing` until the partner
is settled. This is why `order_revenue_clearing` is described as "revenue
recognized but not yet settled": at this point the ledger can't yet say how
much of the ₱450 is Lunara's vs. the partner's — that split only happens at
settlement (Step 5).

*(If this had been a cash-on-delivery order instead, this step doesn't
happen here — see the cash variant below.)*

## Step 3 — Rider fulfills the order

Rider picks up, partner processes the laundry, rider delivers. On
`orders.service.ts` status transitions, `riders.service.ts:creditEarning`
posts twice (once per leg):

```
transactionRef: rider:<riderId>:earning:<orderId>:pickup
Dr rider_payout_expense       30
Cr rider_payable               30

transactionRef: rider:<riderId>:earning:<orderId>:delivery
Dr rider_payout_expense       30
Cr rider_payable               30
```

Rider's `rider_payable` balance is now ₱60 — money Lunara owes the rider,
independent of whether the order itself has settled with the partner.
Order reaches `status: DELIVERED` → now counted in `COMPLETED` for revenue
purposes (see revenue-computation.md).

## Step 4 — Rider withdraws earnings (independent of this order)

Whenever the rider requests a payout, `rider-wallet.service.ts:approveWithdrawal`
posts against their accumulated `rider_payable` balance (not scoped to a
single order):

```
transactionRef: rider:<riderId>:withdrawal:<withdrawalId>
Dr rider_payable               <withdrawal amount>
Cr cash_out                    <withdrawal amount>
```

## Step 5 — Admin creates a partner settlement

At month-end, admin batches this order (with others from the same branch)
into a settlement. `partner-operations.service.ts:createSettlement` computes,
per order:

```
lunaraFee      = subtotal − baseSubtotal = 400 − 308 = 92
partnerPayout  = total − lunaraFee       = 450 − 92  = 358
```

and posts, per order, into the settlement's aggregate transaction:

```
transactionRef: settlement:<settlementId>
Dr order_revenue_clearing     450
Cr partner_payable             358
Cr platform_revenue             92
```

This is the moment Lunara's ₱92 commission is actually recognized as
revenue — not at payment time (Step 2). `order_revenue_clearing` drops back
toward zero for this order; `partner_payable` for this partner grows by
₱358, awaiting an actual bank/GCash transfer (see LEDGER.md "Known gaps" —
paying down `partner_payable` is still a manual transfer outside the app).

### Running balances after Step 5

| Account | Subject | Balance |
|---|---|---|
| `platform_cash` | — | +450 |
| `order_revenue_clearing` | — | 0 |
| `platform_revenue` | — | +92 |
| `partner_payable` | this partner | +358 (unpaid) |
| `rider_payable` | this rider | +60 (until withdrawn) |

`GET /admin/ledger/trial-balance` should reflect exactly these numbers for
this transaction's `transactionRef`s.

---

## Variant: refund after settlement (clawback)

If the customer later disputes and admin approves a full refund **after**
this order was already included in a paid settlement,
`refunds.service.ts:executeRefund` calls
`partner-operations.service.ts:recordSettlementClawback`, which posts:

```
transactionRef: refund:<refundId>:clawback
Dr platform_revenue             92
Dr cash_out                    358
Cr refund_expense              450
```

This reverses the ₱92 Lunara had recognized and pulls back the ₱358 owed to
the partner (in practice, deducted from the partner's *next* settlement
rather than a literal cash clawback). `refund_expense` (a P&L account) ends
up debited net ₱450 across this and the original credit, i.e. the refund is
fully expensed.

If instead the refund happens **before** settlement (order still sitting in
`order_revenue_clearing`), it's simpler — `refunds.service.ts:executeRefund`
posts directly:

```
transactionRef: refund:<refundId>
Dr order_revenue_clearing      450
Cr customer_wallet_liability   450
```

crediting the customer's in-app wallet rather than reversing cash out of
PayMongo, and the order is simply excluded from any future settlement.

---

## Variant: cash-on-delivery order

Same order, but the customer pays cash to the rider at delivery instead of
via PayMongo:

**At delivery, rider collects ₱450 cash.**
`rider-wallet.service.ts:netEarningsAgainstCash` posts:

```
transactionRef: order:<orderId>:cash-collection
Dr rider_remittance_receivable   450
Cr order_revenue_clearing        450
```

The rider is now holding ₱450 of Lunara's money, minus whatever earnings
they're allowed to net against it. `platform_cash` is **not** credited yet
— no real money has reached Lunara.

**When admin verifies the rider's cash remittance batch** (rider physically
hands over/deposits the cash):

```
transactionRef: remittance:<batchId>
Dr platform_cash                 450
Cr rider_remittance_receivable   450
```

From here, Steps 3–5 above proceed identically — the settlement step
doesn't care whether the order was paid digitally or in cash, only that it
reached `COMPLETED`/`DELIVERED` status.

---

## Quick reference: transaction totals

| Line item | Amount |
|---|---|
| Customer paid | ₱450 |
| Rider earned (pickup + delivery) | ₱60 |
| Partner payout | ₱358 |
| Lunara commission (`platform_revenue`) | ₱92 |
| **Check:** rider + partner + Lunara | 60 + 358 + 92 = **510** |

Note this exceeds the ₱450 customer payment by ₱60 — rider fees are paid
out of Lunara's delivery-fee revenue pool, not carved out of the partner's
share. The ₱50 `deliveryFee` collected from the customer doesn't fully
cover the ₱60 rider fee for this order; the gap is absorbed across Lunara's
aggregate delivery-fee revenue rather than reconciled per-order. This is
consistent with platform-commission.md's note that "delivery fees pass
straight through to fund rider payouts" — it's a pooled, not 1:1, pass-through.
