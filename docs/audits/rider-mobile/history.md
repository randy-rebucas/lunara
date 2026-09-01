# Audit: rider-mobile — History

Date: 2026-09-02

## Entry point
- Page: `apps/rider-mobile/app/history.tsx` — a bare redirect (`<Redirect href="/(tabs)/tasks?filter=completed" />`), not a real screen.
- Component(s): `apps/rider-mobile/app/(tabs)/tasks.tsx` (`TasksScreen`) is the actual implementation — one shared screen that renders five filters (`assigned`, `accepted`, `in_progress`, `completed`, `cancelled`) via `filter` query param. "History" and "Cancelled" are two of those filters, both archive-style read views, so this audit covers `tasks.tsx` end to end for the `completed`/`cancelled` filters (the other three filters are live/active-task views, out of scope here).

## Sub-pages
`tasks.tsx` itself is reached via redirect, not linked from another module. Within it, each `ArchiveCard` (history and cancelled rows) navigates into a detail route on press:

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `pickup/[id].tsx` | history/cancelled `ArchiveCard` press → `openTask`, `tasks.tsx:613`/`629` | `item._id` → route `id` | yes, but only reachable correctly now (see Findings #1) |
| `delivery/[id].tsx` | history/cancelled `ArchiveCard` press → `openTask`, `tasks.tsx:613`/`629` | `item._id` → route `id` | yes, but only reachable correctly now (see Findings #1) |

Both sub-pages are full live-workflow screens (accept/arrive/collect/deliver actions, photo capture, cash collection) — not read-only detail views. They re-fetch the full task by id (`loadTaskWithCache`) rather than reusing anything from the history/cancelled list, which is expected since the list only returns a thin summary. Findings specific to the routing bug between the list and these two screens are folded into Findings #1 below rather than a separate doc, since each screen was already covered by the module's normal operation (not a detail view unique to History).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Completed tasks | GET | `/riders/tasks/history?limit=30` | `TaskHistoryItem[]` | `RidersController.getTaskHistory` → `RidersService.getTaskHistory` |
| Cancelled tasks | GET | `/riders/tasks/cancelled?limit=30` | `CancelledTaskItem[]` | `RidersController.getCancelledTasks` → `RidersService.getCancelledTasks` |

Response envelope is `{ success: true, data: [...] }`; `riderFetch` → `apiFetch` → `authRequest` unwraps `.data` automatically (`apps/rider-mobile/src/store/auth.ts:41`), so the frontend types matching a bare array (not the envelope) is correct.

## Backend trace
- `RidersService.getTaskHistory` (`apps/api/src/modules/riders/riders.service.ts:550`): finds orders where either `pickupRiderId` matches and `pickup.droppedAtShop` exists, or `deliveryRiderId` matches and status is `DELIVERED`/`COMPLETED`. Sorted by `updatedAt` desc, `.limit(limit)`, projected to only the fields the response needs. `completedAt` is derived as `delivery.deliveredAt ?? pickup.droppedAtShop ?? updatedAt`; `leg` is derived by checking terminal status + `deliveryRiderId` match.
- `RidersService.getCancelledTasks` (`apps/api/src/modules/riders/riders.service.ts:587`): finds orders where either rider id matches and `status === CANCELLED`. `cancelledAt` is just `updatedAt` (no dedicated cancellation timestamp field exists on the order schema — acceptable proxy, but if the order is later touched by anything else post-cancellation this would drift; not observed as an issue in the traced code path).
- Both queries are appropriately scoped to `userId` from the JWT (`req.user.sub`), not a request param — no way for a rider to widen the query to another rider's data.
- `limit` comes from `@Query('limit') limit = '30'` and is `Number()`-cast with no upper bound or `NaN` guard — a rider could pass `?limit=999999` or `?limit=abc` (→ `NaN`, which Mongoose's `.limit()` treats as "no limit"/undefined behavior). Low severity since the query is already scoped to the rider's own orders and it's a `GET`, but noted under Findings.

## Cards / panels
Both `completed` and `cancelled` filters render the same `ArchiveCard` component in a `FlatList`, one row per item, in list order (backend already sorted by `updatedAt` desc — no separate frontend sort).

| Card | Fields consumed | Notes |
|---|---|---|
| Filter chips (list header) | `TASK_LIST_FILTERS`, `filterCounts` (assigned/accepted/in_progress only) | Completed/cancelled chips never show a count badge — `filterCounts` (`tasks.tsx:547`) only computes assigned/accepted/in_progress from live `offers`/`tasks` state; history/cancelled counts aren't fetched separately from the list itself, so no badge makes sense here. Not a bug — there's no count-only endpoint being wasted. |
| `ArchiveCard` (completed) | `item.leg` (pill label/color), `item.completedAt` (date), `item.bookingType` (formatted), `item.status` (via `riderTaskStatusLabel`), `item.branchName` (optional) | `typePill`/`typeColor`/`typeBg` are a client-side map keyed on `leg` (`'delivery' ? accentDark/accentLight : primary/primaryLight`) — small, stable two-value map, low risk of drifting out of sync with the backend. |
| `ArchiveCard` (cancelled) | `item.leg`, `item.cancelledAt` (date), `item.bookingType` (formatted), hardcoded `"Cancelled"` status label, `item.branchName` (optional) | `item.status` is fetched but not rendered as text (only used for navigation, see Findings #1) — always `CANCELLED` by construction of the query, so hardcoding the label is reasonable, not a dead field. |

## Mutations
None — this is a read-only archive view. Pressing a card only navigates to a detail screen (`pickup/[id].tsx` / `delivery/[id].tsx`), it doesn't mutate state itself.

## Authorization
No role-scoped access concerns beyond the standard `@Roles(UserRole.RIDER)` guard on both endpoints (`riders.controller.ts:457`, `:466`). Both service methods derive the rider identity from the JWT (`req.user.sub`) and there is no request parameter that could widen the query to another rider's orders — confirmed no `[authz]` findings.

## Findings

1. **Wrong detail screen opened for a completed/cancelled delivery-leg task.** `openTask(orderId, status)` (`apps/rider-mobile/src/context/rider-operations.tsx`, was line 338) decided which detail route to push (`/delivery/:id` vs `/pickup/:id`) purely from `status`, checking only the three in-flight delivery statuses (`rider_assigned_delivery`, `ready_for_delivery`, `out_for_delivery`). A history item's `status` is always a terminal value (`delivered`/`completed`) and a cancelled item's `status` is always `cancelled` — neither matches those three strings, so every history/cancelled row whose `leg === 'delivery'` was routed to `/pickup/[id]`, which fetches from `/riders/pickup-tasks/:id` — the wrong endpoint for an order this rider only ever held the delivery leg of. Impact: tapping a completed/cancelled delivery task from History or Cancelled would open the pickup workflow screen for an order that isn't a pickup task, showing wrong/empty data instead of the delivery task's detail.
   **Fix:** `openTask` now takes an optional third `leg?: 'pickup' | 'delivery'` param that takes priority over the status heuristic when supplied (`rider-operations.tsx`, `openTask`). Both `ArchiveCard` press handlers in `tasks.tsx` (history at line 613, cancelled at line 629) now pass `item.leg`, which `TaskHistoryItem`/`CancelledTaskItem` already carry. Regression-checked the other two `openTask` call sites (`(tabs)/index.tsx:452` for the active-assignment banner, and the `task` row in `tasks.tsx:597`) — both still omit `leg` and fall through to the original status-based branch unchanged, so live-task navigation is unaffected.

2. **Failed history/cancelled fetch was silently swallowed — no loading state, no error shown.** `loadArchived` (`tasks.tsx`, previously lines 513–531) had no loading flag at all, and on fetch failure just set the list to `[]` and returned — so a network error rendered identically to "no completed tasks yet," with no way to tell the difference or retry.
   **Fix:** Added `archiveLoading`/`archiveError` state, set around both fetches in `loadArchived`. `listEmpty` now renders `DataLoadState` (the same shared loading/error component `performance.tsx` uses) with a retry button wired to `loadArchived` while loading or on error, falling back to the existing `EmptyState` copy only once the fetch has actually succeeded with zero rows (`tasks.tsx`, `listEmpty`).

3. **`limit` query param has no bound or `NaN` guard.** `@Query('limit') limit = '30'` is passed straight through `Number()` in both `getTaskHistory` and `getCancelledTasks` (`riders.controller.ts:460`, `:469`) with no `Math.min`/validation. A non-numeric value produces `NaN`, and Mongoose's `.limit(NaN)` is undefined/driver-dependent behavior rather than a clean "no limit" or a 400.
   **Fix: left unfixed** — low severity (query is already scoped to the requesting rider's own orders, so at worst this is a self-inflicted large/odd response, not a cross-rider data exposure), and the frontend never sends anything but the literal `?limit=30`. Fixing it means picking a validation strategy (DTO + `class-validator`, or a manual clamp) consistent with how other `@Query('limit')` usages in this controller are handled — a broader convention decision better done in one pass across the file rather than one-off here.

## Unused/dead fields
None. Every field on both `TaskHistoryItem` and `CancelledTaskItem` (`_id`, `status`, `bookingType`, `branchName`, `completedAt`/`cancelledAt`, `leg`) is read by either `ArchiveCard`'s props or `openTask`'s navigation (as of the Findings #1 fix). No sensitive/PII fields are returned by either endpoint (backend `.select()` projects only `_id status bookingType branchName updatedAt pickup.droppedAtShop delivery.deliveredAt deliveryRiderId` / the cancelled equivalent — no customer name/phone/address).

## Loading/error/realtime behavior
- Loading/error is now handled per Findings #2 fix, via the shared `DataLoadState` component (also used by `performance.tsx`, `pickup/[id].tsx`, `delivery/[id].tsx`) — consistent with the rest of the app.
- Refresh: pull-to-refresh (`handleRefresh`, `tasks.tsx:539`) calls both `onRefresh()` (the shared rider-operations refresh, which reloads `me`/offers/tasks/etc., unrelated to history/cancelled) and `loadArchived()` when the current filter is `completed` or `cancelled` — scoped correctly, doesn't double-fetch unrelated filters.
- No realtime/socket updates for history or cancelled — appropriate, since these are settled/terminal records, not live state. The dispatch socket (`useRiderDispatchSocket`) triggers `refresh()` on push events, which does not touch `history`/`cancelled` state, so an archived list won't refetch mid-view from a socket event; this is correct behavior, not a gap.
