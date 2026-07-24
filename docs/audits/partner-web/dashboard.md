# Audit: Partner-web — Dashboard (root)

Date: 2026-07-23

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
| Header title/description | `data.shop.name`/`.code`, `portalUser.email` (from `getPortalUser()`, not the fetched payload) | |
| Alert chips (conditional) | `data.counts.awaitingAccept`, `.lowStockItems`, `.readyForDelivery` | thresholds are simple `> 0` checks against server-computed counts, not client-invented magic numbers |
| Quick action links | static | |
| Stat tiles (6) | `data.counts.incoming/inProcessing/readyForDelivery/completedToday/staffMembers/lowStockItems` | `warning` styling on two tiles mirrors the same `> 0` conditions as the alert chips above — consistent, not a separate threshold to drift out of sync |
| Revenue today / Revenue (7 days) cards | `data.revenue.todayPayout ?? .today`, `.todayOrders`; `.weekPayout ?? .week`, `.weekOrders` | same payout-preferred-over-gross pattern already seen on the Revenue page |
| Recent pipeline activity list | `o.bookingType`, `.status`, `.branchName` (conditional), `orderActionHint(o)` (client-derived from `.canAccept`/`.canReceiveAtShop`/`.receivingStepLabel`/`.currentStepLabel`, first-match-wins), `.slaLabel` (conditional), `.total` | |

## Mutations
None — this page is entirely read-only.

## Authorization
`GET /partner/dashboard` is `@Roles(UserRole.PARTNER, UserRole.ADMIN)`, matching the frontend's `useRequirePartner()`. Scope is derived server-side from `req.user` via the same helpers already verified correct elsewhere in this app. No `[authz]` issues.

## Findings

1. **[FIXED] [shared-code, N+1] Assigned-staff email lookup ran one query per order instead of one batched query — affects two other, larger-scale callers of the same helper.** `summarizeIncoming` (pre-fix, `partner-operations.service.ts:1425-1431`) did `this.userModel.findById(order.laundryProcessing.assignedStaffId).select('email')` inside the per-order loop in `summarizeIncomingBatch`, right next to a `paymentsByOrderId` batch lookup that was *already* correctly done once for the whole list — the staff-email lookup was the one field in this function that didn't follow that pattern. On this dashboard page the list is capped at 8 orders, so the practical cost here was small, but `summarizeIncomingBatch` has two other callers: the incoming-orders board (`.limit(100)`, `partner-operations.service.ts:491-494`) and an unbounded orders-progress query (`partner-operations.service.ts:790-801`, no `.limit()` at all) — both could have issued dozens to hundreds of sequential `findById` calls per page load.
   **Fix:** `summarizeIncomingBatch` now collects the distinct `assignedStaffId`s across the whole batch and fetches them in one `$in` query, building a `Map<string, string | undefined>` passed into `summarizeIncoming` — mirroring the existing `paymentsByOrderId` pattern exactly (`partner-operations.service.ts:1391-1445`). The two call sites that invoke `summarizeIncoming` directly for a single order (`getOrderProcessing`-style handlers, not traced further here) have no batch map available, so the function keeps its original single-`findById` fallback when `staffEmailById` is `undefined` — behavior for those two callers is unchanged.
   - Typechecked `apps/api` clean. Regression-checked: grepped every call site of `summarizeIncoming`/`summarizeIncomingBatch` — all four (2 single-order, 2 batch) verified to still receive the same field values, just fetched more efficiently for the batch case.

No other issues found — every field `PartnerDashboardData` returns is
rendered somewhere on this page, and authorization/scoping match the
patterns already verified correct across the rest of this app.

## Unused/dead fields
None — every field this page's own payload declares is rendered.

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md` — this page benefits from that fix
too) plus `usePartnerPipelineSocket` for realtime pipeline updates (already
verified correct in `docs/audits/partner-web/orders-queue.md` — this page
computes its own `branchIds` from `recentOrders` the same way the processing
queue page does, so the same room-join coverage analysis applies here).
