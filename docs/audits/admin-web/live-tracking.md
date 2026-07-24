# Audit: Admin-web — Live tracking

Date: 2026-07-22 (dead fields wired up 2026-07-22; delivery SLA added 2026-07-22, see Finding 1)

## Entry point
- Page: `apps/admin-web/src/app/live-tracking/page.tsx` -> `LiveTrackingBoard` (`apps/admin-web/src/components/datacenter/live-tracking-board.tsx`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Initial load + manual "Refresh" + 15s poll + socket reload | GET | `/admin/live-tracking` | `LiveTrackingData` | `AdminController.getLiveTracking` -> `AdminService.getLiveTracking` |

## Backend trace
`AdminService.getLiveTracking` runs 7 queries in parallel: online riders (with location/speed/heading
fields selected directly, no separate profile fetch), total rider count, up to 50 in-transit orders,
all branches with coordinates, today's completed count, an SLA-breached pickup count, and pending-dispatch
count. It then does one more batched round-trip to resolve rider names/contacts for the in-transit orders'
active-leg rider and customer. Bounded and parallelized — reasonable for a 15s-polled live view.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Stat tiles (6): Riders online, Orders in transit, Pending dispatch, Delayed pickups, Completed today, GPS fixes | `stats.*` (5 of 6), client-derived `mappableRiders.length` for "GPS fixes" | "GPS fixes" is the only tile computed client-side (count of `riders[].hasFix`); the rest are server totals. |
| Fleet map | `riders[]` filtered to `hasFix`: `userId`, `name`, `lat`, `lng`, `recordedAt` (via title), plus client-derived `color` (from the rider's active order leg); `branches[]`: `id`, `name`, `code`, `lat`, `lng`, and now `city` (see Unused fields) | Shared `FleetMap` component (also used by control-tower). Rider pin color reflects idle/pickup/delivery via `LEG_COLORS`, driven by whichever `LiveOrder` currently has that rider as `riderUserId`. |
| Live orders table | `orders[]` (filtered by leg + search): `_id`, `bookingType`, `customer`, `riderName`, `branchName`, `status`, `sla.status`/`.label` (both legs), `total` | SLA column now applies to both legs — see Finding 1. |
| Live order detail rail (timeline) | `selectedOrder.timeline[]` (`status`, `timestamp`), `.leg` | Backend caps timeline to the last 5 status-history entries (`admin.service.ts`, `.slice(-5)`) — reasonable for a live-glance view, full history is available via the order detail page link. |
| Rider information rail | `selectedRider`/`selectedOrder` fallback fields: `.name`/`.riderName`, `.vehicleType`, `.plateNumber`, `.riderPhone`, `.shiftStatus`, `.recordedAt`, and now `.speed`/`.heading` (see Unused fields) | Falls back from the selected live order's embedded rider fields when no rider marker is directly selected — lets you get rider info either by clicking a map pin or an orders-table row. |
| Customer rail | `selectedOrder.customer`, `.customerPhone` | Only shown when an order (not just a rider) is selected. |
| Order summary rail | `selectedOrder.bookingType`, `.branchName`, `.createdAt`, `.total` | Full use of remaining order fields. |

## Findings

1. **[FIXED] The live orders table's SLA column only ever populated for pickup-leg rows.**
   The backend only computed `computePickupSla` and only exposed `slaPickupDueAt`; there was no delivery
   SLA concept anywhere in the codebase (`packages/utils/src/sla.ts` had no delivery equivalent), so every
   delivery-leg row rendered a bare "—" regardless of how overdue the delivery actually was. Fix: added
   `computeDeliverySla()` to `packages/utils/src/sla.ts`, mirroring the pickup version — driven by
   `scheduledDeliveryAt`, `deliveryRiderId`, and `order.delivery?.deliveredAt`, with the same 30/60-minute
   warning/breach thresholds as pickup. `AdminService.getLiveTracking` now computes the right SLA per row
   based on `leg` and returns a unified `sla: { status, label }` (replacing the pickup-only
   `slaPickupDueAt` field); the frontend's SLA column and badge tone now work identically for both legs.
   The same 30/60-minute thresholds were chosen by default to match pickup — flag if delivery should use
   different thresholds.

## Unused/dead fields (resolved 2026-07-22)
- `LiveBranch.city` — **wired up**. Now passed through to the shared `FleetMap` component's shop-pin tooltip
  (`fleet-map.tsx`: `FleetMapBranch.city` is optional, title becomes `"Name (CODE) — City"` when present).
  This is a shared component also used by the control-tower page, which independently fetches the same
  unused `city` field on its own branches list — that page gets the same tooltip improvement for free, but
  its own audit should still note the field as previously-dead when it's this page's turn.
- `LiveRider.speed`, `.heading` — **wired up**. Added as "Speed" (converted from the assumed m/s GPS unit to
  km/h) and "Heading" (compass point + degrees) rows in the Rider information rail, shown only when the
  backend actually reports a value for the selected rider.

## Loading/error/realtime behavior
- Loading/error: same shared `useAdminQuery` pattern as the rest of admin-web's ops pages, so a failed
  background reload keeps the last-good view visible under the error banner (fixed during the overview audit,
  [overview.md](overview.md) Finding 1).
- This page layers **two independent refresh mechanisms**: a 15s `setInterval` poll
  (`POLL_INTERVAL_MS`) and the standard `useAdminOperationsSocket` reload-on-event. This is intentional
  redundancy — the poll keeps data fresh even if the realtime socket is down (the "Polling" vs live badge in
  the header reflects exactly this), and isn't wasteful since both paths converge on the same `reload()`
  call rather than each maintaining separate state.
- Search/filter is client-side over `orders`, same as the orders list page, but the risk noted there
  ([orders.md](orders.md)) doesn't really apply here: `orders` is inherently a bounded "currently in transit"
  set (capped at 50 by the backend), not a large ledger being arbitrarily paged through, so client-side
  filtering over the full loaded set is appropriate as-is.
