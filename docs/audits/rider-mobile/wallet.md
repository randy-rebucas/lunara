# Audit: Rider-mobile — Wallet

Date: 2026-09-02

## Entry point
- Page: `apps/rider-mobile/app/wallet.tsx`
- Component(s): inline `BalanceCard`, `SectionBlock`, `StatusPill` — no sub-components in other files.

## Sub-pages
None — no outbound navigation into a detail route (no `router.push`/`<Link>` in this file). This
screen is distinct from `earnings.tsx` (audited separately in
[earnings.md](earnings.md)) — wallet covers balance/withdrawal/payout-method/cash-remittance, earnings
covers historical earnings breakdown; neither links to the other.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Wallet balances + payout method + recent tx | GET | `/riders/wallet` | `WalletData` | `RidersController.getWallet` → `RiderWalletService.getWallet` |
| Withdrawal history | GET | `/riders/wallet/withdrawals` | `WithdrawalRequest[]` | `RidersController.listWithdrawals` → `RiderWalletService.listWithdrawals` |
| Cash-remittance summary | GET | `/riders/cash-summary` | `CashSummaryData` | `RidersController.getCashSummary` → `RiderWalletService.getCashSummary` |
| Save payout method | PATCH | `/riders/payout-method` | `PayoutMethodData` (response, unused) | `RidersController.updatePayoutMethod` → `RiderWalletService.updatePayoutMethod` |
| Submit cash remittance | POST (multipart) | `/riders/remit-cash` | `{ submittedCount, totalNetRemittance }` | `RidersController.submitRemittance` → `RiderWalletService.submitRemittance` |
| Request withdrawal | POST | `/riders/wallet/withdraw` | (response unused) | `RidersController.requestWithdrawal` → `RiderWalletService.requestWithdrawal` |

All GET calls run via `riderFetch`, which for `GET` always goes straight to `apiFetch` (`api.ts:10-14`,
`store/auth.ts:170-178`) — never offline-queued. Mutations go through `riderFetch` → `offlineFetch`
(`lib/offline/offline-api.ts:42-71`): when offline, `offlineFetch` tries to map the path to a
task-workflow `stepKey`/`orderId` (`inferStepKey`/`extractOrderId`) to queue it — wallet/payout paths
never match that inference, so offline mutation attempts correctly throw `'Cannot queue this request
offline. Reconnect to continue.'` rather than silently queuing a money-moving request. `riderUpload`
(remit-cash) follows the same pattern via `offlineUpload`. `authRequest`/`authUpload` (`store/auth.ts:11-74`)
unwrap the backend's `{ success, data }` envelope and throw on `!res.ok || body.success === false`.

## Backend trace
`RiderWalletService.getWallet` (`rider-wallet.service.ts:171-204`): finds/creates the rider doc,
runs a one-time lifetime-earnings→wallet backfill if never done, sums pending withdrawals via an
aggregation scoped to `riderUserId`+`status:pending`, derives `currentBalance`/`pendingEarnings`/
`withdrawableBalance` via the shared `computeRiderWalletBalances` (`@lunara/utils`), and returns the
30 most recent wallet transactions. `getCashSummary` (`rider-wallet.service.ts:801-828`) runs two
scoped `find`s (pending+submitted, and remitted-limit-20) and sums three totals client-side from the
`pending` array in JS (not aggregated in Mongo — fine at this scale). `requestWithdrawal`
(`rider-wallet.service.ts:344-383`) validates payout method configured, minimum amount, and
withdrawable balance, creates the withdrawal `pending`, then fires `tryAutoApproveWithdrawal` — if
`autoApproveWithdrawals` is enabled in `SettingsService` and the amount is under the configured
threshold, it auto-approves using a system admin account, moving money without any human review.
`approveWithdrawal`/`submitRemittance` use `findOneAndUpdate` with a status-guard filter (or a unique
index on `(riderUserId, reference)` / `(riderUserId, orderId, stage)`) as the concurrency gate, so two
overlapping requests for the same withdrawal/remittance/task-credit can't both apply — well-guarded
against double-processing at the DB level.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Balance row (3 tiles: Current/Pending/Withdrawable) | `wallet.currentBalance`, `wallet.pendingEarnings`, `wallet.withdrawableBalance` | direct render, no client derivation |
| Payout method | `wallet.payoutMethod.method`, `.gcashNumber`, `.mayaNumber`, `.bankName`, `.bankAccountName`, `.bankAccountNumber`, `.configured` | `PAYOUT_OPTIONS` (gcash/maya/bank icons+labels) is a hardcoded client-side list that must stay in sync with `RIDER_PAYOUT_METHOD`/`RIDER_PAYOUT_METHOD_LABELS` in `@lunara/utils` — low risk since both come from the same shared enum but the labels/icons themselves aren't shared |
| Cash to remit — summary row | `cashSummary.pendingRemittance.totalCashCollected`, `.totalEarningOffset`, `.totalNetRemittance` | "HAND OVER" value is client-derived: picks `totalCashCollected` vs `totalNetRemittance` based on locally-selected `remittanceMode` |
| Cash to remit — mode picker | client-only state (`remittanceMode`) | two options computed from the same two backend totals |
| Cash to remit — item rows | `item.stage`, `item.orderId` (last 6 chars, uppercased — client-derived), `item.netRemittance`, `item.status` | `pendingItems` (status==='pending') vs already-`submitted` items distinguished client-side via a pill |
| Cash to remit — proof/submit | `proofImageUri`, `remittanceTransactionId` (both client-only, sent to backend) | `hasProof` gate is client-derived (image OR non-empty transaction id) |
| Recent remitted | `item.netRemittance`, `item.stage`, `item.orderId`, `item.remittedAt` | sliced to first 5 client-side (`cashSummary.recentRemitted.slice(0, 5)`) though backend already caps at 20 — minor over-fetch, not a bug |
| Request withdrawal | `wallet.minWithdrawal`, `wallet.payoutMethod.configured`, `withdrawAmount` (client input) | `MIN_WITHDRAWAL` constant fallback (100) only used if `RIDER_MIN_WITHDRAWAL` import isn't a number — defensive, harmless |
| Withdrawal requests list | `item.amount`, `item.methodLabel`, `item.createdAt` (formatted), `item.adminNote`, `item.status`+`item.statusLabel` (via `StatusPill`) | `StatusPill`'s color map is a hardcoded client-side dict keyed by status string — see Findings |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save payout method | no (overwrites prior method/details) | no | yes (`savingPayout` disables button) | yes (`Alert.alert('Error', ...)`) |
| Request withdrawal | yes — moves money, can auto-approve | **no (pre-fix)** → yes (fixed) | yes (`withdrawing` disables button) | yes (`Alert.alert('Error', ...)`) |
| Submit cash remittance | yes — tells admin cash was handed over, adjusts wallet/ledger | yes (`Alert.alert('Confirm remittance', ...)`) | yes (`submittingRemittance` disables button, plus per-item `findOneAndUpdate` status guard server-side) | yes (`Alert.alert('Error', ...)`) |

## Authorization
No `[authz]` issues. Every wallet/payout/remittance endpoint (`GET /riders/wallet`,
`GET /riders/wallet/withdrawals`, `GET /riders/cash-summary`, `PATCH /riders/payout-method`,
`POST /riders/wallet/withdraw`, `POST /riders/remit-cash`) is guarded by
`@UseGuards(JwtAuthGuard, RolesGuard)` at the controller level plus `@Roles(UserRole.RIDER)` per
method, and every service method scopes its query/mutation to `req.user.sub` (`riderUserId`/`userId`)
taken from the verified JWT — there's no request param through which a rider could read or act on
another rider's wallet, withdrawal, or remittance data. `requestWithdrawal` additionally blocks
partner-managed riders (`rider.partnerId` set) from using the platform wallet at all, matching the
`RiderMe.partnerId` doc comment in `rider-types.ts`.

## Findings

1. **Withdrawal request had no confirmation step before moving money — `[fixed]`.** Every other
   money-moving action on this screen (`submitRemittance`) confirms via `Alert.alert` before firing;
   `requestWithdrawal` (`wallet.tsx:368-388`, pre-fix) fired immediately on button press. This is
   riskier than it looks because the backend can auto-approve the withdrawal without any admin review
   (`tryAutoApproveWithdrawal`, `rider-wallet.service.ts:387-419`, gated only by a settings threshold)
   — an accidental tap could move money with zero human checkpoint on either side.
   **Fix:** added an `Alert.alert('Confirm withdrawal', ...)` step naming the amount and payout method
   before calling the endpoint, matching the existing remittance-confirmation pattern —
   `apps/rider-mobile/app/wallet.tsx` (`requestWithdrawal`).

2. **Cash-summary fetch failure was masked as "nothing to remit" — `[fixed]`.** On a failed
   `/riders/cash-summary` call, the catch block (`wallet.tsx:241-243`, pre-fix) unconditionally set
   `cashSummary` to an empty/zero structure, which renders as "No pending cash to remit." — actively
   misleading for a rider who does owe cash and just hit a network blip, since the page tells them
   they're clear when the truth is "unknown." This is a variant of the loading/error data-wiping check
   from the audit skill (step 8), applied to a fetch this page treats as separate from the main
   `wallet`/`withdrawals` load.
   **Fix:** on error, previously-loaded `cashSummary` is now preserved (`prev ?? emptyDefault`, only
   falling back to the empty shape on a genuine first-load failure) and the shared `error` banner is
   populated so the failure is visible — `apps/rider-mobile/app/wallet.tsx` (`load`). This is page-local
   state, not a shared hook, so no other screen is affected.

3. **`StatusPill` had no color mapping for the `approved` withdrawal status — `[fixed]`.**
   `WithdrawalRequest.status` (`rider-types.ts:232`) and the backend's `RIDER_WITHDRAWAL_STATUS` enum
   both include `approved`, but `StatusPill`'s `cfg` map (`wallet.tsx:165-171`, pre-fix) only handled
   `paid`/`pending`/`rejected`/`processing`, so an `approved` withdrawal would silently fall through to
   the generic muted gray instead of a status-appropriate color. Low real-world impact today —
   `approveWithdrawal` (`rider-wallet.service.ts:474-548`) transitions straight from `pending` to
   `paid` and never actually sets `approved` — but the type/enum say it's a legitimate state, so the UI
   should render it correctly if that ever changes.
   **Fix:** added an `approved` entry to `StatusPill`'s `cfg` (same accent color as `paid`) —
   `apps/rider-mobile/app/wallet.tsx` (`StatusPill`).

4. **No visible line item for `pendingWithdrawalTotal`.** `WalletData.pendingWithdrawalTotal`
   (money already tied up in withdrawal requests still pending admin review) is fetched but never
   rendered — a rider whose "Withdrawable" balance drops after submitting a request has no on-screen
   explanation why (they'd need to correlate it against the withdrawal-requests list below).
   **Fix:** left unfixed — deciding where/how to surface a fourth balance figure is a UX/product call,
   not a mechanical fix; out of scope for this pass.

## Unused/dead fields
- `WalletData.recentTransactions` — fetched but never rendered on this screen. Not sensitive (the
  rider's own transaction ledger), just unused payload; `earnings.tsx` renders a similar-but-distinct
  list (`EarningsData.recentEarnings`) from a different endpoint, so this may be intentionally
  redundant rather than a bug — noting rather than fixing since removing a field from a shared response
  type risks other untraced consumers (e.g. admin-web).
- `WalletData.currency` — fetched, never read (`formatCurrency` formats without it). Trivial.
- `WalletData.pendingWithdrawalTotal` — see Finding 4 above.
- `PayoutMethodData` returned by `PATCH /riders/payout-method` is discarded by the frontend
  (`savePayoutMethod` calls `await load()` right after to get fresh state anyway) — harmless, matches
  the "re-fetch after mutate" pattern used elsewhere in this app.
- `WithdrawalRequest.gcashNumber`/`.mayaNumber`/`.bankName`/`.bankAccountName`/`.bankAccountNumber` are
  serialized by the backend (`serializeWithdrawal`, `rider-wallet.service.ts:927-944`) but not declared
  in the frontend's `WithdrawalRequest` type and not rendered per-item (only `methodLabel` is shown).
  Not a cross-rider exposure — it's the rider's own bank/e-wallet details on their own withdrawal
  history — but it is a full bank account number sent on every list load for no rendered purpose, and
  `listWithdrawalsForAdmin` reuses the same `serializeWithdrawal` so this is shared code; left as a note
  rather than a fix since trimming the admin-facing shape needs to keep those fields (admin needs them
  to actually pay out) and splitting the two serializations is more than a "safe fix in scope" for this
  pass.

## Loading/error/realtime behavior
`loading` shows a full-screen `DataLoadState` only while there's no `wallet` yet
(`loading && !wallet`); once loaded, subsequent failures (pull-to-refresh) keep prior `wallet`/
`withdrawals` on screen and surface an inline `error` banner instead of wiping data — good pattern,
consistent with `earnings.tsx`. The `cash-summary` fetch was the one exception (see Finding 2, now
fixed) — it's deliberately split into its own try/catch from the `wallet`+`withdrawals` `Promise.all`
so a `cash-summary` failure doesn't block the rest of the page from loading, which is a reasonable
tradeoff once the failure is actually visible. No polling or socket/realtime subscription — refresh is
manual (`RefreshControl` pull-to-refresh) or triggered after each mutation via `await load()`.
