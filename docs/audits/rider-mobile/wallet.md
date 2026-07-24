# Audit: Rider-mobile — Wallet (balance, payout method, cash remittance, withdrawals)

Date: 2026-07-24

## Entry point
- Page: `apps/rider-mobile/app/wallet.tsx`
- Component(s): inline `BalanceCard`, `SectionBlock`, `StatusPill` — no sub-components in other files.

## Sub-pages
None — no outbound navigation into a detail route. This is itself the deep sub-page reached from `(tabs)/profile.tsx`'s "Wallet & withdrawals" row (see [profile.md](profile.md) Sub-pages table), audited here per the scope carve-out for separate deep features. It is the most financially sensitive screen in the app (wallet balance, cash-in-hand remittance to admin, withdrawal requests), so the mutation-safety checklist below gets closer scrutiny than a typical read-mostly screen.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Wallet balance + recent transactions | GET | `/riders/wallet` | `WalletData` | `RidersController.getWallet` → `RiderWalletService.getWallet` |
| Withdrawal history | GET | `/riders/wallet/withdrawals` | `WithdrawalRequest[]` | `RidersController.listWithdrawals` → `RiderWalletService.listWithdrawals` |
| Cash-to-remit summary | GET | `/riders/cash-summary` | `CashSummaryData` | `RidersController.getCashSummary` → `RiderWalletService.getCashSummary` |
| Save payout method | PATCH | `/riders/payout-method` | inline body | `RidersController.updatePayoutMethod` → `RiderWalletService.updatePayoutMethod` |
| Submit cash remittance | POST (multipart) | `/riders/remit-cash` | `{submittedCount, totalNetRemittance}` | `RidersController.submitRemittance` → `RiderWalletService.submitRemittance` |
| Request withdrawal | POST | `/riders/wallet/withdraw` | — | `RidersController.requestWithdrawal` → `RiderWalletService.requestWithdrawal` |

All six endpoints are `@Roles(UserRole.RIDER)` and scoped via `req.user.sub` — no client-supplied rider id anywhere in this module.

## Backend trace
- **`getWallet`**: loads/backfills the rider doc, computes `pendingWithdrawalTotal` (aggregation over pending withdrawals) and derives `currentBalance`/`pendingEarnings`/`withdrawableBalance` via `computeRiderWalletBalances`, plus the last 30 wallet transactions. No N+1.
- **`updatePayoutMethod`**: validates the required fields per method (GCash number / Maya number / bank trio) and clears the other methods' fields when switching — clean, no stale cross-method data left behind.
- **`requestWithdrawal`**: validates a payout method is configured, enforces `RIDER_MIN_WITHDRAWAL`, recomputes `withdrawableBalance` fresh, and rejects if `amount > withdrawableBalance`. See Findings #1 for a read-then-write race here.
- **`submitRemittance`**: finds the rider's `pending` cash remittances, and — for `full_amount` mode — reverses the fee that was tentatively netted against the wallet at collection time (credits `walletBalance` back by `earningOffset`, posts a `release` transaction, and tops up the ledger receivable/clearing entries) before marking the batch `submitted`. See Findings #2 (fixed) for the race this had.
- **`getCashSummary`**: two scoped `find`s (pending+submitted, and remitted capped at 20), summed in-memory — no N+1, cheap.
- **`listWithdrawals`**: single scoped `find`, capped at 20 — no N+1.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Balance row (3 tiles) | `currentBalance`, `pendingEarnings`, `withdrawableBalance` | all backend-computed via `computeRiderWalletBalances`, no client-side math |
| Payout method | `wallet.payoutMethod` (seeds form on load), local form state for gcash/maya/bank fields | method-switch correctly clears the other methods' local inputs only visually (via conditional rendering) — the actual clearing of stale backend fields happens server-side in `updatePayoutMethod`, not client-side, so there's no risk of a stale bank number surviving a switch to GCash |
| Cash to remit | `cashSummary.pendingRemittance.{count,totalCashCollected,totalEarningOffset,totalNetRemittance,items[]}` | "HAND OVER" value switches between `totalNetRemittance`/`totalCashCollected` based on the locally-selected `remittanceMode` toggle — correctly previews what the *next* submission would cover before the rider commits, matching what the backend will actually compute for that mode |
| Recent remitted | `cashSummary.recentRemitted[]` (capped to 5 client-side, backend already caps at 20) | double-capping is harmless, just means 15 of the 20 fetched entries are wasted payload — very low-severity over-fetch, not worth a fix for a 20-row list |
| Request withdrawal | `wallet.minWithdrawal`, `wallet.payoutMethod.configured` | button correctly disabled until a payout method exists (`!wallet?.payoutMethod.configured`, `wallet.tsx:745`) |
| Withdrawal requests (list) | `item.amount`, `item.methodLabel`, `item.createdAt`, `item.adminNote`, `item.status`/`statusLabel` | all fields rendered, no dead fields |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save payout method | no | n/a | yes — disabled while `savingPayout` | yes — `Alert.alert('Error', ...)` |
| Submit cash remittance | soft-destructive (tells admin the rider physically handed over cash; wrong info here is a real-money accounting statement, not just app state) | yes — a confirmation `Alert` restates the amount/mode and explicitly says "Make sure you have already given the money before confirming" (`wallet.tsx:318-320`) before the request fires | yes — disabled while `submittingRemittance`; server-side also now atomic per-item (see Findings #2) | yes — `Alert.alert('Error', ...)` on failure |
| Request withdrawal | no (creates a pending request; actual payout requires admin approval, per `wallet.tsx:723`) | no confirmation dialog, but low risk since it's a request, not a fund transfer | yes — disabled while `withdrawing`; client-side amount validated against `MIN_WITHDRAWAL` before firing | yes — `Alert.alert('Error', ...)` |

## Authorization
All six endpoints resolve the rider from `req.user.sub` — no rider can view or mutate another rider's wallet, payout method, or remittances by manipulating a request parameter. `submitRemittance` and `requestWithdrawal` both re-derive their working set (pending remittances / current balance) server-side rather than trusting anything the client sends about *which* remittances or *what* balance — the client only supplies the withdrawal amount and remittance proof/mode, both of which are validated.

## Findings

1. **Withdrawal-request race could let a rider submit overlapping requests exceeding their balance.** `requestWithdrawal` (`rider-wallet.service.ts:336-368`) reads `rider.walletBalance` and the current `pendingWithdrawalTotal` (a fresh aggregation), computes `withdrawableBalance`, and only *then* creates the withdrawal document — a classic read-then-write gap. Two withdrawal requests submitted close together (a client retry after a slow response that the UI's `withdrawing` guard didn't catch in time, or the same account logged in on two devices) could both read the same `withdrawableBalance` before either's `withdrawalModel.create` lands, letting the rider end up with two `pending` withdrawal requests whose combined amount exceeds their actual withdrawable balance. Lower severity than the (now-fixed) pickup-accept and remittance-submit races because a `pending` withdrawal doesn't move money by itself — an admin still has to approve it — but it could still let over-committed requests reach an admin's queue and be approved before anyone notices the double-book. Left unfixed: correctly closing this needs either a MongoDB transaction/session around the read-recompute-write, or restructuring the balance check as an atomic conditional update (e.g. a running `reservedForWithdrawal` counter on the rider doc, updated via `findOneAndUpdate` with a balance guard in the filter) — a bigger structural change than a one-line fix, and risks touching the admin-side withdrawal-approval flow (`listWithdrawalsForAdmin`, not audited here) if the data model changes. Flagging for a dedicated pass rather than attempting a partial fix that doesn't fully close the window.

2. **Remittance-submit race could double the full-amount wallet credit-back — `[fixed]`.** `RiderWalletService.submitRemittance` (`rider-wallet.service.ts:644-753`, pre-fix) read all `pending` remittances with a plain `find`, and — only afterward, in a loop — for `full_amount` mode, credited `walletBalance` back by each item's `earningOffset` and posted a matching ledger topup, before finally bulk-marking all the items `submitted` via `updateMany`. Two overlapping calls (double-tap past the button's disabled-state window, or a client retry after a request that appeared to time out but actually succeeded) could both read the same `pending` items before either's `updateMany` landed, and both would run the `full_amount` credit-back loop — crediting the rider's wallet twice for the same reversed fee and posting the ledger topup twice, a genuine double-payment bug on real money.
   **Fix:** replaced the read-then-bulk-update with a per-item atomic claim — each candidate remittance is individually `findOneAndUpdate`'d with `{_id, status:'pending'}` in the filter (re-checked at write time) before being included in the `full_amount` credit-back loop; a losing concurrent call's claim attempt returns `null` and that item is excluded from its `items` set, so at most one caller ever processes a given remittance — `apps/api/src/modules/riders/rider-wallet.service.ts:653-680`. The now-redundant trailing `updateMany` (which duplicated what the per-item claim already wrote) was removed. `submitRemittance` has a single caller (`RidersController.submitRemittance`), so no other consumer needed re-checking.

## Unused/dead fields
None found — every field surfaced by `WalletData`, `CashSummaryData`, and `WithdrawalRequest` is read by some part of this screen (the double-cap on `recentRemitted` noted in the Cards table is over-fetch, not a dead field, since the extra 15 rows are still valid data the frontend simply chooses not to render all of).

## Loading/error/realtime behavior
Independent `loading`/`refreshing`/`error` state; the initial `load()` fetches wallet+withdrawals in parallel (`Promise.all`, `wallet.tsx:216-219`) and cash-summary separately with its own try/catch that falls back to an empty-but-valid `CashSummaryData` shape rather than leaving it `null` on failure (`wallet.tsx:238-243`) — a deliberate choice that keeps the "Cash to remit" section rendering (as "no pending cash") instead of blocking the whole page on a secondary endpoint's failure, which is a reasonable degradation strategy given cash-summary is the least critical of the three loads. No realtime subscription — balance/remittance/withdrawal state only updates via pull-to-refresh or after a mutation's own `load()` call, appropriate for a screen with no time-sensitive external triggers (an admin approving a withdrawal doesn't need to appear instantly).
