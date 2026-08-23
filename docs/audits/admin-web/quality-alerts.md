# Audit: Admin-web — Quality alerts

Date: 2026-08-23

## Entry point
- Page: `apps/admin-web/src/app/quality-alerts/page.tsx`
- Component(s): `apps/admin-web/src/components/datacenter/quality-alerts-board.tsx`

## Sub-pages
This module does not own any sub-pages of its own; it links out into two other
modules' existing detail routes.

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `partners/[id]/command-center/page.tsx` | shop card, `quality-alerts-board.tsx:61` | `s.partnerId` -> `id` route param | yes (after fix, see Findings #1) |
| `riders/[userId]/page.tsx` | rider card, `quality-alerts-board.tsx:85` | `r.riderId` -> `userId` route param | yes |

Neither sub-page is re-audited in depth here (both already have their own audits —
`partners.md` covers the command center's parent list, and `riders.md` covers the
rider detail page). This module only needed to verify the handoff, which is
covered under Findings.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load alerts | GET | `/admin/quality-alerts` | `QualityAlertsData` (`quality-alerts-board.tsx:24`) | `AdminController.getQualityAlerts` -> `AdminService.getQualityAlerts` |

## Backend trace
`AdminService.getQualityAlerts` (`apps/api/src/modules/admin/admin.service.ts:1010`)
runs two aggregations over `reviewModel` in parallel:
- Shops: groups reviews by `partnerId`, averaging `rating` and counting reviews.
- Riders: `$lookup`s each review's `orderId` into `orders`, unwinds, then groups by
  `order.deliveryRiderId`.

Both result sets are filtered in-memory to `avgRating < 3.5` and
`reviewCount >= 5` (hardcoded constants `QUALITY_ALERT_RATING_THRESHOLD` /
`QUALITY_ALERT_MIN_REVIEWS`, lines 1004-1005 — deliberately not configurable per
the code comment). Flagged ids are then used to look up partner/rider names via
`userModel` and the partner's main branch name via `branchModel`, and the merged
result is sorted ascending by rating and returned.

Performance note: the rider aggregation's `$lookup` from `reviews` into `orders`
plus `$unwind` scans all reviews with no pre-filter, and the shop aggregation
scans all reviews grouped by `partnerId` with no index hint — acceptable at
current data volume but will scale linearly with total review count since
there's no upper bound/date window on the aggregation.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Page description | `data.threshold`, `data.minReviews` | Backend-sourced, not hardcoded on the frontend — good, avoids drift if the constants change. |
| Shops below threshold list | `s.partnerId`, `s.shopName`, `s.reviewCount`, `s.avgRating` | Card background/text color (`bg-red-50`/`text-red-700`) is a static hardcoded flag color, not backend-driven — reasonable since every row here is by definition below threshold (no severity tiers to distinguish). |
| Riders below threshold list | `r.riderId`, `r.riderEmail`, `r.reviewCount`, `r.avgRating` | Same static red-flag styling as shops. |

## Mutations
None — this is a read-only report page. No create/update/delete/toggle actions.

## Authorization
`AdminController` is class-level guarded with `@UseGuards(JwtAuthGuard, RolesGuard)`
and `@Roles(UserRole.ADMIN)` (`apps/api/src/modules/admin/admin.controller.ts:74-76`),
which covers `getQualityAlerts` — only ADMIN can reach `/admin/quality-alerts`,
matching the page only being reachable from the admin-web app. No request
parameters exist on this endpoint, so there's no role-scope-widening surface.
No `[authz]` findings.

## Findings

1. Shop card linked to the generic partner list instead of the flagged partner's
   detail page, forcing a manual re-search. `quality-alerts-board.tsx:61` used
   `href={`/partners`}` while `partnerId` was already available and
   `partners-board.tsx:839` establishes the sibling pattern of linking to
   `/partners/${shop._id}/command-center`.
   **Fix:** changed to `href={`/partners/${s.partnerId}/command-center`}` (`quality-alerts-board.tsx:61`), matching `partners-board.tsx`'s existing pattern. No shared code touched, so no other module affected.

2. `AdminService.getQualityAlerts` selected `ownerName` on the partner lookup
   (`admin.service.ts:1050`, pre-fix) but never included it in the returned
   `shops` payload — dead field fetched from the DB and discarded, not a
   sensitive-exposure issue since it never left the backend, just wasted query
   cost.
   **Fix:** removed `ownerName` from the `.select(...)` projection (`admin.service.ts:1050`).

3. No date window on either quality-alert aggregation — a shop/rider is flagged
   using its all-time average, so one bad month years ago can keep it flagged
   indefinitely, and the un-windowed scan grows with total review volume.
   **Fix:** left unfixed — this is a product decision (what rolling window counts as "current" quality) rather than a bug; the existing code comment on line 1007-1009 already documents the current all-time behavior as an intentional simple-flagging choice, not an oversight.

## Unused/dead fields
None remaining after Finding #2's fix — every field the backend returns in the
`shops` and `riders` arrays (`partnerId`/`shopName`/`avgRating`/`reviewCount` and
`riderId`/`riderEmail`/`avgRating`/`reviewCount`), plus `threshold`/`minReviews`,
is read and rendered by `quality-alerts-board.tsx`.

## Loading/error/realtime behavior
Uses the shared `useAsyncQuery` hook (aliased `useAdminQuery`,
`apps/admin-web/src/lib/use-admin-query.ts` -> `packages/hooks/src/use-async-query.ts`).
Loading renders a "Loading…" line, error renders the message in red, and a
failed reload does not clear `data` (the hook only overwrites `data` on
success — `packages/hooks/src/use-async-query.ts:14-26`), so a transient refresh
failure won't blank a previously-loaded board. No polling or socket
subscription on this page — data loads once on mount via the `[]` deps array
(`quality-alerts-board.tsx:37`); this is consistent with other one-shot report
pages in admin-web (e.g. `revenue.md`, `reconciliation.md`) rather than a gap
specific to this module.
