# Audit: Rider-mobile — Performance (completion/acceptance/on-time/rating stats)

Date: 2026-07-24

## Entry point
- Page: `apps/rider-mobile/app/performance.tsx`
- Component(s): inline `RingMeter`, `StatRow` — no sub-components in other files.

## Sub-pages
None — no outbound navigation into a detail route, purely a read-only stats screen. Reached from `(tabs)/profile.tsx`'s "Performance" row (see [profile.md](profile.md) Sub-pages table).

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Performance stats | GET | `/riders/performance` | `RiderPerformanceData` | `RidersController.getPerformance` → `RidersService.getPerformance` → `buildRiderPerformancePayload` |

Single endpoint, `@Roles(UserRole.RIDER)`, scoped via `req.user.sub` — no client-supplied rider id.

## Backend trace
`buildRiderPerformancePayload` (`rider-performance.ts`) runs 9 queries in parallel (`Promise.all`) — all `countDocuments`/`find` scoped by `pickupRiderId`/`deliveryRiderId` matching the caller: completed pickups/deliveries, cancelled tasks, accepted pickups/deliveries, total pickup/delivery assignments, on-time deliveries (a `$expr` comparison between `delivery.deliveredAt` and `scheduledDeliveryAt`), the set of completed-delivery order ids (candidates for a customer review), and the on-time denominator (deliveries that had both a schedule and a delivered timestamp, regardless of whether they were on time). It then runs one further aggregate against `Review` (`{orderId: {$in: orderIds}}`, computing both an average rating and — after the fix below — a count) only if there's at least one completed delivery. `completionRate`/`acceptanceRate`/`onTimeDeliveryRate` are all `pct(numerator, denominator)`, which returns `100` when the denominator is `0` — a brand-new rider with zero deliveries would see 100% across the board rather than a "not enough data" state; noting as a display-fidelity quirk rather than a bug, since it's a deliberate default in `pct()`.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Completion rate ring | `completionRate` | backend-computed, `pct(completedTasks, completedTasks+cancelledTasks)` |
| Acceptance rate ring | `acceptanceRate` | backend-computed, `pct(acceptedAssignments, totalAssignments)` |
| On-time delivery ring | `onTimeDeliveryRate` | backend-computed |
| Customer rating ring | `customerRating` (formatted `X.X / 5` or `—` if null), `ratedDeliveries` (hint text) | see Findings #1 — `ratedDeliveries` was wrong before the fix |
| Activity summary (4 rows) | `completedTasks`, `cancelledTasks`, `acceptedAssignments`/`totalAssignments`, `onTimeDeliveries` | all backend fields, no client-side derivation, no dead fields |

## Mutations
None — read-only screen.

## Authorization
Single endpoint, correctly scoped to `req.user.sub` throughout — no cross-rider access surface, no `[authz]` findings.

## Findings

1. **`ratedDeliveries` counted all completed deliveries, not deliveries that were actually reviewed — `[fixed]`.** `rider-performance.ts` (pre-fix) computed `ratedOrders` as *every* completed delivery assigned to the rider (the full candidate set a review could exist for), then returned `ratedDeliveries: ratedOrders.length` directly — mislabeling "total completed deliveries" as "count of customer ratings received." The screen renders this as `"${ratedCount} rated deliveries"` (`performance.tsx:224`) right next to the average rating, so a rider with 50 completed deliveries but only 3 actual customer reviews would see "50 rated deliveries" — badly overstating how much feedback their rating is actually based on, and misleading them about how representative that average is.
   **Fix:** the `Review` aggregate now also computes `count: {$sum: 1}` alongside the average, and `ratedDeliveries` is set from that aggregate's actual matched-document count instead of the candidate-order-list length — `apps/api/src/modules/riders/rider-performance.ts:86-100`. Also merged the previously-sequential `deliveriesWithSchedule` count into the initial `Promise.all` batch (`rider-performance.ts:42, 74-79`) since it didn't depend on any of the batch's results — a minor efficiency cleanup alongside the fix, not a separate behavioral change. Verified `buildRiderPerformancePayload` has a single caller (`RidersService.getPerformance`) and `ratedDeliveries`/the frontend `RiderPerformanceData` type have no other consumers in the rider-mobile or admin-web codebases (checked via grep), so no other surface needed re-verification.

2. **Customer rating is an order-level review, not a rider-specific one.** The `Review` schema (`apps/api/src/modules/reviews/schemas/review.schema.ts`) has one `rating` field per order (plus an optional `partnerId`, but no `riderId`) — so the "Customer rating" shown on this screen is really "the average rating of orders this rider happened to deliver," which conflates the rider's own performance with the customer's satisfaction with the partner/laundry-quality side of the order. A rider could have a poor rating average purely because the partner shop they're dispatched to does bad laundry work, or vice versa get credit for good laundry quality that had nothing to do with their delivery performance. This is a data-model/product-design question (should reviews capture a rider-specific rating separately?) rather than a code bug — flagging for a product decision, not fixing here since it would require a schema change and likely a customer-facing review-flow change (customer-web, not audited in this pass) to add a distinct rider rating field.

## Unused/dead fields
None — every field in `RiderPerformanceData` is read and rendered by this screen.

## Loading/error/realtime behavior
Independent `loading`/`refreshing`/`error` state with a clean split between full-screen loading, full-screen error (only when there's no prior data, `error && !data`), and the normal rendered view — no silent-failure pattern here (unlike some other screens in this app), since a failed load simply shows the retryable error screen rather than defaulting to zeroed-out stats. No realtime subscription — appropriate for a stats screen that's only meaningful to refresh manually or via pull-to-refresh.
