# Audit: Admin-web — Dispatch board

Date: 2026-07-22 (Finding 1 fixed and dead fields resolved 2026-07-22)

## Entry point
- Page: `apps/admin-web/src/app/dispatch/page.tsx` -> `DispatchBoard` (`apps/admin-web/src/components/datacenter/dispatch-board.tsx`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Initial load + manual "Sync" + socket reload | GET | `/admin/dispatch/dashboard` | `DispatchDashboard` | `AdminController.getDispatchDashboard` -> `AdminDispatchService.getDispatchDashboard` |
| Open "Assign shop" rail | GET | `/admin/dispatch/orders/:orderId/suggestions` | `{ branchEvaluations: BranchEvaluation[] }` | `AdminController.getDispatchSuggestions` -> `BranchesService.getDispatchSuggestions` |
| Confirm shop assignment | POST | `/admin/dispatch/orders/:orderId/assign` | — | `AdminController.assignDispatch` -> `BranchesService.adminDispatchOrder` |
| Realtime | WS | `admin-realtime`, events `dispatchQueueUpdated` / `dispatcherAlert` | `useAdminOperationsSocket` | triggers `reload()`; `dispatcherAlert` also surfaces a dismissible banner (unless `type === 'rider_sos'`) |

## Backend trace
`AdminDispatchService.getDispatchDashboard` runs three independent builders in parallel:
- **Incoming queue**: one `find` over non-terminal orders matching one of three dispatch-need
  conditions (pending shop assignment, needs pickup rider, needs delivery rider), capped at 100,
  then batch-resolves customer and pickup-address labels. Computes a `priority` per row (1 = pending
  shop assignment, 2 = ready for delivery, 3 = other) and stable-sorts the final rows by it — see
  Finding 1 (fixed).
- **Shop capacity**: delegates to `BranchesService.getShopCapacityBoard()` (not re-traced here).
- **Rider board**: one `find` over all riders plus a batched active-orders lookup, deriving each
  rider's `boardStatus` (Available/Pickup/Delivery/Offline) client-visible label server-side.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| State banner | `counts` (all four), `overCapacityShops` (client-derived from `shopCapacityBoard[].isOverCapacity`) | `deriveDispatchState()` — over-capacity always wins as "critical", otherwise any nonzero count is "attention". |
| Stat tiles (5): Incoming queue, Need shop, Need pickup rider, Need delivery rider, Riders available | `counts.incoming/needsShop/needsPickupRider/needsDeliveryRider`, client-derived `availableRiders` (from `riderBoard[].boardStatus === 'Available'`) | "Riders available" tile turns rose-toned when `availableRiders === 0 && backlogTotal > 0` — a genuinely useful cross-field signal (backlog exists but nobody's free to work it). |
| Live dispatcher alert | socket-pushed `DispatcherAlert` (`message`, `orderId`, `type`) — not part of the fetched payload | Suppressed for `type === 'rider_sos'` (SOS presumably has its own dedicated UI elsewhere); dismissible, but a *new* alert while one is showing just overwrites `liveAlert`, so a dismissed/overwritten alert can't be "missed" — acceptable for a live ops banner. |
| Incoming orders queue (table) | `incomingOrders[]`: `orderId`, `orderLabel`, `branchName`, `customer`, `area`, `weightKg`, `scheduledPickupAt`, `status`/`statusLabel`, `canAssignShop`, `awaitingPartnerAccept`, `canAssignPickupRider`, `canAssignDeliveryRider` | Row order now reflects triage `priority` (fixed, see Finding 1); `scheduledPickupAt` renders as a sub-line under the weight column. |
| Assign-shop rail | `evaluations[]` (`BranchEvaluation`: `branchId`, `code`, `name`, `distanceLabel`, `recommendationScore`, `isRecommended`, `qualified`, `estimatedTurnaroundLabel`, `capacity.utilizationPercent`, `performance.label`, `availability.acceptingOrders/label`) | Fetched on-demand per order (not part of the dashboard payload); full use of every field returned by `getDispatchSuggestions`. |
| Shop capacity panel | `shopCapacityBoard[]`: `shop`, `code`, `currentLoadKg`, `capacityKg`, `utilizationPercent`, `isOverCapacity` | `branchId` used only as the list key. Full field usage otherwise. |
| Rider board panel | `riderBoard[]`: `riderId` (key), `rider`, `isOnline`, `activeOrderId`, `boardStatus`, `vehicleType` | `vehicleType` now rendered next to the rider's name (fixed, see Unused/dead fields). |

## Findings

1. **[FIXED] The backend computed a dispatch `priority` per incoming order, but nothing used it to
   order the queue.**
   `AdminDispatchService.buildIncomingOrdersQueue` (admin-dispatch.service.ts) attaches
   `priority: this.incomingPriority(order.status)` to every row — 1 for orders needing shop assignment,
   2 for ready-for-delivery orders needing a rider, 3 for everything else. The query itself only sorted
   by `createdAt` ascending, so a ready-for-delivery order needing an urgent rider could sit below older,
   less time-sensitive pending-shop-assignment orders in the visible queue. Fix: the service now
   stable-sorts the mapped rows by `priority` before returning them (ties keep their original
   oldest-first order), so the queue is triage-ordered by default; `priority` itself is stripped back out
   of the response since ordering is now expressed through array position, not a client-visible field.

## Unused/dead fields (resolved 2026-07-22)
- `RiderBoardRow.userId`, `activeOrderStatus` — **removed** (backend and frontend). Neither had a
  consumer; `boardStatus` already communicates the rider's current activity.
- `vehicleType` — **wired up**. Now rendered next to the rider's name in the rider board panel,
  matching the vehicle-type display pattern already used in `RiderMiniCard` on the order-detail page.
- `bookingType`, `partnerAcceptedAt` (incoming orders) — **removed**. `bookingType` had no consumer;
  `partnerAcceptedAt` was redundant with the already-returned, already-used `awaitingPartnerAccept` flag.
- `scheduledPickupAt` (incoming orders) — **wired up**. Now shown as a sub-line under the weight
  column in the queue table, mirroring the "Schedule" column pattern on the orders list page.

## Loading/error/realtime behavior
- Loading/error: same shared `useAdminQuery` pattern as the other admin-web ops pages, so it already has
  the fixed reload-keeps-stale-data behavior from the overview audit ([overview.md](overview.md), Finding 1).
- Empty states: incoming queue has a proper `EmptyState`; shop capacity and rider board panels have their
  own inline empty-state text — consistent with the rest of admin-web.
- Realtime: standard `useAdminOperationsSocket` usage; `dispatcherAlert` additionally drives the dismissible
  live-alert banner (separate from the reload it also triggers) — this is the first page in this audit series
  where a socket event both refetches data *and* independently updates local UI state, and it does so cleanly
  (no double-render issue — `setLiveAlert` and `reload()` are independent state updates).
