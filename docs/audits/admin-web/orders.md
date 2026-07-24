# Audit: Admin-web — Orders (list) & Order detail (ops)

Date: 2026-07-22 (findings 1 and 2 fixed 2026-07-22; dead-field cleanup 2026-07-22; SLA fix 2026-07-22, see below)

**Update (control-tower audit, 2026-07-22):** the order-detail page's SLA badge/label (`OpsOrder.sla`,
sourced from `AdminOperationsService.serializeOpsOrder()`) previously used the leg-blind `computePickupSla`
for every order, including ones already on their delivery leg — so a delivery-in-progress order could show
a stale "Pickup on track" read instead of real delivery timeliness. Fixed alongside the control-tower audit
by making `serializeOpsOrder()` branch on the order's leg and call the new `computeDeliverySla()` for
delivery-leg orders. See [control-tower.md](control-tower.md), Finding 1, and [live-tracking.md](live-tracking.md),
Finding 1, for the original fix this mirrors.

## Entry point
- List page: `apps/admin-web/src/app/orders/page.tsx` -> `OrdersBoard` (`apps/admin-web/src/components/datacenter/orders-board.tsx`)
- Detail page: `apps/admin-web/src/app/orders/[id]/page.tsx` (`AdminOrderOpsPage`, all UI inline — no separate board component)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Orders list load + tab/limit change + manual "Sync" + socket reload | GET | `/admin/orders?status=<group>&limit=<n>` | `{ items: OrderRow[]; statusCounts: Record<string, number> }` | `AdminController.getOrders` -> `AdminService.getOrders` |
| Order detail load + manual "Sync" + socket reload (scoped to this order) | GET | `/admin/operations/orders/:orderId` | `OpsData` | `AdminController.getOrderOperations` -> `AdminOperationsService.getOrderOperations` |
| Rider mini-card (pickup/delivery, lazy per-card) | GET | `/admin/riders/:riderId/profile` | `RiderProfile` | (rider profile endpoint, not traced here) |
| Auto-suggest pickup/delivery rider | GET | `/admin/operations/orders/:orderId/suggest-pickup-rider` / `suggest-delivery-rider` | `{ suggestedRiderId: string \| null }` | `AdminOperationsService.suggestPickupRider` / `suggestDeliveryRider` |
| Confirm / assign / reassign rider, dispatch pickup, flag/resolve conflict | POST | `/admin/operations/orders/:orderId/...` | — | `AdminOperationsService` (various) |
| Mark / complete customer pickup | POST | `/orders/:id/customer-pickup`, `/orders/:id/customer-pickup/complete` | — | `OrdersController.markCustomerPickup` / `completeCustomerPickup` (note: this is the **`orders`** controller, not `admin/orders` — a different, ADMIN/PARTNER/STAFF-role-gated controller than the rest of this page's calls, but correct/intentional) |

## Backend trace
- **`AdminService.getOrders`**: single `find(filter).sort({updatedAt:-1}).limit(limit)` scoped by the tab's status group (or none for "all"), plus batched lookups for customer email/phone, rider display names, and latest payment per order. `statusCounts` is a **separate, unfiltered** `$group` aggregate over the entire `orders` collection (`orderStatusCounts()`, admin.service.ts:1355-1360) — it always reflects true all-time totals regardless of the active tab or `limit`, which is why the stat tiles/tab counts can be larger than the number of rows actually loaded into the table.
- **`AdminOperationsService.getOrderOperations`**: single `findById`, conditionally calls into `RiderAssignmentService.suggestPickupRider`/`suggestDeliveryRider` only when the order is actually in a state where that assignment is applicable (avoids wasted ranking work), then a bounded `find({isOnline:true}).limit(30)` for the general "available riders" fallback list. Reasonable and well-scoped.

## Cards / panels

### Orders list (`OrdersBoard`)
| Card | Fields consumed | Notes |
|---|---|---|
| Pipeline banner | `statusCounts.pending_dispatch`, client-computed `conflictsInLoad`/`slaBreachesInLoad` (from `items[].operationsConflict`/`slaStatus`) | State derived by `derivePipelineState()`; conflict/SLA counts are **only over the currently loaded page** (`items`), not all-time — banner can under-report if the offending orders aren't in the current tab/limit window. |
| Stat tiles (Total/Completed/In progress/Scheduled/Cancelled) | `statusCounts` (all-time, all statuses) via `groupCount()` | All-time truth regardless of tab/limit; clicking a tile also switches `tab`. |
| Tabs | `statusCounts` per tab's status group | Same all-time counts as the tiles. |
| Orders table | `items[]`: `_id`, `createdAt`, `customerEmail`, `customerPhone`, `bookingType`, `bagSizeLabel`/`estimatedWeightKg`, `scheduledPickupAt`, `scheduledDeliveryAt`, `total`, `paymentStatus`, `status`, `operationsConflict`, `slaStatus`/`slaLabel` | Rows are also client-filtered by `search` (see Finding 3 — search only covers the loaded window). |
| Detail rail (row click) | `selected` = the clicked `OrderRow` from `items`; renders `subtotal`, `deliveryFee`, `discount`, `total`, payment method/status/paidAt/receiptCode | Pure client-side selection, no extra fetch — reuses the row's already-fetched fields. |

### Order detail (`AdminOrderOpsPage`)
| Card | Fields consumed | Notes |
|---|---|---|
| Header + pipeline state banner | `order.status`, `.fulfillmentType`, `.operationsConflict`, `.sla`, `.branchName` | State derived by `deriveOrderOpsState()`, same nominal/attention/critical pattern as the other admin-web pages. |
| Metric row (Pipeline/Shop/Partner/Riders) | `order.status`, `.branchName`, `.partnerAcceptedAt`, `.pickupRiderId`, `.deliveryRiderId`, client-derived `awaitingPartnerAccept`/`canAssignPickup`/`canAssignDelivery` | All client-derived from raw order fields, no server-precomputed flags. |
| Order details panel | `order.bookingType`, `.branchName`, `.sla.label`, `.partnerAcceptedAt`, `.pickupRequestedAt`, `customer.email`/`.phone`, then a Payment sub-section: `.paymentMethod`, `.paymentStatus`, `.paymentAmount`, `.cashTiming`, `.paymentReceiptCode`, `.paymentPaidAt`, `.cashCollectedBy` (renders a `RiderMiniCard` if it looks like an ObjectId, else raw text) | Full use of the order payment fields. |
| Fulfillment & riders panel (pickup / delivery / customer self-pickup) | `order.pickupRiderId`/`.deliveryRiderId`, `data.pickupRiderSuggestions`/`.deliveryRiderSuggestions`, `data.suggestedPickupRiderId`/`.suggestedDeliveryRiderId`, `order.customerPickupAt`, `.fulfillmentType` | Drives `RiderMiniCard` (separate per-rider fetch) or the suggest/confirm action buttons depending on order state. |
| Manual assignment panel | `data.pickupRiderSuggestions`/`.deliveryRiderSuggestions`, `data.availableRiders`, `data.suggestedPickupRiderId`/`.suggestedDeliveryRiderId` | See Findings 1 and 2 (fixed) — the rider `<select>` had a stale default-value bug and duplicate-option bug here. |
| Conflicts panel | `order.operationsConflict`, `.operationsConflictNote` | Write-only otherwise (flag/resolve inputs), no other read fields. |

## Findings (fixed)

1. **[FIXED] Manual-assignment rider dropdown defaulted to the wrong suggested rider when set to "Delivery".**
   `apps/admin-web/src/app/orders/[id]/page.tsx` (select `value=`, previously line 602) always fell back to
   `data.suggestedPickupRiderId`, even when `assignType === 'delivery'` — so switching the "Type" selector to
   Delivery could preselect a pickup rider's id (or select nothing matching, since the ids differ) instead of
   `data.suggestedDeliveryRiderId`. Fix: the fallback now branches on `assignType`, matching the pattern already
   used correctly elsewhere on the same page (e.g. the "Confirm suggested" button body).

2. **[FIXED] Manual-assignment rider dropdown rendered duplicate `<option>`s for riders present in both the
   suggestions list and the general available-riders list.**
   The `<select>` concatenated `pickupRiderSuggestions/deliveryRiderSuggestions.suggestions` (ranked candidates,
   drawn from up to 50 riders regardless of online status, per `RiderAssignmentService.suggestPickupRider`) with
   `data.availableRiders` (all online riders, up to 30, per `AdminOperationsService.getOrderOperations`) with no
   deduplication. Any rider appearing in both — common, since suggestions favor online/nearby riders — showed up
   twice in the dropdown with two `<option key={id}>` elements sharing the same key (React duplicate-key warning)
   and a genuinely confusing double entry for the admin picking a rider. Fix: available-riders are now filtered
   to exclude any id already present in the active suggestion list before rendering.

## Unused/dead fields (resolved 2026-07-22)
- **Orders list**: `OrderRow.updatedAt`, `customerId`, `partnerId` — **removed** from both the backend
  `AdminService.getOrders` mapping and the frontend `OrderRow` type. None had a consumer (`createdAt`
  already covers the "when" column; email/phone already cover customer identity; branch name already
  covers shop identity), so they were dropped rather than wired up.
- **Orders list**: `dispatchStatus` — **wired up**. The backend now also returns `partnerAcceptedAt`
  alongside the existing `dispatchStatus`, and the orders table/detail rail compute the same
  `awaitingPartnerAccept` flag the order-detail and dispatch-board pages already use, rendering an
  "Awaiting partner" badge next to the status badge (`orders-board.tsx`, `isAwaitingPartnerAccept()`).
  Admins reviewing the full ledger can now see this without opening dispatch or the per-order page.
- **Order detail**: `awaitingDeliveryDispatchAt` (admin-operations.service.ts:350) is still returned by
  `getOrderOperations` but not read by the frontend. Left as-is — unlike the list-page fields above, there's
  no existing "awaiting X" pattern on this page it maps cleanly onto yet; revisit if/when delivery-dispatch
  status becomes visible elsewhere on this page.

## Loading/error/realtime behavior
- **Orders list**: uses the same `useAdminQuery`/`useAdminOperationsSocket` pattern as the overview page, so it
  already benefits from the shared reload-no-longer-clears-`data` fix made during the overview audit
  ([overview.md](overview.md), Finding 1) — a failed background reload here also now keeps the table visible
  under the error banner instead of blanking it.
- **Orders list search is client-side only, scoped to the currently loaded page.** `filterBySearch` (list-controls)
  runs against `items`, which is capped by the `limit` control (25/50/100/200) and the active tab's status filter.
  An order outside that window (e.g. older than the most recent `limit` orders in the current tab) will not be
  found by search even if it exists — the search box reads as a general order search but is actually "search
  within what's currently on screen." Not fixed here: making it a real server-side search is a bigger backend
  change (new query param + index) beyond this page-level audit's scope; flagging it as a known limitation.
- **Order detail**: same shared hook, same fixed reload behavior. The page fully gates on `loading || loadError ||
  !data` (returns just a status indicator) rather than layering an error banner over stale content — reasonable
  here since acting on a stale/wrong order's ops state (assign a rider, flag a conflict) is riskier than an
  overview dashboard showing slightly-stale stats, so blocking on error is the safer choice for this page and was
  left as-is.
- **Realtime**: both pages use `useAdminOperationsSocket` the same way as the overview page (ref-backed handlers,
  single subscription). The order-detail page additionally filters `onDispatcherAlert` to only reload when
  `alert.orderId === id`, correctly scoping the refetch to the order being viewed.
