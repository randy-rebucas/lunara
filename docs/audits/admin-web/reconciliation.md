# Audit: Admin-web — Reconciliation

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/reconciliation/page.tsx` -> `ReconciliationBoard` (`apps/admin-web/src/components/datacenter/reconciliation-board.tsx`)

## Sub-pages
None — no outbound navigation into a detail route. Links to `/accounting`,
`/revenue`, `/partners/settlements`, `/riders/withdrawals` (all already-audited
or sibling top-level pages) are static cross-references, not per-record detail
views of anything fetched here. The "detail panel" for a selected transaction
(`selectedId`) is an in-page right-rail panel, not a route.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Reconciliation summary (P&L, cash flow, settlements, withdrawals, wallets, spot checks) | GET | `/admin/ledger/reconciliation` | `ReconciliationData` | `LedgerController.getReconciliation` -> `LedgerService.getReconciliation` |
| Recent transactions (payments/payouts/refunds vs ledger match) | GET | `/admin/ledger/reconciliation/transactions?limit=300` | `TransactionsData` | `LedgerController.getReconciliationTransactions` -> `LedgerService.getReconciliationTransactions` |

Same underlying `ReconciliationPnl`/all-time cash-flow shape already audited from
the Accounting board's perspective (`accounting.md`) — this page is the fuller,
dedicated view of it (settlements/withdrawals/wallets/spot-checks weren't
rendered on the Accounting board, by design — noted there as "not surfaced on
this page, see reconciliation.md").

## Backend trace
`getReconciliation()` computes everything via `$group` aggregates (ledger totals
by account type, settlement/withdrawal/wallet sums) — no full-collection JS-side
loading, well-commented sign conventions for each account type (asset vs
liability vs expense), and four spot-check drift values (clearing, commission,
cash-out, wallet) cross-checking ledger balances against source-of-truth
collections. `getReconciliationTransactions(limit)` pulls the `limit`-most-recent
paid/processed rows from four different collections (payments, settlements,
withdrawals, refunds), each scoped with `.select()`+`.lean()`+`.sort()`+`.limit()`,
looks up matching ledger entries by `transactionRef`, and flags each row
matched/unmatched — see Finding 1 for a correctness bug in how these four result
sets were combined (now fixed).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Health banner | Client-derived `allChecksPassed` (every `spotChecks.*` `< 2` in absolute value) | Reasonable client-side threshold (₱2 rounding tolerance), consistent with the ₱1-2 tolerances used elsewhere on this page and in `accounting.md`'s clearing-drift banner. |
| Transaction stat tiles (5) | `txnData.summary.{total,totalAmount,matchedCount,unmatchedCount,difference}`, client `matchRate` | Full use; three tiles double as tab-switch buttons (Overview/Matched/Unmatched). |
| Transaction ledger (Overview/Unmatched/Matched tabs) | Every `ReconTxn` field: `reference`, `typeLabel` (via `TYPE_TONE` color map), `source`, `amount`, `matched`, `difference`, grouped by day with a per-day total | `TYPE_TONE` (`reconciliation-board.tsx:168-173`) is a hardcoded map keyed by the 4-value `type` union — same low-risk "must stay in sync by hand" class noted elsewhere (small, stable set). |
| Summary tab — Platform P&L | `pnl.{platformRevenue,riderCost,riderWageCost,refundCost,netMargin}` | Full use, matches the same fields already audited via the Accounting board. |
| Summary tab — Partner settlements | `settlements.{count,paidCount,pendingCount,totalRevenue,totalLunaraFee,totalPartnerPayout}` | Full use — this is the "not surfaced on Accounting" data `accounting.md` flagged as living here instead. |
| Summary tab — Rider payouts | `riderWithdrawals.{paidCount,totalPaid,pendingCount,pendingTotal,riderPayableBalance,riderRemittanceReceivable}` | Full use. |
| Summary tab — Customer wallets | `wallets.{count,ledgerLiability,actualBalance,drift}` | Full use; drift banner only shows when `|drift| >= 2`. |
| Summary tab — Spot checks | `spotChecks.{clearingDrift,commissionDrift,cashOutDrift,walletDrift}` | Full use, each with a hardcoded description of what it cross-checks. |
| Right rail — transaction detail (when a row is selected) | `selected.{typeLabel,source,date,amount,matchedWith,difference,matched}` | Full use; unmatched rows get an explanatory note pointing at "paired ledger post" failures. |
| Right rail — reconciliation summary (default) | `txnData.summary.*`, client `matchRate` progress bar | Full use, duplicates a subset of the top stat tiles in rail form for when no row is selected. |
| Right rail — breakdown by type (donut) | `txnData.breakdown.{payment,payout,refund}` | Full use. |

## Mutations
None — this entire page is read-only reconciliation reporting. "Refresh"
re-fetches both queries; there is no create/update/delete/toggle action
anywhere (as expected — reconciliation is a read-only cross-check, not a place
to edit ledger data).

## Authorization
`LedgerController` is class-level `@Roles(UserRole.ADMIN)` — matches the
frontend (admin-only page). No role-scoped filter to widen (platform-wide
financial aggregates by design) — no `[authz]` findings. No PII is returned by
either endpoint (transaction rows show payment method/reference/amount, not
customer or rider names).

## Findings

1. **Equal per-type quota skewed "most recent N transactions" away from true recency.**
   `getReconciliationTransactions` (pre-fix) set `perTypeLimit = Math.ceil(limit / 4)`
   and applied that same cap to all four source collections (payments,
   settlements, withdrawals, refunds) before merging and re-sorting by date.
   Payments vastly outnumber the other three types in practice (every completed
   order produces one, while settlements/withdrawals/refunds are comparatively
   rare), so a fixed `limit`-wide time window covered by, say, 75 payments
   (`limit=300`) might only reach back a few hours, while 75 refunds could reach
   back weeks — meaning the page's "most recent 300 transactions" wasn't
   actually the 300 most recent overall; it silently excluded more-recent
   payments in favor of older refunds/settlements/withdrawals just to keep the
   four-way split even. This skewed the "Total transactions"/"Matched"/"Unmatched"/
   "Difference" stat tiles and the type-breakdown donut away from what the page's
   own copy ("most recent 300") claims.
   **Fix:** each of the four queries now fetches up to the full `limit` (not
   `limit / 4`) before merging, re-sorting by date, and slicing to `limit`
   (`ledger.service.ts`, `getReconciliationTransactions`) — the existing
   merge-sort-slice logic already produced the correct top-N once each source
   query stopped being artificially truncated. Worst case this fetches up to 4×
   `limit` lean, `.select()`-projected documents (bounded by the controller's
   existing `Math.min(1000, ...)` clamp on `limit`, so at most 4000 small
   documents) — a trivial cost increase for a correct result.

## Unused/dead fields
None — every field on both `ReconciliationData` and `TransactionsData` is read
and rendered somewhere on the page.

## Loading/error/realtime behavior
Two independent `useAdminQuery`s (summary + transactions) drive the header's
combined "Refresh" button and separate error banners, same pattern as
`accounting.md` — a failure in one doesn't block the other from rendering. No
realtime socket subscription; reasonable for a reconciliation report, which by
nature reflects a point-in-time snapshot to be manually refreshed, not a live
event stream.
