# Audit: Rider-mobile — Home (dashboard + pickup/delivery task flow)

Date: 2026-07-24

## Entry point
- Page: `apps/rider-mobile/app/(tabs)/index.tsx`
- Component(s): `src/components/active-assignment-card.tsx`, `src/components/compliance-banner.tsx`, `src/components/offline-banner.tsx`, `src/components/ui/location-permission-banner.tsx`, `src/components/ui/shift-panel.tsx`, `src/components/route-guide-carousel.tsx`
- Data comes from `src/context/rider-operations.tsx` (`RiderOperationsProvider`), a client context wrapping the whole rider app, not a page-local fetch.

## Sub-pages

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `app/pickup/[id].tsx` | `acceptPickupOffer` (accepts then navigates), `openTask` for pickup-leg statuses — `rider-operations.tsx:323-327, 338-349` | `offer._id` / `activeAssignment.orderId` → route `id` | yes — fetches `GET /riders/pickup-tasks/:id` keyed by the same order id |
| `app/delivery/[id].tsx` | `previewDeliveryQueue`, `openTask` for delivery-leg statuses — `rider-operations.tsx:329-336, 338-349` | `offer._id` / `activeAssignment.orderId` → route `id` | yes — fetches `GET /riders/delivery-tasks/:id` keyed by the same order id |
| `app/(tabs)/tasks.tsx` | "See all" link — `(tabs)/index.tsx:465` | none (own screen) | out of scope — own list screen, not a detail view, not audited here |
| `app/earnings.tsx` | "View earnings history" link — `(tabs)/index.tsx:423` | none | out of scope — separate deep feature (its own history/breakdown), not a thin detail view; would warrant its own audit doc |

**Pickup detail (`pickup/[id].tsx`)**: fetches the full task payload (`GET /riders/pickup-tasks/:id`) rather than re-requesting fields the home screen already had — the home screen only ever had summary offer fields (`_id, status, bookingType, scheduledPickupAt, pickupAddress`), so nothing is redundantly re-fetched. It has its own load/error/offline-cache handling (`loadTaskWithCache`, distinct from the home context's `onRefresh`) and its own realtime hook (`useRiderOrderSocket(id, load)`), independent of the home screen's dispatch socket. See Findings for a param/authorization note.

**Delivery detail (`delivery/[id].tsx`)**: same pattern — fetches `GET /riders/delivery-tasks/:id`, own `loadTaskWithCache` + `useRiderOrderSocket`. Note `previewDeliveryQueue` (the handler invoked from the home screen's delivery offer card) does **not** call an accept endpoint before navigating — it just shows an informational alert and pushes to the detail route. This matches backend behavior: delivery offers are dispatch-assigned, not rider-claimed, and the detail screen correctly shows an "Awaiting Lunara assignment" banner (`delivery/[id].tsx:377-387`) until `deliveryRiderId` is actually set server-side.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Rider profile | GET | `/riders/me` | `RiderMe` | `RidersController.getMe` → `RidersService.getMe` |
| Pickup offer pool | GET | `/riders/pickup-offers` | `PickupOffer[]` | `RidersController.getPickupOffers` → `PickupService.getPickupOffers` |
| Delivery offer pool | GET | `/riders/delivery-offers` | `DeliveryOffer[]` | `RidersController.getDeliveryOffers` → `DeliveryService.getDeliveryOffers` |
| Active tasks | GET | `/riders/tasks` | `Task[]` | `RidersController.getTasks` → `RidersService.getTasks` |
| Active assignment | GET | `/riders/active-assignment` | `ActiveAssignment \| null` | `RidersController.getActiveAssignment` → `RidersService.getActiveAssignment` |
| Earnings summary | GET | `/riders/earnings` | `EarningsData` | `RidersController.getEarnings` → `RidersService.getEarnings` |
| Notifications (unread count only) | GET | `/riders/notifications` | inline `{read:boolean}[]` | `RidersController.listNotifications` → `RidersService.listNotifications` |
| Go online | POST | `/riders/online` | — | `RidersController.goOnline` → `RidersService.setOnline(true)` |
| Go offline | POST | `/riders/offline` | — | `RidersController.goOffline` → `RidersService.setOnline(false)` |
| Start break | POST | `/riders/break/start` | — | `RidersController.startBreak` → `RidersService.startBreak` |
| End break | POST | `/riders/break/end` | — | `RidersController.endBreak` → `RidersService.endBreak` |
| Accept pickup offer | POST | `/riders/pickup-offers/:id/accept` | pickup summary | `RidersController.acceptPickup` → `PickupService.acceptPickup` |
| Pickup detail (sub-page) | GET | `/riders/pickup-tasks/:id` | `PickupTask` (page-local) | `PickupService.getPickupTask` |
| Delivery detail (sub-page) | GET | `/riders/delivery-tasks/:id` | `DeliveryTask` (page-local) | `DeliveryService.getDeliveryTask` |

All rider routes sit behind `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.RIDER)` at the controller (`riders.controller.ts:55-56`); the acting rider is always `req.user.sub` from the JWT, never a client-supplied id.

## Backend trace
- **Offer pools** (`getPickupOffers`/`getDeliveryOffers`): each does one `Order.find(...).sort().limit(20)`, then fans out `Promise.all` over the up to 20 results calling `buildPickupSummary`/`buildDeliverySummary`, which each pull in address, branch/customer/user details via `buildRiderTaskDetails`, cash-payment info, and (conditionally) wallet remittance — several queries per order. See Findings #2.
- **Tasks/active-assignment** (`getTasks`, `getActiveAssignment`): scoped correctly via `$or:[{pickupRiderId: userId},{deliveryRiderId: userId}]` on `status $in [...]`; `getActiveAssignment` additionally resolves one "primary" order and its two addresses.
- **Earnings**: 5 independent queries run in parallel (`Promise.all`) — no N+1.
- **Accept pickup** (`PickupService.acceptPickup`): validates dispatch/partner-acceptance/status/unclaimed state, then claims the order for the rider.
- **Accept delivery** (`DeliveryService.acceptDelivery`): requires `order.deliveryRiderId` already equal to the caller (dispatch pre-assigns it) and `status === RIDER_ASSIGNED_DELIVERY` — this is an acknowledgment, not a competitive claim, so no double-accept race is possible here.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Greeting + online pill | `name`, `online` | `online` is derived client-side from `me.shiftStatus`/`me.isOnline` (`rider-operations.tsx:170-172`), not a raw boolean off the wire |
| Earnings grid (4 tiles) | `me.todayEarnings`, `weekEarnings`, `monthEarnings`, `me.totalEarnings` | today/lifetime come from `/riders/me`, week/month come from `/riders/earnings` — two different endpoints feeding one grid; both need to stay in sync after any mutation (each mutation handler does call `loadMe()`/`refresh()`, so this is consistent, just worth knowing) |
| "View earnings history" link | none (navigation only) | routes to `/earnings`, a separate full page |
| Compliance banner | `me.compliance` | — |
| Location permission banner | `locationDenied && online` (client state) | — |
| Shift panel | `shiftStatus`, `me.compliance.isCompliant` | hardcoded hint copy for the non-compliant case (`(tabs)/index.tsx:439-441`) is fine — informational only, not a data-derived value |
| Active assignment card | `activeAssignment.*` (see `ActiveAssignment` type) | only rendered `online && activeAssignment` — correct guard, an offline rider shouldn't be shown a live task |
| Offline banner | (component-internal) | — |
| Available tasks section | `visiblePickups` (offers minus client-side dismissed set), `visibleDeliveries` (same) | "Decline" only dismisses locally (`setDismissedPickup`/`setDismissedDelivery`, `(tabs)/index.tsx:480,490`) — it does **not** call a reject endpoint, so the offer remains claimable by this rider and will reappear on the next `refresh()`/socket-triggered refetch. See Findings #1. |
| Pickup/Delivery offer cards | `offer._id/status/bookingType/scheduledPickupAt/pickupAddress\|deliveryAddress`, `shopName` (derived from `me.shopLocation.name` with a hardcoded `'Lunara Hub'` fallback) | route visualization is fully client-derived from label/city strings |
| Route guide carousel | `routeProgressIndex` (derived client-side via `getRouteProgressIndex(online, offers, deliveryOffers, tasks)`) | — |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Go online | no | n/a | no explicit disable while in-flight, but `goOnline` is a single `await` chain with a success/failure `Alert` at the end — rapid double-tap could fire two `/riders/online` requests; harmless since it's idempotent server-side (sets same fields) | yes — `Alert.alert('Cannot go online', ...)` on failure |
| Go offline | no (clears `activeOrderId`, stops GPS ticking) | no | same as above, idempotent | no explicit failure alert — a thrown error from `riderFetch` is unhandled in `goOffline()` (`rider-operations.tsx:291-300`), so a failed offline request silently leaves the UI in "online" state with no user feedback |
| Start/End break | no | no | same as above | `startBreak` has no catch (silent on failure, same gap as `goOffline`); `endBreak` also has no catch |
| Accept pickup offer | no (claims a shared resource) | no | no — button isn't disabled while the request is in flight, so a fast double-tap can fire two accept requests for the same offer | yes, indirectly — the second request now correctly fails with "Pickup no longer available" after the atomic-claim fix (see Findings #1) |
| Decline pickup/delivery offer (home) | no (local-only) | no | n/a | n/a — see Findings #1, no request is even sent |

**Cross-module note**: `goOffline`/`startBreak`/`endBreak` lacking a `try/catch`+`Alert` (unlike `goOnline`/`endBreak`'s success path and `acceptPickupOffer`, which do wrap in `run()` with error surfacing on the detail pages) is specific to this context file — no other rider-mobile screen shares `rider-operations.tsx`, so this isn't a shared-hook issue, just an inconsistency within the same file.

## Authorization
All endpoints require `UserRole.RIDER` and resolve identity from the JWT (`req.user.sub`), never a client param, so there's no cross-rider spoofing surface for `/riders/me`, `/riders/tasks`, `/riders/active-assignment`, `/riders/earnings`, `/riders/notifications`. For the offer pools (`/riders/pickup-offers`, `/riders/delivery-offers`), every online rider sees the same unfiltered global list — this is a product decision (no per-rider geo/branch scoping exists), not a broken guard, so it's not tagged `[authz]`.

For the pickup/delivery detail routes reached from this module, `PickupService.getOrderForRider` (`pickup.service.ts:407-418`) correctly restricts access to either an open (unclaimed) offer or the order's current assigned rider — a rider cannot fetch another rider's already-claimed pickup task by guessing its id. `DeliveryService.getDeliveryTask` was not independently re-verified in this pass but follows the same file's `acceptDelivery` pattern of checking `deliveryRiderId === riderUserId`.

## Findings

1. **Accept-pickup race condition — `[fixed]`.** `PickupService.acceptPickup` (`pickup.service.ts:120-163`, pre-fix) read the order with `findById`, validated `pickupRiderId` was unset in application code, then wrote with a plain `.save()`. Two riders tapping "Accept" on the same offer within the same request window could both pass the in-memory check before either write landed, resulting in an order double-assigned to two riders (whichever `.save()` lands last silently overwrites the other's claim, and both riders' apps would believe they own the pickup).
   **Fix:** replaced the read-then-save with a single atomic `findOneAndUpdate({_id, status: {$in:[...]}, pickupRiderId: {$exists:false}}, {$set:..., $push:...}, {new:true})` — `apps/api/src/modules/riders/pickup.service.ts:120-163`. The unclaimed-state check is now re-evaluated by MongoDB at write time; a losing concurrent request gets `order === null` and a clean `BadRequestException('Pickup no longer available')` instead of silently overwriting the winner. `DeliveryService.acceptDelivery` was checked and does not share this bug — it requires `deliveryRiderId` already equal to the caller (dispatch pre-assigns it), so there's no multi-rider race to fix there.

2. **N+1 fan-out on offer-pool endpoints — left unfixed (out of scope).** `getPickupOffers`/`getDeliveryOffers` (`pickup.service.ts:98-113`, `delivery.service.ts:90-102`) run `Promise.all` over up to 20 orders, each triggering ~4-6 further queries inside `buildPickupSummary`/`buildDeliverySummary` (address lookup, `buildRiderTaskDetails` which itself hits customer/branch/user/address models, cash-payment info, conditional wallet remittance) — up to ~100 queries for one list refresh, called on every pull-to-refresh and every dispatch-socket-triggered `refresh()`. Fixing this needs a batched/aggregation rewrite of `buildRiderTaskDetails` (e.g. `$lookup` or bulk `find({_id:{$in:...}})` instead of per-order `findById`), which is a bigger structural change than this audit's scope — flagging for a dedicated pass.

3. **Missing indexes on rider-claim fields — `[fixed]` (partial).** `Order.pickupRiderId` and `Order.deliveryRiderId` are filtered on every `/riders/tasks`, `/riders/active-assignment`, `/riders/earnings`, and offer-pool request but had no `index: true`, unlike `status`/`branchId`/`customerId`.
   **Fix:** added `index: true` to both fields — `apps/api/src/modules/orders/schemas/order.schema.ts:324-328`. Left `dispatchStatus` and `partnerAcceptedAt` unindexed: both queries that filter on them (`getPickupOffers`) already lead with the indexed `status` field and are capped at `.limit(20)`, so the marginal benefit is much smaller and adding indexes without production query-plan data risked being a premature optimization beyond what this audit surfaced concretely.

4. **Decline button doesn't call a reject endpoint.** "Decline" on a pickup/delivery offer card on the home screen (`(tabs)/index.tsx:480, 490`) only adds the offer id to a local `Set` (`dismissedPickup`/`dismissedDelivery`) — no `POST .../reject` is sent. The offer stays claimable by this rider and reappears in the list after the next `refresh()` (poll or socket-triggered), which will silently un-dismiss it from the rider's perspective. This may be intentional ("decline" = "hide for now", not "release the offer to no one" since it's a shared pool anyway), but if the intent was for this rider to actually pass on the job, nothing tells the backend. Left unfixed — needs a product decision on what "Decline" should mean for a shared, unclaimed offer pool.

5. **Silent failures on `goOffline`/`startBreak`/`endBreak`.** None of the three wrap their `riderFetch` call in a try/catch with user-facing feedback (`rider-operations.tsx:291-321`) — contrast with `goOnline`, which does show `Alert.alert('Cannot go online', ...)` on failure. A network error mid-shift-toggle leaves the rider believing their status changed when it didn't, with no error shown. Left unfixed here as a minor UX gap outside the "data flow" focus of this audit — flagging for a follow-up pass rather than fixing opportunistically, since it touches shift-state UX decisions (should it retry, block navigation, etc.) beyond a one-line try/catch.

## Unused/dead fields
- `Task.pickupAddress` / `Task.deliveryAddress` (declared in `rider-types.ts:16-35`) are never populated by `GET /riders/tasks` (`RidersService.serializeActiveTask` doesn't set them) — dead for this call path specifically. Not sensitive (same shape as data already shown elsewhere), so this is a minor type-accuracy issue, not a security finding.
- Pickup/delivery summary payloads (`buildPickupSummary`/`buildDeliverySummary`) include full `customerPhone` alongside `customerPhoneMasked` — the home-screen offer cards never render either (they only show address/time), so an unmasked phone number is sent to the client for offers the rider hasn't even accepted yet. This is arguably borderline-sensitive (PII exposed before the rider has any relationship to the order) but the detail pages (`pickup/[id].tsx`/`delivery/[id].tsx`) do legitimately need it post-accept for the "Call customer" button, so it's not a clear-cut over-broad-field bug — noting here rather than in Findings since removing it would need a fetch split (summary vs. detail shape) that's a bigger contract change than this pass should make unilaterally.

## Loading/error/realtime behavior
The home screen has no independent loading state of its own — `RiderOperationsProvider` fires all seven loads on mount/token-change and again on pull-to-refresh (`Promise.all` in `onRefresh`), with each individual `loadX` catching its own error and falling back to an empty/null value (never surfacing a per-card error banner). This means a transient failure on, say, `/riders/earnings` silently zeroes out the earnings cards rather than showing stale-but-correct data or an error state — acceptable for a dashboard refreshed frequently via the dispatch socket, but worth knowing it trades correctness-on-error for simplicity. Realtime refresh is driven by `useRiderDispatchSocket` (`rider-operations.tsx:174-180`), which calls the same `refresh()` used by pull-to-refresh — no separate/conflicting refetch path, and it's scoped per-user (subscribes with `userId`), not global.
