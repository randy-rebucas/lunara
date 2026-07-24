# Audit: Admin-web — Control tower

Date: 2026-07-22 (Finding 1 fixed, `recordedAt` wired up, and map staleness gap fixed 2026-07-22)

## Entry point
- Page: `apps/admin-web/src/app/control-tower/page.tsx` -> `ControlTowerBoard` (`apps/admin-web/src/components/datacenter/control-tower-board.tsx`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Initial load + manual "Sync" + socket reload | GET | `/admin/control-tower` | `ControlTowerData` | `AdminController.getControlTower` -> `AdminOperationsService.getControlTower` |
| Fleet map data (separate, independent `useAdminQuery`) | GET | `/admin/live-tracking` | `LiveMapData` (a narrower local type over the same payload as the live-tracking page's `LiveTrackingData`) | `AdminController.getLiveTracking` -> `AdminService.getLiveTracking` |
| Realtime | WS | `admin-realtime`, events `dispatchQueueUpdated` / `dispatcherAlert` | `useAdminOperationsSocket` | triggers `reload()` of both the control-tower data and the map query (fixed, see Loading/error/realtime); the map query also now polls independently every 15s as a fallback. |

## Backend trace
`AdminOperationsService.getControlTower` runs 7 count queries in parallel for the top-line counts, then a
separate bounded `find` (limit 25, sorted by `scheduledPickupAt`) for the watchlist, serialized through the
same `serializeOpsOrder()` helper the order-detail page uses (see Findings — this had a leg-blind SLA bug,
now fixed). `buildTodayPulse()` is a second, heavier private method: 8 more parallel queries (today/yesterday
created + completed windows, active-now count, rider/branch totals, today's collected pickups for SLA
punctuality, and a `$lookup`-based aggregate grouping today's orders by branch city) followed by in-memory
bucketing into hourly/status/service/area breakdowns. All windowed to "since yesterday" or "today", so this
stays bounded regardless of total order volume.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Ops state banner | `counts.slaBreaches`, `.conflicts`, `.pendingDispatch` | `deriveOpsState()` — breaches/conflicts always win as "critical", any other nonzero count is "attention". Same pattern as every other admin-web ops page. |
| Stat tiles (6): Orders today, In progress now, Completed today, Active riders, Laundry shops, Pickup on-time | `pulse.today.orders/.ordersDelta/.completed/.completedDelta/.inProgressNow`, `.ridersOnline`, `.totalRiders`, `.totalBranches`, `.pickupPerformance.onTimeRate/.measured` | Full use of every `pulse.today`/top-level pulse field surfaced here. |
| Live operations map | `mapQuery.data.riders[]` filtered to `hasFix`: `userId`, `name`, `lat`, `lng`, and now `recordedAt` (see Unused fields); `.branches[]`: `id`, `name`, `code`, `lat`, `lng`, `city` (via shared `FleetMap`, see below); `.orders[]`: `riderUserId`, `leg` (client-joined to color the pins) | Independently fetched from `/admin/live-tracking` rather than being part of `ControlTowerData` — a second `useAdminQuery` (`mapQuery`), not tied to the same reload/socket cycle as the rest of the page (see Loading/error/realtime). |
| Order status donut | `pulse.statusBreakdownToday[]`, `pulse.today.orders` (center value) | Client-side color map (`STATUS_COLORS`) keyed to the backend's bucket keys, same pattern/risk as the overview dashboard's donut (manual sync required if buckets change). |
| System alerts panel | Derived client-side by `buildAlerts()` from `counts.*` and `pulse.ridersOnline`/`.totalRiders` — not a distinct payload | Fully client-computed prioritized alert list (SLA/conflicts first, capped at 6, falls back to an "All systems operational" entry when empty). No dead backend fields here since nothing extra is fetched for it. |
| Orders-over-time chart | `pulse.hourly[]` (`today`, `yesterday`) | Full use. |
| Top shops panel | `pulse.topShopsToday[]` (`name`, `orders`, `revenue`) | Backend pre-sorts and caps to top 5. |
| Pickup performance panel | `pulse.pickupPerformance.measured/.onTime/.late/.onTimeRate/.avgDelayMin` | Full use — this panel is explicitly pickup-only by design (there's no separate delivery-punctuality panel; the leg-blind SLA bug fixed below was about the watchlist table, not this panel). |
| Order volume by area | `pulse.areasToday[]` (`area`, `orders`), client-derived `maxArea` for bar scaling | Full use. |
| Revenue overview | `pulse.today.revenue/.revenueDelta/.completed/.avgOrderValue`, `pulse.hourly[].revenueToday` | Full use. |
| Top services donut | `pulse.topServicesToday[]` (`service`, `count`), sliced to top 5 client-side | Backend returns the full sorted list; frontend caps it to 5 for the donut only (the `service` label list beneath the donut is the same 5, not the full set) — a minor, harmless over-fetch of the tail entries. |
| Priority watchlist table | `watchlist[]`: `_id`, `bookingType`, `branchName`, `dispatchStatus`/`status`, `operationsConflict`, `sla.status`/`.label`, `total` | See Findings (SLA fix) and Unused fields (this row is serialized through a much richer shared helper than the table needs). |

## Findings

1. **[FIXED] The watchlist's SLA column used the leg-blind `computePickupSla` for every row, including
   the shared `serializeOpsOrder()` helper that also backs the order-detail ops page.**
   This mirrors the bug already fixed on the live-tracking page ([live-tracking.md](live-tracking.md),
   Finding 1): `AdminOperationsService.serializeOpsOrder()` only ever called `computePickupSla`, so any
   order already on its delivery leg (`rider_assigned_delivery` / `out_for_delivery`) would show a stale
   "Pickup on track"-style label instead of a real delivery-timeliness read. For the control-tower
   watchlist specifically this had no visible effect today, since the watchlist query only ever includes
   orders still awaiting shop assignment, partner accept, or delivery-rider assignment — never orders
   already mid-delivery. But `serializeOpsOrder()` is the same function the **order-detail ops page**
   (`/orders/[id]`) uses for its header/banner SLA state, and that page does render delivery-leg orders, so
   the same order shown there previously carried the wrong SLA read. Fix: `serializeOpsOrder()` now checks
   whether the order is on its delivery leg and calls the new `computeDeliverySla()` (added during the
   live-tracking fix) instead, matching the per-leg logic already used elsewhere.

## Unused/dead fields
- `LiveMapData.riders[].recordedAt` — **[WIRED UP 2026-07-22]** was typed and fetched but never read; now
  used to build a `title` tooltip on each map pin (`"{name} — {time ago}"`), matching the pattern already
  used on the live-tracking page's own fleet map.
- `LiveMapData.branches[].city` — already resolved for free by the live-tracking audit's fix to the shared
  `FleetMap` component ([live-tracking.md](live-tracking.md)): `FleetMapBranch.city` is now optional and
  rendered in the shop-pin tooltip, so this page's branches (which already carried `city`) picked up the
  same improvement without any change needed here.
- **Watchlist over-fetch (not fixed, by design)**: `serializeOpsOrder()` returns far more than the watchlist
  table uses — `branchCode`, `partnerAcceptedAt`, `pickupRequestedAt`, `deliveryRequestedAt`, `pickupRiderId`,
  `deliveryRiderId`, `scheduledPickupAt`, `operationsConflictNote`, and the full payment-summary spread
  (method/status/amount/receipt/paidAt/cash fields) are all serialized per watchlist row but the frontend
  `ControlTowerData['watchlist']` type only declares `_id`, `status`, `bookingType`, `total`, `branchName`,
  `dispatchStatus`, `operationsConflict`, `sla`. This is a deliberate reuse trade-off — `serializeOpsOrder()`
  is shared with the order-detail ops page, which does need all of those fields — rather than a bug; a
  dedicated slimmer watchlist serializer would save payload size but duplicate logic. Not changed here.

## Loading/error/realtime behavior
- Loading/error: same shared `useAdminQuery` pattern as the rest of admin-web, so a failed background reload
  keeps the last-good view visible under the error banner (fixed during the overview audit,
  [overview.md](overview.md) Finding 1). This applies independently to both of this page's queries (`data`
  and `mapQuery`).
- **[FIXED] The fleet map's data query (`mapQuery`) was not connected to this page's socket subscription
  and had no polling fallback**, unlike the live-tracking page (which both polls every 15s and reloads on
  socket events). `useAdminOperationsSocket`'s `onDispatchQueueUpdated`/`onDispatcherAlert` handlers now
  call `mapQuery.reload()` alongside the existing `reload()`, and a new `MAP_POLL_INTERVAL_MS` (15s)
  `setInterval` polls `mapQuery.reload()` independently as a fallback if the socket is down — matching the
  live-tracking page's refresh pattern exactly. Rider positions on this page's embedded map now stay live
  instead of only refreshing on initial load or a manual full-page refresh.
