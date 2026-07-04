# Ledger module

Double-entry accounting for every place real or virtual money moves between
the platform, partners, riders, and customers. Existing flows (settlements,
wallets, remittances, withdrawals) kept their own status fields — this module
adds a parallel, append-only record so those statuses can be reconciled
against actual money movement instead of trusted blindly.

## Model

`LedgerEntry` (`schemas/ledger-entry.schema.ts`) — one row per account touched
by a transaction. Rows sharing a `transactionRef` are one balanced
transaction: `LedgerService.post()` rejects the call if debits != credits.

Posting is idempotent: if a `transactionRef` already has entries, `post()` is
a no-op. Callers don't need their own idempotency guard before posting.

```ts
await ledgerService.post(transactionRef, sourceType, sourceId, [
  { accountType: 'order_revenue_clearing', direction: 'debit', amount, description },
  { accountType: 'partner_payable', accountSubject: partnerId, direction: 'credit', amount, description },
]);
```

## Accounts

| accountType | accountSubject | Meaning |
|---|---|---|
| `order_revenue_clearing` | — | Order revenue recognized but not yet settled to a partner. Credited when a payment is confirmed (cash or digital); debited when that order is included in a partner settlement, or reversed by a refund. Should trend toward zero on a healthy system — sustained drift means orders are unsettled or refunds are outpacing settlement. |
| `platform_revenue` | — | Lunara's commission, recognized at settlement time. |
| `partner_payable` | partnerId | What the platform owes a partner. Credited at settlement; nothing currently debits it (see Gaps). |
| `rider_payable` | riderUserId | What the platform owes a rider for completed tasks/bonuses. Credited on earning, debited on withdrawal payout. |
| `rider_remittance_receivable` | riderUserId | Cash a rider is holding that's owed back to the platform. Debited when cash is collected, credited when admin verifies the remittance. |
| `cash_out` | payout method (`gcash`/`maya`/`bank`) | Real cash paid out to riders via withdrawal. |
| `platform_cash` | — | Cash actually received by the platform: PayMongo payments, PayMongo wallet top-ups, verified rider remittances. |
| `rider_payout_expense` | — | P&L side of independent-contractor rider earnings (pickup/delivery fees, bonuses, adjustments). |
| `rider_wage_expense` | — | P&L side of fixed-wage payments to employee riders — kept separate from `rider_payout_expense` since it isn't tied to task volume. |
| `customer_wallet_liability` | userId | Customer wallet balances — money the platform owes back to customers. Credited on top-up/refund, debited when a wallet-funded order is paid. |
| `refund_expense` | — | P&L side of refunds and goodwill payouts (e.g. lost-item compensation) that don't reverse an existing clearing entry. |

## Where entries are posted

| Event | File | Entry |
|---|---|---|
| PayMongo order payment confirmed | `payments.service.ts:markOrderPaid` | Dr `platform_cash` / Cr `order_revenue_clearing` |
| Wallet-funded order payment confirmed | `payments.service.ts:markOrderPaid` | Dr `customer_wallet_liability` / Cr `order_revenue_clearing` |
| PayMongo wallet top-up confirmed | `payments.service.ts:markWalletTopupPaid` | Dr `platform_cash` / Cr `customer_wallet_liability` |
| Rider collects cash at pickup/delivery | `rider-wallet.service.ts:netEarningsAgainstCash` | Dr `rider_remittance_receivable` / Cr `order_revenue_clearing` |
| Admin verifies a cash remittance | `rider-wallet.service.ts:verifyRemittanceBatch` | Dr `platform_cash` / Cr `rider_remittance_receivable` |
| Rider withdrawal paid out | `rider-wallet.service.ts:approveWithdrawal` | Dr `rider_payable` / Cr `cash_out` |
| Rider earns a pickup/delivery fee | `riders.service.ts:creditEarning` | Dr `rider_payout_expense` / Cr `rider_payable` |
| Rider bonus / manual adjustment | `riders.service.ts:creditManualEarning` | Dr `rider_payout_expense` / Cr `rider_payable` |
| Employee rider wage payment (manual) | `riders.service.ts:creditManualEarning` | Dr `rider_wage_expense` / Cr `rider_payable` |
| Partner settlement created | `partner-operations.service.ts:createSettlement` | Dr `order_revenue_clearing` / Cr `partner_payable` + `platform_revenue` |
| Refund request approved | `refunds.service.ts:executeRefund` | Dr `order_revenue_clearing` / Cr `customer_wallet_liability` |
| Order cancelled with a refundable payment | `orders.service.ts:cancelByCustomer` | Dr `order_revenue_clearing` / Cr `customer_wallet_liability` |
| Lost-item compensation credited | `support.service.ts` (`InvestigateAction.COMPENSATE`) | Dr `refund_expense` / Cr `customer_wallet_liability` |

## Reconciliation

`GET /admin/ledger/trial-balance` (admin-only) returns net balance per
account/subject. Use it to cross-check against the records that drove each
posting:

- `partner_payable:<id>` balance should match the partner's unpaid
  `PartnerSettlement.partnerPayout` total.
- `rider_payable:<id>` balance should match a rider's `totalEarnings` minus
  paid withdrawals.
- `customer_wallet_liability:<userId>` balance should equal that user's
  `Wallet.balance`.
- `order_revenue_clearing` should trend to zero; a growing balance means
  orders are paid but not yet settled (expected, day-to-day) or refunds
  aren't being processed.

## Known gaps (not yet implemented)

- **No settlement reversal.** If an order is refunded after it was already
  included in a `PartnerSettlement`, the settlement's `partner_payable` /
  `platform_revenue` credit is never reversed — `order_revenue_clearing` will
  go negative for that amount, which the trial balance will surface, but
  nothing auto-corrects it. Needs an admin-driven "settlement correction"
  flow before this is relied on for real money movement.
- **No actual fund transfer.** `partner_payable` and `rider_payable` are
  accounting liabilities only — paying them down still requires a manual
  bank transfer / GCash send outside the app. There's no integration with
  PayMongo's payout API or a banking provider.
- **Dev-mode wallet top-up** (`wallets.service.ts:topUp`, used only when
  `PAYMONGO_SECRET_KEY` is unset) does not post to the ledger, since it
  represents no real money and only runs outside production.
