# Audit: Admin-web — Revenue

Date: 2026-07-22 (legacy dead fields removed 2026-07-22); re-audited 2026-07-23 with the
expanded skill (Sub-pages/Mutations/Authorization/sensitive-data checks added retroactively
below — no new findings)

## Entry point
- Page: `apps/admin-web/src/app/revenue/page.tsx` -> `RevenueBoard` (`apps/admin-web/src/components/datacenter/revenue-board.tsx`)

## Sub-pages
None — no outbound navigation into a detail route. The page links to `/reconciliation`,
`/reports`, and `/partners` (`revenue-board.tsx:229-234,436`), but these are sibling
top-level pages, not per-record detail views reached from this page's own data (no
row/id-based navigation exists on this page at all — it's a pure aggregate dashboard,
nothing here is a clickable individual record).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Initial load + manual "Sync" | GET | `/admin/revenue` | `RevenueData` | `AdminController.getRevenue` -> `AdminService.getRevenue` |

`revenue-board.tsx` is the **only** consumer of `/admin/revenue` anywhere in the codebase (checked across
all apps) — no mobile app, other admin page, or script calls it.

## Backend trace
`AdminService.getRevenue` runs 5 queries in parallel: a single 14-day order window (this week + prior week,
selected fields only) that's aggregated in-memory into daily buckets/branch/service breakdowns, plus three
independent month/last-month/YTD sum aggregates and a weekly payment-method aggregate. Reasonable and
bounded — no full-collection scans.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| State banner | Client-derived `deriveRevenueState()` from `week.revenue` and `daily[]` (today = last entry, since the 7-day window ends today) | Own nominal/attention logic, not server-provided. |
| Stat tiles (6): Revenue (7d), Laundry services (7d), Delivery fees (7d), Discounts given (7d), Orders (7d), Avg revenue/day | `week.revenue/.deliveryFees/.discounts/.orders/.avgPerDay/.avgOrderValue`, `.revenueDelta/.ordersDelta`, client-derived `laundryNet` (`subtotal - discounts`) | Full use of every `week.*` field. |
| Revenue overview (chart) | `daily[].revenue`, `prevDaily[].revenue` | Full use. |
| Revenue breakdown (donut) | `week.subtotal`/`.discounts`/`.deliveryFees`/`.revenue` (via `laundryNet`/`breakdownSegments`) | Full use. |
| Top revenue days | `topDays[]` (`date`, `orders`, `revenue`) | Backend pre-sorts/filters to top 5 non-zero days. |
| Revenue by shop | `byBranch[]` (`name`, `orders`, `avgOrderValue`, `revenue`) | Backend pre-sorts and caps to top 8. |
| Payment methods (donut) | `byPayment[]` (`method`, `amount`, `count`) | Full use. |
| Revenue by service | `byService[]` (`service`, `revenue`, `count`), sliced to top 6 client-side | Backend returns the full sorted list; frontend caps display to 6 — same harmless minor over-fetch pattern seen on the overview dashboard's top-services donut ([overview.md](overview.md)). |
| Revenue summary (period grid) | `summary.thisMonth/.lastMonth/.ytd` (`revenue`, `orders`), plus a synthesized "This week" row from `week.revenue/.orders` | Full use. |

## Mutations
None — this page issues no create/update/delete/toggle requests anywhere. The
only user action is "Sync" (`reload()`), a plain GET re-fetch, not a mutation.

## Authorization
`AdminController` is class-level `@Roles(UserRole.ADMIN)` — matches the frontend
(admin-only page). `getRevenue()` takes no parameters and
computes platform-wide aggregates with no per-role scoping to check (there's no
"whose revenue can I see" narrowing — admin sees all of it by design) — no
`[authz]` findings. No sensitive per-customer/per-rider PII is returned;
`byBranch[].name` is a branch name, not personal data.

## Findings
No correctness bugs found. See Unused/dead fields for the one cleanup made.

## Unused/dead fields (removed 2026-07-22)
`AdminService.getRevenue`'s response carried six fields the backend's own comment already labeled
`// Legacy fields kept for compatibility` — none were declared or read anywhere in `revenue-board.tsx`,
and (per Data flow above) there's no other consumer that could have needed them either:
- `today`, `todayOrders` — a today-only revenue/order count, computed from an accumulator that existed
  solely to produce these two fields.
- `month`, `monthOrders` — duplicates of `summary.thisMonth.revenue`/`.orders`, which the page already uses.
- `allTimeCompleted` — an all-time completed-order count, backed by its own `countDocuments` query.
- `prevWeek` (the raw `{ revenue, orders }` object) — the prior-week totals were already consumed
  server-side to compute `week.revenueDelta`/`.ordersDelta`; only the raw object itself, unused by the
  frontend, was dropped.

Since the backend already flagged these as superseded and nothing anywhere consumes them, they were
deleted rather than wired into new UI: removed the `allCompleted` count query and the `today` accumulator
entirely (one fewer DB round-trip per request), and dropped all six fields from the response and the
frontend `RevenueData` type.

## Loading/error/realtime behavior
- Same shared `useAdminQuery` pattern as the rest of admin-web, so a failed reload keeps the last-good view
  visible under the error banner (fixed during the overview audit, [overview.md](overview.md) Finding 1).
- No realtime socket subscription — reasonable, revenue reporting isn't a live-ops event stream; a manual
  "Sync" button covers refresh needs, consistent with the reports/withdrawals-style pages.
