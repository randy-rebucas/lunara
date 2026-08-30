# Audit: Partner-web — Dashboard (root)

Date: 2026-08-31 (re-audited — page redesigned: trend-based stat cards, revenue line
chart, top-services donut, live pipeline socket badge)

## Entry point
- Page: `apps/partner-web/src/app/page.tsx`
- Component(s): inline in the page file, using shared `Card`/`StatCard`/`LiveBadge` UI components

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/page.tsx` or `orders/[id]/receiving/page.tsx` | recent-activity row link, `page.tsx:225-227` via `partnerOrderHref(o)` | `o._id` -> `id` route param | yes |

`partnerOrderHref` (`lib/partner-order-links.ts`) picks between the receiving
sub-route and the main order-detail route based on `canReceiveAtShop`/
`status` — both targets are the same large, independent order-processing
feature already flagged as out-of-scope for a full trace in
`docs/audits/partner-web/customers.md`, `messages.md`, `orders-queue.md`, and
`shelf-lookup.md`; not re-traced here. The quick-action links
(`/orders/incoming`, `/orders`, `/staff`, `/inventory`, `/revenue`,
`/reports`) all go to already-audited sibling top-level pages, not detail
views of this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load dashboard | GET | `/partner/dashboard` | `PartnerDashboardData` | `PartnerController.getDashboard` -> `PartnerOperationsService.getDashboard` |
| Realtime pipeline updates | socket (`/tracking`, `joinPartnerPortal`/`joinPartnerOperations`/`joinBranch` -> `partnerPipelineUpdated`/`branchPipelineUpdated`) | — | triggers `reload()` | `TrackingGateway` (same hook already verified correct in `docs/audits/partner-web/orders-queue.md`) |

## Backend trace
`getDashboard` is the same method already partially traced and fixed across
`docs/audits/partner-web/inventory.md` (branch-scoped low-stock count,
seeding moved inside the role-scoped branch) and `revenue.md` — this pass
adds the `recentOrders` half of the trace. The 8 most-recently-updated
"incoming" orders are summarized via the shared `summarizeIncomingBatch`
helper — see Finding #1 for a real N+1 found and fixed in that helper,
which also benefits two other, larger-scale callers of the same function.
Role scoping (`dashboardScopeFilter`/`revenueOrderFilter`/
`resolvePartnerBranches`) is the same correctly-multi-branch-aware pattern
already verified across the other partner-web audits.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Header title/description | `data.shop.name`/`.code`, `portalUser.email` (from `getPortalUser()`, not the fetched payload) | live-socket badge (`LiveBadge`) shown when `usePartnerPipelineSocket` reports connected |
| Alert chips (conditional) | `data.counts.awaitingAccept`, `.lowStockItems`, `.readyForDelivery` | thresholds are simple `> 0` checks against server-computed counts, not client-invented magic numbers |
| Stat cards (4, redesigned from the old 6-tile grid) | `data.trends.ordersToday/completedToday/revenueToday/staffMembers` — each `{ value, deltaPct }`, `deltaPct` compares to the same metric yesterday | `deltaPct` is entirely server-computed (`deltaPct()` helper, null when yesterday's value was 0 to avoid a divide-by-zero/infinite-percent) — no client-side trend math |
| Revenue overview line chart | `data.revenue.series[].date/revenue` (7-day daily **gross** revenue, not payout) | |
| Top services donut | `data.services[].label/count` (top 4 by order count over the last 7 days, remainder bucketed into "Other") | `SERVICE_LABELS` is a small backend-side map with a graceful raw-string fallback for unmapped booking types |
| Recent pipeline activity list | `o.bookingType`, `.status`, `.branchName` (conditional), `orderActionHint(o)` (client-derived from `.canAccept`/`.canReceiveAtShop`/`.receivingStepLabel`/`.currentStepLabel`, first-match-wins), `.slaLabel` (conditional), `.total` | links via `partnerOrderHref(o)`, same helper already verified in the prior pass |

## Mutations
None — this page is entirely read-only.

## Authorization
`GET /partner/dashboard` is `@Roles(UserRole.PARTNER, UserRole.ADMIN)`, matching the frontend's `useRequirePartner()`. Scope is derived server-side from `req.user` via the same helpers already verified correct elsewhere in this app. No `[authz]` issues.

## Findings

1. **[FIXED — 2026-08-31] The "Revenue" stat card showed gross revenue while its own
   target page shows net payout for the identical figure.** `trends.revenueToday.value`
   (pre-fix, `partner-operations.service.ts:446`) was `todayBreakdown.gross`, but this
   stat card links to `/revenue` (`page.tsx:136`), whose own "Today" stat is
   `data.todayPayout ?? data.today` — i.e. net payout after Lunara's fee, per
   [revenue.md](revenue.md)'s already-documented payout-preferred convention. A partner
   clicking "Revenue" on the dashboard would land on `/revenue` and see a smaller,
   different number for what looked like the same figure, with no fee breakdown
   visible on the dashboard card itself to explain the gap.
   **Fix:** `trends.revenueToday` now uses `todayBreakdown.payout`/`yesterdayBreakdown.payout`
   for both `value` and the day-over-day `deltaPct` comparison —
   `apps/api/src/modules/partner/partner-operations.service.ts:446`. `todayBreakdown`/
   `yesterdayBreakdown` already computed `.payout` (used elsewhere in the same response
   for `revenue.todayPayout`), so this only changes which already-computed field feeds
   the stat card — no new query or calculation. Typechecked `apps/api` clean; no other
   caller reads `trends.revenueToday`.
   Left as a documented, not fixed, quirk: the "Revenue overview" line chart just below
   this stat card still plots gross `revenue.series` (day-by-day gross totals, useful
   for volume trends) — so the word "Revenue" now refers to two different quantities
   in two adjacent sections of the same page. Not fixed further since the chart's
   gross framing is a reasonable, distinct visualization (a trend line, not a
   "how much did I earn" number this pass had a concrete inconsistency to point at),
   and relabeling/re-deriving it is a UX judgment call rather than a bug.

2. **[FIXED] [shared-code, N+1] Assigned-staff email lookup ran one query per order instead of one batched query — affects two other, larger-scale callers of the same helper.** `summarizeIncoming` (pre-fix, `partner-operations.service.ts:1425-1431`) did `this.userModel.findById(order.laundryProcessing.assignedStaffId).select('email')` inside the per-order loop in `summarizeIncomingBatch`, right next to a `paymentsByOrderId` batch lookup that was *already* correctly done once for the whole list — the staff-email lookup was the one field in this function that didn't follow that pattern. On this dashboard page the list is capped at 8 orders, so the practical cost here was small, but `summarizeIncomingBatch` has two other callers: the incoming-orders board (`.limit(100)`, `partner-operations.service.ts:491-494`) and an unbounded orders-progress query (`partner-operations.service.ts:790-801`, no `.limit()` at all) — both could have issued dozens to hundreds of sequential `findById` calls per page load.
   **Fix:** `summarizeIncomingBatch` now collects the distinct `assignedStaffId`s across the whole batch and fetches them in one `$in` query, building a `Map<string, string | undefined>` passed into `summarizeIncoming` — mirroring the existing `paymentsByOrderId` pattern exactly (`partner-operations.service.ts:1391-1445`). The two call sites that invoke `summarizeIncoming` directly for a single order (`getOrderProcessing`-style handlers, not traced further here) have no batch map available, so the function keeps its original single-`findById` fallback when `staffEmailById` is `undefined` — behavior for those two callers is unchanged.
   - Typechecked `apps/api` clean. Regression-checked: grepped every call site of `summarizeIncoming`/`summarizeIncomingBatch` — all four (2 single-order, 2 batch) verified to still receive the same field values, just fetched more efficiently for the batch case.

No other issues found in the 2026-08-31 pass — `trends`/`services`/`revenue.series`
are all correctly server-computed with no client-side re-derivation beyond simple
display formatting, and authorization/scoping match the patterns already verified
correct across the rest of this app.

## Unused/dead fields
`data.counts.incoming`/`.inProcessing` are still returned by `getDashboard` but no
longer rendered directly as their own stat tiles now that the page uses the 4
trend-based `StatCard`s instead of the old 6-tile grid — `incoming` is still used
indirectly (`awaitingAccept`/`readyForDelivery` alert chips cover the same
underlying signal via different counts). Not sensitive, low-impact; `counts` as a
whole is still consumed for the alert-chip thresholds, so trimming the response
shape wasn't worth doing for two now-unused sibling fields.

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md` — this page benefits from that fix
too) plus `usePartnerPipelineSocket` for realtime pipeline updates (already
verified correct in `docs/audits/partner-web/orders-queue.md` — this page
computes its own `branchIds` from `recentOrders` the same way the processing
queue page does, so the same room-join coverage analysis applies here).
