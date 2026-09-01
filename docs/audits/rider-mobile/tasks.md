# Audit: Rider-mobile — Tasks module (list + pickup/delivery/scan detail routes)

Date: 2026-09-02 (updated — added full sub-page treatment for `pickup/[id]`, `delivery/[id]`, `scan.tsx`; prior pass dated 2026-07-24 covered the list screen only and deferred sub-pages to [home.md](home.md)/[scan.md](scan.md))

## Entry point
- Page: `apps/rider-mobile/app/(tabs)/tasks.tsx`
- Component(s): inline `PickupOfferCard`/`DeliveryOfferCard`/`TaskCard`/`ArchiveCard` (memoized), shared `RiderOperationsContext` for live offers/tasks, page-local state for `history`/`cancelled` archives.

## Sub-pages
`tasks.tsx` is the canonical entry into the ride's two detail/action routes (`TaskCard.onPress` and `ArchiveCard.onPress` both call `openTask`), and those routes in turn launch `scan.tsx` for every QR-based confirmation step. Full treatment below, per this audit's scope (these are the module's action routes, not thin cross-refs). The same routes are also reachable from the home dashboard ([home.md](home.md)) — the trace here is independent but the underlying files/endpoints are the same, so findings that were already fixed there are noted, not re-fixed.

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `app/pickup/[id].tsx` | `TaskCard.onPress`/`ArchiveCard.onPress` → `openTask(orderId, status, leg)` (`tasks.tsx:588-654`, `rider-operations.tsx:349-364`) | `item._id` → route `id` | yes — `GET /riders/pickup-tasks/:id` keyed by the same id |
| `app/delivery/[id].tsx` | same `openTask` call | `item._id` → route `id` | yes — `GET /riders/delivery-tasks/:id` keyed by the same id |
| `app/scan.tsx` | pickup/delivery detail screens' "Scan Customer QR" / "Scan Order QR" / "Scan tag" buttons (`pickup/[id].tsx:497,592,728`; `delivery/[id].tsx:519`) | `orderId` (= the pickup/delivery task's own `id`) + `mode` route params | yes — every mode's handler re-sends `orderId` back to the matching `/riders/pickup-tasks/:orderId/*` or `/riders/delivery-tasks/:orderId/*` endpoint, so the id round-trips correctly |

**Routing fix.** `ArchiveCard` rows previously called `openTask(item._id, item.status)` for completed/cancelled orders — for a `cancelled` order, `status` alone can't tell `openTask` which leg (pickup vs delivery) the rider was on, so a cancelled delivery could route to `/pickup/[id]` (or vice versa), landing on a detail screen with no matching `done`/`isActivePickup`/`isActiveDelivery` branch and an effectively blank body. **Fix:** `openTask` now accepts an optional third `leg` param (`rider-operations.tsx:349-364`) which `getTaskHistory`/`getCancelledTasks` already return per-row; `ArchiveCard.onPress` passes `item.leg` (`tasks.tsx:630, 646`) and `openTask` routes on `leg` first, falling back to the old `status`-based inference only when `leg` is absent (active `TaskCard` rows, which don't carry a `leg` field on `Task` today) — `apps/rider-mobile/src/context/rider-operations.tsx:349-364`, `apps/rider-mobile/app/(tabs)/tasks.tsx:630, 646`.

### `pickup/[id].tsx`
Fetches `GET /riders/pickup-tasks/:id` via `loadTaskWithCache` (offline-cache fallback, `src/api.ts` → `src/lib/offline/offline-api.ts`), independent of the list screen's live context — nothing from the list is redundantly re-requested (the list only ever holds summary offer fields). Own `useFocusEffect` refetch + `useRiderOrderSocket(id, load)` subscription scoped to this one order's socket room (`joinOrder`), not the global dispatch socket.

**Mutations** (all via the shared `run()` helper — `setLoading(true)`, `Alert.alert('Error', ...)` on catch, `finally setLoading(false)`; every `ActionBtn` in each step passes `disabled={loading}`, so all of these have a real double-submit guard and failure visibility):

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Accept offer (`/pickup-offers/:id/accept`) | no | no | yes (`loading`) | yes (`run()` Alert) |
| Reject (`/pickup-offers\|pickup-tasks/:id/reject`) | yes (gives up the assignment) | yes — `Alert.alert('Reject task', ...)` confirm dialog before firing | yes | yes |
| Arrive | no | no | yes | yes |
| Verify customer (code or `scan.tsx` QR) | no | no (scan/code entry is itself the confirming action) | yes (button `disabled={loading \|\| verifyCode.length !== 4}`; scan path guarded by `QrScanner`'s own lock, see below) | yes |
| Collect cash | no | no | yes | yes |
| Collect laundry (`{actualWeightKg, notes}`) | no | no | yes | yes |
| Assign/re-scan laundry tag | re-scan is soft-destructive (replaces existing tag) | yes for re-scan — `Alert.alert('Replace laundry tag?', ...)`; first-time scan has none needed | yes (scan lock) | yes |
| Photo upload | no | no | yes | yes |
| Generate receipt | no | no | yes | yes |
| Drop at shop (manual or `scan.tsx` QR) | no | no | yes | yes |

Backend (`pickup.service.ts`) requires every mutating call to resolve through `getActivePickupOrder`/`getOrderForRider`, both of which check `order.pickupRiderId?.toString() === riderUserId` and throw `ForbiddenException('Not your pickup task')` otherwise — see Authorization below.

### `delivery/[id].tsx`
Same shape: `GET /riders/delivery-tasks/:id` via `loadTaskWithCache`, own `useFocusEffect` + `useRiderOrderSocket(id, load)`, same `run()` double-submit/failure-visibility pattern for every action (`accept`, `reject` with confirm dialog, `pickup-from-shop`, `out-for-delivery`, `collect-cash`, `customer-received` or `scan.tsx` QR, photo upload, `complete`). All gated server-side through `getAssignedDeliveryOrder`, which checks `order.deliveryRiderId?.toString() === riderUserId`.

### `scan.tsx`
Thin QR-mode router: reads `orderId`/`mode` params, dispatches to the matching `/riders/pickup-tasks/*` or `/riders/delivery-tasks/*` mutation (or `/laundry-tags/lookup` for `mode=lookup_tag`), shows an `Alert` on success, then `router.back()`. It has **no mutation-safety code of its own** — and correctly doesn't need any, because `src/components/qr-scanner.tsx` already provides it: a `scannedRef` lock is set synchronously on the first decoded frame (before `await onScan(payload)` runs) and `onBarcodeScanned` is disabled (`busy ? undefined : handleScan`) while a scan is in flight, so a QR code held in frame for multiple camera frames cannot fire `handleScan` twice. The lock only releases on a thrown error (allowing retry after failure); a successful scan keeps it held while `scan.tsx` navigates away with `router.back()`. Failures from `riderFetch` inside `onScan` are caught by `QrScanner`'s own `try/catch` and rendered via a local `error` Text, so nothing is silently swallowed. No fix needed here — verified the guard is real, not just present.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Live offers/tasks | (shared context, not page-local) | `/riders/pickup-offers`, `/riders/delivery-offers`, `/riders/tasks` | `PickupOffer[]`, `DeliveryOffer[]`, `Task[]` | see [home.md](home.md) |
| Completed history | GET | `/riders/tasks/history?limit=30` | `TaskHistoryItem[]` | `RidersController.getTaskHistory` → `RidersService.getTaskHistory` |
| Cancelled history | GET | `/riders/tasks/cancelled?limit=30` | `CancelledTaskItem[]` | `RidersController.getCancelledTasks` → `RidersService.getCancelledTasks` |

Both archive endpoints sit behind the same controller-level `JwtAuthGuard`/`RolesGuard`/`@Roles(RIDER)` as the rest of the module, scoped by `req.user.sub`.

## Backend trace
- `getTaskHistory` (`riders.service.ts:485-520`): `Order.find({$or:[{pickupRiderId, 'pickup.droppedAtShop':exists}, {deliveryRiderId, status:in[DELIVERED,COMPLETED]}]}).sort({updatedAt:-1}).limit(30).select(...)`. Correctly scoped to the calling rider via `pickupRiderId`/`deliveryRiderId` matching `userId`. `completedAt` is derived as `delivery.deliveredAt ?? pickup.droppedAtShop ?? updatedAt` — a reasonable fallback chain.
- `getCancelledTasks` (`riders.service.ts:522-549`): `Order.find({$or:[{pickupRiderId},{deliveryRiderId}], status:CANCELLED}).sort({updatedAt:-1}).limit(30).select(...)`. Same scoping pattern.
- Both are cheap, single-query, no N+1 (no per-row `buildRiderTaskDetails`/address lookups — the archive rows deliberately carry a much smaller shape than a live task).
- Same missing-index gap noted in [home.md](home.md) Findings #3 applies to these two queries too (`pickupRiderId`/`deliveryRiderId` — now indexed after that fix); `pickup.droppedAtShop` remains unindexed but is a low-cardinality existence check behind the now-indexed `pickupRiderId`, so it's a minor concern.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Title + filter chips | `filterCounts.assigned/accepted/in_progress` (client-derived via `classifyTask` over live `offers`/`deliveryOffers`/`tasks`, `tasks.tsx:519-527`) | `completed`/`cancelled` chips never show a count badge (`count` defaults to `0` for those ids, `tasks.tsx:659`) — minor inconsistency, not a bug, since showing a live count for a paginated 30-row archive fetched lazily wouldn't be meaningful anyway |
| Pickup/Delivery offer card | same fields as home's offer cards (see [home.md](home.md)) | same client-side `shopName` fallback `'Lunara Hub'` duplicated from `(tabs)/index.tsx` — a shared magic default that would drift if one copy is ever updated without the other; low-severity duplication, not fixed here since introducing a shared constant is a small refactor beyond this audit's findings scope |
| Active task card | `item.status`, `item.leg`, `item.pickupAddress`/`deliveryAddress`/`branchName` | uses the same `Task.pickupAddress`/`deliveryAddress` fields already flagged as unpopulated by `GET /riders/tasks` in [home.md](home.md) Unused/dead fields — so `RouteRow`'s `fromLabel`/`toLabel` here silently falls back to the hardcoded `'Pickup address'`/`'Drop-off'` strings (`tasks.tsx:270-273`) for every row, never showing a real address on this screen. This is a rendering-visible consequence of that dead-field issue, not a new bug — cross-referencing rather than re-flagging. |
| History (Completed) card | `completedAt`, `bookingType`, `status`, `branchName`, `leg` | date/status formatting is local (`formatCardDate`, `riderTaskStatusLabel`) |
| Cancelled card | `cancelledAt`, `bookingType`, `leg`, `branchName` | status label hardcoded to `'Cancelled'` rather than using `riderTaskStatusLabel(item.status)` — deliberate and fine since the API already filters to `status === CANCELLED` |

## Mutations
List-screen actions (`acceptPickupOffer`, `previewDeliveryQueue`, local dismiss-set "Decline") share handlers with the home screen — see [home.md](home.md) Mutations table for those. Sub-page mutations (accept/reject/arrive/verify/collect/collect-cash/assign-tag/photo/generate-receipt/drop-at-shop/pickup-from-shop/out-for-delivery/customer-received/complete, plus every `scan.tsx` mode) are tabulated per sub-page above — all confirmed to have a working double-submit guard and failure visibility.

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Accept pickup offer (list screen, `PickupOfferCard`) | no | no | **yes — `[fixed]`** (see Findings #1) | **yes — `[fixed]`** (see Findings #1) |
| Decline pickup/delivery offer (list screen, local-only) | no (no request sent) | n/a | n/a | n/a — see [home.md](home.md) Findings #4 for the "does this actually release the offer" product question |
| Preview delivery queue (`previewDeliveryQueue`) | no (navigation + info alert only, no request) | n/a | n/a | n/a |
| All pickup/delivery detail-screen actions | see per-sub-page tables above | see above | yes (`run()` helper + `disabled={loading}` on every `ActionBtn`) | yes (`run()`'s `Alert.alert('Error', ...)`) |
| All `scan.tsx` QR confirmations | no (each gated by the order's own state machine, e.g. `dropAtShop` requires a receipt code to already exist) | scan itself is the confirming action | yes (`QrScanner`'s `scannedRef`/`busy` lock) | yes (`QrScanner`'s local `error` state) |

## Authorization
- List screen: `/riders/pickup-offers`, `/riders/delivery-offers`, `/riders/tasks`, `/riders/tasks/history`, `/riders/tasks/cancelled` are all scoped by `req.user.sub` server-side (never a client param) — see [home.md](home.md) Authorization for the offer-pool/tasks trace; the two archive endpoints follow the identical `pickupRiderId`/`deliveryRiderId` matching pattern (`riders.service.ts:550-610`).
- **`[authz]` Can a rider hit another rider's pickup/delivery task by manipulating `:id`? No — verified directly.** Every mutating pickup endpoint routes through `PickupService.getActivePickupOrder`/`getOrderForRider` (`pickup.service.ts:420-459`), which loads the order by id and then checks `order.pickupRiderId?.toString() === riderUserId`, throwing `ForbiddenException('Not your pickup task')` otherwise — the ownership check happens before any mutation, not after. `getOrderForRider` (used only for the `GET` detail fetch) additionally allows a still-unclaimed offer to be read by any rider, which is correct — that's the shared offer pool, not another rider's claimed task. Every mutating delivery endpoint routes through `DeliveryService.getAssignedDeliveryOrder` (`delivery.service.ts:525-539`), same pattern: `order.deliveryRiderId?.toString() === riderUserId` or `ForbiddenException('Not your delivery task')`. Both services also gate unmasked `customerPhone`/`shopPhone` behind `includeDialablePhone: isAssigned` in `buildRiderTaskDetails` (`rider-task-summary.ts:105,113`), so an unclaimed offer's summary never leaks a dialable phone number either. `scan.tsx`'s `lookup_tag` mode is scoped separately by `LaundryTagsService.assertLookupAccess`, already verified in [scan.md](scan.md). No authorization gaps found in this trace.

## Findings

1. **Accept-pickup-offer button had no double-submit guard or failure visibility — `[fixed]`.** `acceptPickupOffer` (`rider-operations.tsx`, pre-fix) had no `try/catch` and the list screen's `PickupOfferCard.onAccept` called it via a bare `void acceptPickupOffer(...)` with no loading state — a fast double-tap could fire two accept requests (harmless server-side thanks to the atomic `findOneAndUpdate` claim fixed in [home.md](home.md) Findings #1, but the loser's failure was silently swallowed as an unhandled promise rejection with zero user feedback).
   **Fix:** `acceptPickupOffer` now wraps the request in `try/catch` and shows `Alert.alert('Could not accept pickup', ...)` on failure (`apps/rider-mobile/src/context/rider-operations.tsx:acceptPickupOffer`); the list screen tracks `acceptingOfferId` state, ignores a repeat tap while a request for that offer is in flight, and passes `accepting`/`acceptDisabled` down to `OfferCardShell` so the Accept button shows a spinner and is disabled during the request (`apps/rider-mobile/app/(tabs)/tasks.tsx` — `acceptingOfferId` state, `OfferCardShell`/`PickupOfferCard` `accepting`/`acceptDisabled` props, `renderRow`'s pickup-offer branch). Cross-module: `previewDeliveryQueue` doesn't need the same fix — it never calls an API, it's navigation + an info alert only.

2. **Cancelled/completed rows could route to the wrong detail screen — `[fixed]`.** See Sub-pages "Routing fix" above. `ArchiveCard.onPress` previously passed only `item._id`/`item.status` to `openTask`, which couldn't distinguish a cancelled delivery from a cancelled pickup, landing on a detail screen with no matching UI branch for either the wrong leg or `status === 'cancelled'` (empty body, no explanatory banner).
   **Fix:** `openTask` gained an optional `leg` param routed first when present (`rider-operations.tsx:349-364`), and `ArchiveCard.onPress` now passes `item.leg` — both `history`/`cancelled` API responses already carried that field (`riders.service.ts` `getTaskHistory`/`getCancelledTasks`). Note this fixes *which screen* a cancelled/completed row opens, not the separate, smaller gap that neither detail screen renders dedicated copy for `status === 'cancelled'` (its step cards just don't render, falling through to a mostly-blank body below the stepper/details card) — left unfixed, needs a product decision on what a cancelled task's detail view should show, out of scope for a routing fix.

3. **Redundant conditional in `getCancelledTasks` leg derivation — `[fixed]`.** The `leg` field used nested ternaries where both branches of the outer `pickupRiderId !== userId` check returned `'delivery'` whenever `deliveryRiderId === userId`, making the outer condition dead — `riders.service.ts:541-547` (pre-fix). No behavior changed by this exact reasoning, but it obscured the actual rule (a plain `deliveryRiderId === userId ? 'delivery' : 'pickup'`) and was a latent trap for a future edit that only touched one branch.
   **Fix:** collapsed to the single equivalent ternary — `apps/api/src/modules/riders/riders.service.ts:540-542`.

4. **Silent failures on archive loads — `[fixed]`.** `loadArchived` (`tasks.tsx`, pre-fix) caught both `/riders/tasks/history` and `/riders/tasks/cancelled` failures and fell back to an empty array with no user-visible error — a transient network failure while viewing the Completed/Cancelled filter looked identical to "you have no completed/cancelled tasks" (`EmptyState` renders the same message either way). Same silent-failure pattern noted for `RiderOperationsProvider`'s loaders in [home.md](home.md) Loading/error/realtime behavior — that one is left unfixed there as a shift-state UX decision; this occurrence was a straightforward loading/error-state gap with a direct existing pattern to match (`DataLoadState`, already used by both `pickup/[id].tsx` and `delivery/[id].tsx` for their own load failures), so it was fixed here.
   **Fix:** added `archiveLoading`/`archiveError` state to `loadArchived`, and `listEmpty` now renders `DataLoadState` (loading spinner / error message + retry) instead of the plain `EmptyState` whenever the active archive filter is loading or errored — `apps/rider-mobile/app/(tabs)/tasks.tsx` (`loadArchived`, `listEmpty`). Regression-checked `DataLoadState`: it's a shared component already used by both sub-pages traced above with the same `loading`/`error`/`onRetry` prop contract, so this is an additional consumer, not a changed one — no other screen's behavior affected.

## Unused/dead fields
None new beyond the `Task.pickupAddress`/`deliveryAddress` gap already documented in [home.md](home.md), which this screen's `TaskCard` also happens to render (see Cards table above) — the two docs describe the same root cause from two different rendering surfaces.

## Loading/error/realtime behavior
Live data (`offers`/`deliveryOffers`/`tasks`) comes from the shared context and its dispatch-socket-driven refresh, same as home — no independent polling here. The two archive lists (`history`/`cancelled`) are fetched only on filter-select and on pull-to-refresh while that filter is active, now with distinct loading/error states (Findings #4) rather than silently degrading to "empty"; no socket subscription updates them, which is reasonable since completed/cancelled orders are immutable historical records that don't need to live-update. Pull-to-refresh (`handleRefresh`) correctly composes both the live-context refresh and the archive reload when the active filter needs it — no thrashing or duplicate fetch pattern found. `pickup/[id].tsx`/`delivery/[id].tsx` each run their own `loadTaskWithCache` + `useFocusEffect` + `useRiderOrderSocket(id, load)`, scoped to their own order's socket room — independent of the list screen's dispatch socket, no overlap or double-fetch.
