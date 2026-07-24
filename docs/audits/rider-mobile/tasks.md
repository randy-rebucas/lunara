# Audit: Rider-mobile — Tasks tab (filtered task list)

Date: 2026-07-24

## Entry point
- Page: `apps/rider-mobile/app/(tabs)/tasks.tsx`
- Component(s): inline `PickupOfferCard`/`DeliveryOfferCard`/`TaskCard`/`ArchiveCard` (memoized), shared `RiderOperationsContext` for live offers/tasks, page-local state for `history`/`cancelled` archives.

## Sub-pages
Reached from row taps via the same `openTask(orderId, status)` handler already audited in [home.md](home.md) — `/pickup/[id]` and `/delivery/[id]`. No new sub-page behavior beyond what's documented there; not re-traced here. One difference worth noting: `ArchiveCard` rows (completed/cancelled) also call `openTask(item._id, item.status)` (`tasks.tsx:585, 601`) — for a `cancelled` order this routes to whichever of `/pickup/[id]`/`/delivery/[id]` matches `item.status`, but neither detail screen has a rendering branch for `status === 'cancelled'` (their `done`/`isActivePickup`/`isActiveDelivery` checks don't include it) — see Findings #1.

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `pickup/[id].tsx` / `delivery/[id].tsx` | `TaskCard.onPress` (`tasks.tsx:569`), `ArchiveCard.onPress` (`tasks.tsx:585, 601`) | `item._id` → route `id` | yes for active tasks; see Findings #1 for archive rows |

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
Same accept/decline actions as the home screen ([home.md](home.md) Mutations table) — `acceptPickupOffer`, `previewDeliveryQueue`, and the local-only dismiss-set "Decline" are reused verbatim from context via the same handlers, so they're not re-audited here; see that doc for the double-submit and silent-decline findings, which apply equally to this screen's copies of the same cards.

## Authorization
No new endpoints beyond what's covered in [home.md](home.md), plus the two archive reads above — both correctly scoped by `req.user.sub` via `pickupRiderId`/`deliveryRiderId` matching, no `[authz]` findings.

## Findings

1. **Cancelled-order rows route into detail screens that don't render a cancelled state.** `ArchiveCard` rows for `cancelled` items call `openTask(item._id, item.status)` (`tasks.tsx:601`), which routes to `/pickup/[id]` or `/delivery/[id]` (`rider-operations.tsx:338-349`, reused from [home.md](home.md)). Both detail screens fetch the task fresh (`GET /riders/pickup-tasks/:id` / `delivery-tasks/:id`) and derive their UI purely from booleans like `isActivePickup`/`isOffer`/`done` (`pickup/[id].tsx:330-333, 347-348`; `delivery/[id].tsx:299-302`) — none of which match `status === 'cancelled'`. A tapped cancelled row would land on a detail screen showing an empty body (no step cards render, no "done" banner, no explicit "this order was cancelled" messaging) — confusing but not crashing, since `PickupService.getOrderForRider`/equivalent still permits the fetch for a rider who was assigned to it. Left unfixed: this needs a small product decision (what should a cancelled task's detail view show — a dedicated read-only summary, or should tapping an `ArchiveCard` cancelled row be disabled/no-op instead of navigating?) rather than a one-line code fix.

2. **Redundant conditional in `getCancelledTasks` leg derivation — `[fixed]`.** The `leg` field used nested ternaries where both branches of the outer `pickupRiderId !== userId` check returned `'delivery'` whenever `deliveryRiderId === userId`, making the outer condition dead — `riders.service.ts:541-547` (pre-fix). No behavior changed by this exact reasoning, but it obscured the actual rule (a plain `deliveryRiderId === userId ? 'delivery' : 'pickup'`) and was a latent trap for a future edit that only touched one branch.
   **Fix:** collapsed to the single equivalent ternary — `apps/api/src/modules/riders/riders.service.ts:540-542`.

3. **Silent failures on archive loads.** `loadArchived` (`tasks.tsx:485-503`) catches both `/riders/tasks/history` and `/riders/tasks/cancelled` failures and falls back to an empty array with no user-visible error — a transient network failure while viewing the Completed/Cancelled filter looks identical to "you have no completed/cancelled tasks" (`EmptyState` renders the same message either way, `tasks.tsx:685-688`). Same silent-failure pattern already noted for `RiderOperationsProvider`'s loaders in [home.md](home.md) Loading/error/realtime behavior — this is a second, independent occurrence in a different file, so it's a repeated pattern across the module rather than a one-off. Left unfixed: distinguishing "empty" from "error" needs a small UI addition (a distinct error state/retry affordance), which is a UX decision beyond swapping a catch block.

## Unused/dead fields
None new beyond the `Task.pickupAddress`/`deliveryAddress` gap already documented in [home.md](home.md), which this screen's `TaskCard` also happens to render (see Cards table above) — the two docs describe the same root cause from two different rendering surfaces.

## Loading/error/realtime behavior
Live data (`offers`/`deliveryOffers`/`tasks`) comes from the shared context and its dispatch-socket-driven refresh, same as home — no independent polling here. The two archive lists (`history`/`cancelled`) are fetched only on filter-select and on pull-to-refresh while that filter is active (`tasks.tsx:505-509, 511-516`); no socket subscription updates them, which is reasonable since completed/cancelled orders are immutable historical records that don't need to live-update. Pull-to-refresh (`handleRefresh`) correctly composes both the live-context refresh and the archive reload when the active filter needs it — no thrashing or duplicate fetch pattern found.
