# Audit: rider-mobile — Performance

Date: 2026-09-02

## Entry point
- Page: `apps/rider-mobile/app/performance.tsx` (`PerformanceScreen`) — client component, single self-contained screen.
- Component(s): `RingMeter` and `StatRow` (local to `performance.tsx`).

## Sub-pages
None — no outbound navigation into a detail route. The screen is a terminal read-only stats view.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Performance stats | GET | `/riders/performance` | `RiderPerformanceData` | `RidersController.getPerformance` → `RidersService.getPerformance` → `buildRiderPerformancePayload` |

Response envelope is `{ success: true, data: {...} }`; unwrapped by `authRequest` (`apps/rider-mobile/src/store/auth.ts:41`), so `riderFetch<RiderPerformanceData>` receiving the bare object is correct.

## Backend trace
`RidersService.getPerformance` (`apps/api/src/modules/riders/riders.service.ts:890`) delegates entirely to `buildRiderPerformancePayload` (`apps/api/src/modules/riders/rider-performance.ts`), which runs 10 queries in parallel via `Promise.all`:
- `completedPickups`/`completedDeliveries` → summed into `completedTasks`.
- `cancelledTasks` → orders where either rider id matches and `status === CANCELLED`.
- `acceptedPickups`/`acceptedDeliveries` → summed into `acceptedAssignments`.
- `totalPickupAssignments`/`totalDeliveryAssignments` → summed into `totalAssignments`.
- `onTimeDeliveries` → delivered orders where `delivery.deliveredAt <= scheduledDeliveryAt` (via `$expr`).
- `deliveriesWithSchedule` → delivered orders that actually had a `scheduledDeliveryAt` and `delivery.deliveredAt` at all (the correct denominator for on-time rate — deliveries with no schedule can't be "on time" or "late").
- `ratedOrders` → `_id`-only projection of this rider's completed deliveries, used as the candidate set for a review lookup.

Rates are computed by `pct(numerator, denominator)` (`rider-performance.ts:19`): `Math.round((n/d)*1000)/10`, and **returns `100` when `denominator <= 0`** — i.e., a brand-new rider with zero completed/cancelled tasks, zero assignments, or zero scheduled deliveries shows 100% on that metric rather than an undefined/N/A state. This is intentional (avoids a "0%" that reads as a failing score for someone who simply hasn't worked yet), but the frontend previously displayed that 100% at face value with no way to distinguish "actually 100%" from "no data yet" — see Findings #1.

Customer rating: only queried if `ratedOrders.length > 0`, aggregating reviews by `$in` on those order ids for `avg`/`count`. Comment in the code correctly warns future editors that `ratedDeliveries` must come from the aggregate's own `count`, not `ratedOrders.length` (the candidate set, not the actual review count) — no bug here, just noting it was deliberately guarded against.

No N+1s — all 10 counts/finds run in parallel, and the review aggregation is a single `$match`+`$group` over an `$in` list rather than per-order lookups.

## Cards / panels
Render order top to bottom:

| Card | Fields consumed | Notes |
|---|---|---|
| Page header | (static copy) | No data. |
| Completion rate `RingMeter` | `completionRate`, plus `completedTasks`+`cancelledTasks` (client-side, added post-fix) | Client-derives a `hasCompletionData` gate to show `—` instead of the backend's zero-denominator `100%` (see Findings #1 / Fix). Color (`accentDark`/`accentLight`) is a static per-card constant, not a value-based threshold — no magic-number color map to keep in sync. |
| Acceptance rate `RingMeter` | `acceptanceRate`, plus `totalAssignments` (client-side, added post-fix) | Same `—` gate as above, using `hasAssignmentData`. |
| On-time delivery `RingMeter` | `onTimeDeliveryRate` | Same zero-denominator ambiguity exists here (see Findings #2) but the frontend has no field to gate on — `deliveriesWithSchedule` (the actual denominator) isn't returned by the API. Left unfixed, see Findings #2. |
| Customer rating `RingMeter` | `customerRating` (formatted `.toFixed(1)` + `/ 5`, or `—` if `null`), `ratedDeliveries` (as the `hint` sub-label, "N rated deliveries" / "No ratings yet") | Correctly handles its own null case already — `customerRating` is nullable in the type and the component branches on `!= null` before formatting. This was the one metric that already avoided the "misleading 100%" class of bug, since `null` (not `0`/`100`) is what the backend sends when there are no reviews. |
| "ACTIVITY SUMMARY" section label | (static copy) | No data. |
| Completed tasks `StatRow` | `completedTasks` | Plain count, no derivation. |
| Cancelled tasks `StatRow` | `cancelledTasks` | Color-derived: `colors.destructive` if `cancelledTasks` truthy, else muted — a simple boolean threshold, not a magic-number range, low risk. |
| Accepted assignments `StatRow` | `acceptedAssignments`, `totalAssignments` (formatted `"X of Y"`) | Both fields already surfaced elsewhere (acceptance rate uses the same two), consistent. |
| On-time deliveries `StatRow` | `onTimeDeliveries` | Raw count only; the corresponding "out of how many scheduled" denominator is never shown anywhere on the page, unlike accepted assignments' "X of Y" — see Findings #2. |

## Mutations
None — read-only stats screen, no create/update/delete/toggle actions.

## Authorization
No role-scoped access concerns. `@Roles(UserRole.RIDER)` guards `GET /riders/performance` (`riders.controller.ts:481`), and the rider identity comes from `req.user.sub` — no request parameter exists that could target another rider's stats. No `[authz]` findings.

## Findings

1. **Zero-denominator rates displayed as a misleading 100%.** The backend's `pct()` helper (`rider-performance.ts:19`) intentionally returns `100` for a `0/0` rate so a brand-new rider doesn't see a discouraging "0%" — but the frontend rendered `completionRate`/`acceptanceRate` at face value with no way to tell "genuinely 100%" apart from "no data yet," which reads as an earned perfect score for someone who hasn't done anything.
   **Fix:** `performance.tsx` now derives `hasCompletionData` (`completedTasks + cancelledTasks > 0`) and `hasAssignmentData` (`totalAssignments > 0`) from fields already in the payload, and renders `—` instead of the rate when the relevant count is zero. Typechecked clean (`npx tsc --noEmit -p apps/rider-mobile/tsconfig.json` shows no errors in `performance.tsx`).

2. **Same zero-denominator ambiguity exists for `onTimeDeliveryRate`, but is not fixable frontend-only.** The backend's real denominator for this rate is `deliveriesWithSchedule` (delivered orders that had both a `scheduledDeliveryAt` and a `delivery.deliveredAt`) — but `RiderPerformancePayload`/`RiderPerformanceData` never returns that count, only the numerator (`onTimeDeliveries`). The frontend has no reliable field to gate the `—` fallback on (`completedTasks` includes pickups and deliveries with no schedule at all, so it's not an equivalent proxy).
   **Fix: left unfixed** — needs a backend/type contract change (adding a `scheduledDeliveries` or `deliveriesWithSchedule` field to `RiderPerformancePayload` and `RiderPerformanceData`) rather than a frontend-only fix, which is a product/API-contract decision out of this pass's scope.

3. **On-time deliveries `StatRow` shows a bare count with no denominator, inconsistent with the accepted-assignments row right above it.** `accepted assignments` renders `"X of Y"` (`acceptedAssignments` of `totalAssignments`) but `on-time deliveries` renders only `onTimeDeliveries` alone (`performance.tsx`, `StatRow` for on-time deliveries) — a rider can't tell if "3 on-time deliveries" is 3-of-3 or 3-of-30 from this row.
   **Fix: left unfixed** — same root cause as Findings #2 (the "of Y" denominator, `deliveriesWithSchedule`, isn't returned by the API), so fixing this display gap requires the same backend contract change; bundling it with #2 rather than a separate ad-hoc fix.

## Unused/dead fields
None. Every field in `RiderPerformanceData` (`completionRate`, `acceptanceRate`, `onTimeDeliveryRate`, `customerRating`, `completedTasks`, `cancelledTasks`, `acceptedAssignments`, `totalAssignments`, `onTimeDeliveries`, `ratedDeliveries`) is read somewhere on the page. No PII or sensitive data is returned — all fields are aggregate counts/rates for the requesting rider's own performance.

## Loading/error/realtime behavior
- Own `useState`-based `loading`/`error`/`data` triple with a `load()` callback, matching the same shape as `tasks.tsx`'s pattern (not sharing a hook, but structurally consistent).
- Initial load: `loading && !data` renders `DataLoadState` in loading mode.
- Error with no prior data: `error && !data` renders `DataLoadState` in error mode with a retry (`onRetry={load}`).
- Error after a successful prior load (e.g. a failed pull-to-refresh) does **not** wipe `data` — `load()` only calls `setData(null)` inside the `catch`, so on the initial call an error clears to `null` correctly, but a subsequent refresh error leaves the previously-shown numbers stale on screen with the error state not surfaced (since `error && !data` requires `data` to be falsy to render the error UI, and refresh's `catch` already set `data` to `null` too — so a refresh failure does in fact drop back to the full error screen, discarding the last-known-good numbers rather than keeping them visible with a toast/banner). This matches the same tradeoff already used by every other `riderFetch`-based screen in this app (e.g. `tasks.tsx`'s own live-task loads silently reset to `[]` on error) — a systemic pattern, not unique to this page, so not flagged as a one-off finding; changing it would mean deciding a new stale-data-on-error UX convention for the whole app, out of scope for a single-page pass.
- Refresh: pull-to-refresh (`onRefresh`, `performance.tsx:146`) sets `refreshing` and calls the same `load()`, correctly scoped to this screen only.
- No realtime/socket subscription — appropriate, this is a point-in-time aggregate stats screen with an explicit pull-to-refresh, not a live feed.
