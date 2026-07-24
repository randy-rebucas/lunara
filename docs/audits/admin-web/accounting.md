# Audit: Admin-web — Accounting (P&L, cash flow, trial balance, journal)

Date: 2026-07-23 (all-time cash flow and monthly cash-flow trend wired up; duplicate trial-balance/riders
fetch removed); re-audited same day with the expanded skill (Sub-pages/Mutations/Authorization added
retroactively below — no new findings; all 3 prior fixes verified still in place)

## Entry point
- Page: `apps/admin-web/src/app/accounting/page.tsx` -> `AccountingBoard` (`apps/admin-web/src/components/datacenter/accounting-board.tsx`)
- Sub-component: `TrialBalancePanel` (rendered inline when the "Trial Balance" tab is active)

## Sub-pages
None in the "detail route of this module" sense. Rider-account rows in the Trial
Balance tab link to `/riders/:userId` (`RiderCell`/profile links,
`accounting-board.tsx:219,303`) — but that's a cross-reference into the
already-audited Riders module (`riders.md`), not a sub-page unique to accounting;
not re-traced here.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| All-time P&L + cash flow (reconciliation) | GET | `/admin/ledger/reconciliation` | `ReconciliationPnl` | `LedgerController.getReconciliation` -> `LedgerService.getReconciliation` |
| Monthly trend + recent journal entries | GET | `/admin/ledger/accounting-overview` | `AccountingOverview` | `LedgerController.getAccountingOverview` -> `LedgerService.getAccountingOverview` |
| Trial balance (top-8 sidebar, on Overview tab) | GET | `/admin/ledger/trial-balance` | `LedgerRow[]` | `LedgerController.getTrialBalance` |
| Trial balance (full, on Trial Balance tab) + riders (for rider-account name/KYC lookups) | GET | `/admin/ledger/trial-balance`, `/admin/riders` | `LedgerRow[]`, `RiderSummary[]` | Same trial-balance handler; riders list |

## Backend trace
`getReconciliation()` computes **all-time** P&L and cash-flow totals from unfiltered ledger aggregates (plus
cross-checks against settlement/withdrawal/wallet collections, not surfaced on this page — see
[reconciliation.md] if that page gets audited separately). `getAccountingOverview(months=6)` computes a
**monthly** trend (revenue/expenses/net-profit and cash-in/cash-out/net-cash-flow per month, last 6 months
by default) plus the 20 most recent journal entries. These are two genuinely different time scopes computed
by two different endpoints — not a duplicate.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Stat tiles (5): Total revenue, Total expenses, Net profit (all "all time"), Cash in, Cash out (both "this month") | `recon.pnl.platformRevenue/.riderCost/.riderWageCost/.refundCost/.netMargin`, `overview.cashFlow.cashIn/.cashOut` | Full use of `recon.pnl`; `overview.cashFlow` here is explicitly the **current-month** bucket from the monthly trend, not an all-time figure — see Findings for the previously-unused all-time counterpart. |
| P&L summary chart | `overview.trend[].revenue/.expenses/.netProfit` | Full use. |
| Cash flow summary (donut + all-time line) | `overview.cashFlow` (this month), and now `recon.cashFlow` (all time, see Findings) | |
| Cash flow trend chart (new, see Findings) | `overview.trend[].cashIn/.cashOut/.netCashFlow` | Previously fetched per month and never charted. |
| Recent journal entries | Every `JournalEntry` field: `date`, `sourceType` (via `SOURCE_LABELS`), `transactionRef`, `description`, `accountType` (via `ACCOUNT_LABELS`), `direction`+`amount` (split into Debit/Credit columns) | Full use. |
| Account balances (sidebar) | Top 8 by `Math.abs(balance)` from the overview-tab trial-balance fetch | Full use. |
| Reports shortcuts | Static links to Reconciliation/Reports/Revenue | No fetched data. |
| Trial Balance tab (`TrialBalancePanel`) | Every `LedgerRow` field (`accountType`, `accountSubject`, `balance`), grouped by `ACCOUNT_ORDER`/`PLATFORM_ACCOUNTS`/`WIDE_ACCOUNTS`; `RiderSummary` fields for rider-subject accounts (name, phone, vehicle, online status, KYC badge) | Full use — this is a genuinely thorough panel: platform-level accounts render as stat cards, per-subject accounts (rider/customer) render as tables with live rider profile links, unknown/future account types still render via a generic fallback (`ACCOUNT_LABELS[type] ?? type`) rather than being silently dropped. |

## Mutations
None — this entire board is read-only reporting/reconciliation data. The only
user actions are tab switches, "Refresh"/"Sync" (plain GET re-fetches), and
navigation links.

## Authorization
`LedgerController` is class-level `@Roles(UserRole.ADMIN)`
(`ledger.controller.ts:10`) — matches the frontend (admin-only page). No
role-scoped filter to widen (platform-wide ledger data by design, same as
`revenue.md`/`reports.md`) — no `[authz]` findings. Rider PII (`phone`, `email`
via the separately-fetched `/admin/riders`) is shown only to admins for
identifying who a ledger balance belongs to — appropriate for the audience, not
an over-broad exposure. Reusing the full `/admin/riders` list just to build a
`userId -> name/phone/vehicle/status` lookup map (`accounting-board.tsx:507-508`)
is the same low-severity "reuse a heavier existing endpoint for a lightweight
need" pattern already noted (not fixed) for `/admin/shops` in
`partner-settlements.md` — no cheaper existing endpoint to swap to, and adding
one is out of proportion to fix mechanically here.

## Findings

1. **[FIXED] `ReconciliationPnl.cashFlow` (all-time cash in/out/net) was fetched but never displayed.**
   The page already fetches this alongside `recon.pnl` (used for the all-time revenue/expenses/net-profit
   tiles), but only ever renders `overview.cashFlow` — confirmed to be the **current month only** bucket
   from `getAccountingOverview`'s monthly trend, not an all-time figure. So despite the top stat-tile row
   already juxtaposing all-time P&L with this-month cash flow, there was no all-time cash-flow figure
   anywhere, even though it was already being fetched. Fix: added an "All time" line under the existing
   "Cash flow summary" donut panel showing `recon.cashFlow.cashIn/.cashOut/.net`.

2. **[FIXED] Each month's `cashIn`/`cashOut`/`netCashFlow` in `overview.trend[]` was fetched but never
   charted.** The backend computes a full 6-month cash-flow trend (parallel to the revenue/expenses/net-profit
   trend that already powers the "P&L summary" chart), but the frontend only ever read the aggregate
   *current*-month snapshot out of it (`overview.cashFlow`) for the stat tiles and donut — the other 5
   months' cash-flow figures, and the trend shape itself, were computed server-side and discarded. Fix:
   added a new "Cash flow trend" panel/chart, built the same way as the existing P&L trend chart
   (`CompareLineChart` with a color-coded legend), plotting Cash in / Cash out / Net cash flow per month.

3. **[FIXED] `/admin/ledger/trial-balance` (and `/admin/riders`) was fetched twice** — once in
   `AccountingBoard` for the Overview tab's "Account balances" sidebar, and again independently inside
   `TrialBalancePanel` via its own `useAdminQuery` when the Trial Balance tab opened. Fix: lifted both
   queries up into `AccountingBoard` and turned `TrialBalancePanel` into a pure presentational component
   that receives `data`/`loading`/`error`/`reload`/`riders` as props; the header's "Refresh" button now also
   reloads the trial balance alongside the P&L/overview queries.

## Unused/dead fields
None remain — see Findings 1 and 2.

## Loading/error/realtime behavior
- Two independent `useAdminQuery`s (`reconLoading`/`overviewLoading`) drive the header's combined "Sync"
  button and separate error banners — a failure in one doesn't block the other from rendering.
- No realtime socket subscription — reasonable; accounting figures aren't a live-ops event stream, and a
  manual "Refresh" (which now re-triggers all three underlying queries, see Finding 3) covers the need.
