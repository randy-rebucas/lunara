# Audit: Rider-mobile — Notifications (filtered list + push routing)

Date: 2026-09-02 (supersedes 2026-07-24 pass — re-verified end to end, three new findings fixed below)

## Entry point
- Page: `apps/rider-mobile/app/notifications.tsx`
- Component(s): `src/components/notification-list-item.tsx`, `src/hooks/use-notifications.ts`. Also shares routing logic (`resolveRiderNotificationRoute`) with `src/hooks/use-push-notifications.ts`, which handles taps on OS push notifications outside this screen — traced here since it's the same function this screen depends on. Also now consumes `RiderOperationsContext.notificationsVersion` (`src/context/rider-operations.tsx`) — see Findings #3.

## Sub-pages
None in the strict sense (no list→detail drilldown), but tapping a notification row navigates via `resolveRiderNotificationRoute` into `/pickup/[id]`, `/delivery/[id]`, or `/earnings` — all already audited ([home.md](home.md), [earnings.md](earnings.md)). Not re-traced here beyond the routing-decision logic itself.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Notification list (this screen) | GET | `/riders/notifications?limit=50` | `RiderNotification[]` | `RidersController.listNotifications` → `RidersService.listNotifications` |
| Mark one read | PATCH | `/riders/notifications/:id/read` | — | `RidersController.markNotificationRead` → `RidersService.markNotificationRead` |
| Badge count (shared context, not this screen) | GET | `/riders/notifications?limit=50` | inline `{read:boolean}[]` | same `listNotifications` handler, now the same limit as this screen (Findings #1, fixed) |

This screen's `useNotifications(50)` hook fetches its own independent copy (separate from `RiderOperationsContext`'s `loadNotifications`). Both now request the same `limit=50` page so the two independently-computed unread counts (this screen's badge vs. the tab-bar badge driven by the context) can no longer diverge from sampling a different window — see Findings #1.

## Backend trace
`listNotifications` (`riders.service.ts:73-92`): a single scoped `find({userId}).sort({createdAt:-1}).limit(limit)` — correctly scoped, no N+1. Each item's `category` is either the value stored at creation time (`rider-notification.service.ts`, computed via `inferRiderNotificationCategory`) or re-inferred on read as a fallback. `markNotificationRead` (`riders.service.ts:94-109`): loads by id, verifies `notification.userId.toString() === userId` and throws `NotFoundException` (not `Forbidden`, deliberately avoiding confirming another user's notification exists) otherwise, then sets `read: true`. Both correctly scoped, no `[authz]` findings.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Page header (title + unread badge) | `unreadCount` (from this screen's own `useNotifications` hook, then pushed into the shared context via `setUnreadCount`, `notifications.tsx:36-38`) | now consistent with the tab-bar badge, see Findings #1 |
| Filter chips | client-side count only via filtering `items`, no per-category counts shown (unlike Tasks tab's chip badges) — a deliberate simpler design, not a bug |
| Notification row (`NotificationListItem`) | `notification.title/body/read/createdAt`, derived `category` (via `resolveNotificationCategory`), derived route (via `resolveRiderNotificationRoute`) | tapping marks read (optimistic local update, then a `PATCH`) and navigates if a route was resolved |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Mark notification read (tap) | no | n/a | implicit — `notification.read` guard in `handlePress` (`notification-list-item.tsx:36`) means a second tap on the same row is a no-op for the read-mutation (though it would still re-navigate) | partial — `markRead` (`use-notifications.ts:37-49`) optimistically flips `read` locally *before* the API call; on failure it silently re-`load()`s to reconcile rather than showing an error, so a failed mark-read is invisible beyond the badge/row reverting a moment later. Low-severity since the worst case is a notification appearing read then un-reading itself, not data loss — left as-is, no product-visible failure mode worth an extra toast. |

## Authorization
Both endpoints scoped to `req.user.sub` — no cross-rider access. `markNotificationRead`'s not-found-instead-of-forbidden response for a mismatched `userId` is a reasonable choice (doesn't confirm whether the id exists for another user). No `[authz]` findings.

## Findings

1. **Two different unread-count sources (20 vs 50 most-recent) could disagree — `[fixed]`.** `RiderOperationsContext.loadNotifications` (`src/context/rider-operations.tsx`) called `GET /riders/notifications` with no `limit` param (defaulting to 20 server-side, `riders.controller.ts`) purely to derive the badge count shown across the app (home, profile, tab bar), while this screen's own `useNotifications(50)` fetched 50 and, while mounted, overwrote the context's `unreadCount` via `setUnreadCount` with a count derived from a *larger* window. If a rider had more than 20 notifications with unread ones beyond the 20 most recent, the badge shown elsewhere in the app could under-count relative to what this screen showed.
   **Fix:** changed `loadNotifications` in `apps/rider-mobile/src/context/rider-operations.tsx:150-160` to request `?limit=50`, matching this screen's `useNotifications(50)`. Both counters now sample the same window, so they can no longer disagree purely from page-size skew (a real backend `countDocuments({userId, read:false})` aggregate would still be the more correct long-term fix if the unread total can exceed 50, but that's a new endpoint/contract change — out of scope here; this fix closes the immediate, common-case inconsistency cheaply). Regression check: `loadNotifications` is also called from `refresh()`/`onRefresh()`/the dispatch-socket `syncNotifications` handler in the same file — all just consume the returned unread count the same way, none depend on the specific limit value, so no other call site is affected.

2. **A failed background refresh wiped the previously-shown notification list — `[fixed]`.** `useNotifications`'s `load()` (`use-notifications.ts`, pre-fix) called `setItems([])` in its `catch` block alongside `setError(...)`. Since `notifications.tsx` only renders the full-screen error state when `error && items.length === 0`, a refresh that failed *after* the list had already loaded (e.g. a flaky pull-to-refresh or the post-notification live refresh added in Findings #3) would silently clear a list the rider was already looking at, immediately replacing it with the empty state's "No notifications yet" copy instead of the error — actively misleading, since it looks like the notifications were deleted rather than that a request failed. The sibling `my-reports.tsx` (Support module) already gets this right: its `load()` sets `error` without touching `tickets` on failure.
   **Fix:** removed the `setItems([])` call from the `catch` block in `apps/rider-mobile/src/hooks/use-notifications.ts:17-19`, matching `my-reports.tsx`'s pattern — a failed refresh now leaves the last-known list in place and just sets `error` (which the screen doesn't act on when `items.length > 0`, since the full-screen error view is gated on an empty list). Typechecked `apps/rider-mobile` — no new errors in this file.

3. **No live update while the screen is open — `[fixed, narrow scope]`.** Previously, a `riderNotification`/`pickupAssignment`/`deliveryAssignment` socket event arriving while this screen was open only updated the tab-bar badge count (via `RiderOperationsContext`'s `onNotificationsSync` handler) — the list itself (`useNotifications`'s own state) would stay stale until the next focus-triggered or manual refresh. For a rider actively viewing their notification log during a shift, a genuinely new item wouldn't appear until they left and returned to the tab.
   **Fix:** added a `notificationsVersion` counter to `RiderOperationsContext` (`src/context/rider-operations.tsx`), incremented only inside the dispatch-socket's `onNotificationsSync` handler (i.e. only on an actual push-worthy event — `pickupAssignment`, `deliveryAssignment`, `riderNotification` — not on every generic `refresh()`, so this doesn't add thrashing to the existing poll-on-focus/pull-to-refresh behavior). `notifications.tsx` now subscribes to `notificationsVersion` and calls `refresh()` when it changes past its initial value. Regression check: `notificationsVersion` is additive to the context's value object and the existing `unreadCount`/`setUnreadCount` wiring is untouched; grepped other consumers of `useRiderOperations()` — none read `notificationsVersion`, so this is purely additive and doesn't change behavior for home/tasks/profile/earnings screens sharing the same context.

## Unused/dead fields
- `useNotifications`'s `markAllRead` (`use-notifications.ts:51-54`) is exported but never called anywhere in the app — there's no "Mark all read" affordance on this screen. Not a bug (nothing depends on it), just dead code; not removed since it's plausibly intended for a near-future UI addition rather than leftover cruft, and adding a new "Mark all read" button is a UI/product decision this audit's fix pass shouldn't make unilaterally.
- `RiderNotification.data.branchName` and `data.earningType` (`notification-types.ts:30,32`) are typed on the frontend but never read by `NotificationListItem` or any other consumer — harmless, forward-looking optional fields, not sensitive, left as-is.
- The frontend's `inferCategoryFromType` (`notification-types.ts:51-65`) duplicates the backend's `inferRiderNotificationCategory` type-string-to-category mapping — the same "two hand-maintained copies of a classification list" pattern already flagged for `RIDER_DOCUMENT_TYPES` in [documents.md](documents.md) Findings #1. Lower severity here because `resolveNotificationCategory` always prefers the backend-supplied `notification.category` first, and the backend tags every notification with a `category` at creation time — this frontend fallback is effectively dead code in normal operation.

## Loading/error/realtime behavior
Independent `loading`/`refreshing`/`error` state with a clean full-screen-loading vs. full-screen-error split (only when there's no cached data, `error && items.length===0`). A failed background refresh now correctly preserves the last-known list instead of wiping it (Findings #2). Refreshes on every screen focus (`useFocusEffect`) and pull-to-refresh, and now also on a live dispatch-socket signal while the screen stays open (Findings #3) — so a rider watching this screen during a shift sees new assignment/system notifications without needing to background and refocus the tab.
