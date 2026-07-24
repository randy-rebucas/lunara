# Audit: Rider-mobile — Notifications (filtered list + push routing)

Date: 2026-07-24

## Entry point
- Page: `apps/rider-mobile/app/notifications.tsx`
- Component(s): `src/components/notification-list-item.tsx`, `src/hooks/use-notifications.ts`. Also shares routing logic (`resolveRiderNotificationRoute`) with `src/hooks/use-push-notifications.ts`, which handles taps on OS push notifications outside this screen — traced here since it's the same function this screen depends on.

## Sub-pages
None in the strict sense (no list→detail drilldown), but tapping a notification row navigates via `resolveRiderNotificationRoute` into `/pickup/[id]`, `/delivery/[id]`, or `/earnings` — all already audited ([home.md](home.md), [earnings.md](earnings.md)). Not re-traced here beyond the routing-decision logic itself.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Notification list (this screen) | GET | `/riders/notifications?limit=50` | `RiderNotification[]` | `RidersController.listNotifications` → `RidersService.listNotifications` |
| Mark one read | PATCH | `/riders/notifications/:id/read` | — | `RidersController.markNotificationRead` → `RidersService.markNotificationRead` |
| Badge count (shared context, not this screen) | GET | `/riders/notifications` (default `limit=20`) | inline `{read:boolean}[]` | same `listNotifications` handler, different limit |

This screen's `useNotifications(50)` hook fetches its own independent copy (separate from `RiderOperationsContext`'s `loadNotifications`, which uses the default `limit=20` purely to compute the badge count shown elsewhere). See Findings #1 for the consequence of these two callers using different page sizes.

## Backend trace
`listNotifications` (`riders.service.ts:71-90`): a single scoped `find({userId}).sort({createdAt:-1}).limit(limit)` — correctly scoped, no N+1. Each item's `category` is either the value stored at creation time (`rider-notification.service.ts:183`, computed via `inferRiderNotificationCategory`) or re-inferred on read as a fallback. `markNotificationRead` (`riders.service.ts:92-107`): loads by id, verifies `notification.userId.toString() === userId` and throws `NotFoundException` (not `Forbidden`, deliberately avoiding confirming another user's notification exists) otherwise, then sets `read: true`. Both correctly scoped, no `[authz]` findings.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Page header (title + unread badge) | `unreadCount` (from this screen's own `useNotifications` hook, then pushed into the shared context via `setUnreadCount`, `notifications.tsx:36-38`) | see Findings #1 |
| Filter chips | client-side count only via filtering `items`, no per-category counts shown (unlike Tasks tab's chip badges) — a deliberate simpler design, not a bug |
| Notification row (`NotificationListItem`) | `notification.title/body/read/createdAt`, derived `category` (via `resolveNotificationCategory`), derived route (via `resolveRiderNotificationRoute`) | tapping marks read (optimistic local update, then a `PATCH`) and navigates if a route was resolved — see Findings #2 (fixed) |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Mark notification read (tap) | no | n/a | implicit — `notification.read` guard in `handlePress` (`notification-list-item.tsx:36`) means a second tap on the same row is a no-op for the read-mutation (though it would still re-navigate) | partial — `markRead` (`use-notifications.ts:38-50`) optimistically flips `read` locally *before* the API call; on failure it silently re-`load()`s to reconcile rather than showing an error, so a failed mark-read is invisible beyond the badge/row reverting a moment later. Low-severity since the worst case is a notification appearing read then un-reading itself, not data loss. |

## Authorization
Both endpoints scoped to `req.user.sub` — no cross-rider access. `markNotificationRead`'s not-found-instead-of-forbidden response for a mismatched `userId` is a reasonable choice (doesn't confirm whether the id exists for another user).

## Findings

1. **Two different unread-count sources (20 vs 50 most-recent) can disagree.** `RiderOperationsContext.loadNotifications` (see [home.md](home.md) Data flow) calls `GET /riders/notifications` with no `limit` param (defaults to 20, `riders.controller.ts:271`) purely to derive the badge count shown across the app (home, profile). This screen's own `useNotifications(50)` fetches 50 and, while mounted, overwrites the context's `unreadCount` via `setUnreadCount` (`notifications.tsx:36-38`) with a count derived from a *larger* window. If a rider has more than 20 notifications with unread ones beyond the 20 most recent, the badge shown elsewhere in the app (computed from the context's 20-item fetch) can under-count relative to what this screen would show. This is inherent to deriving "unread count" by counting `read:false` over an arbitrarily-capped page rather than a dedicated backend aggregate — left unfixed since a proper fix (a `GET /riders/notifications/unread-count` endpoint, or computing it via a `countDocuments({userId, read:false})` instead of paging) is a small backend addition but changes a response contract multiple callers depend on; flagging for a dedicated pass rather than picking one arbitrary limit to reconcile the two callers.

2. **Notification tap could route to the wrong task leg for unrecognized types — `[fixed]`.** `resolveRiderNotificationRoute` (`notification-types.ts`, pre-fix) fell back to `{kind:'pickup', orderId}` for *any* order-related notification whose `type`/`status` didn't match a known pickup or delivery pattern — including a future notification type added on the backend without a matching frontend case, or an `assignment_reassigned` notification (a real type defined in `rider-notification.constants.ts:26` on the backend with no explicit frontend routing case). Since `PickupService.getOrderForRider` (see [home.md](home.md) Authorization) only allows a rider to open `/pickup/[id]` for an order that's either an open offer or assigned to *them* as the pickup rider, guessing wrong for a delivery-only assignment would send the rider to a screen that fails to load with a generic "Could not load pickup task" error (`pickup/[id].tsx:267-274`) — confusing, though not a security issue since the backend's own scoping still blocks the wrong data from loading.
   **Fix:** changed the fallback from guessing `'pickup'` to returning `null` (no navigation) — `apps/rider-mobile/src/lib/notification-types.ts:96-99`. Tapping such a notification now still marks it read (the primary action `NotificationListItem.handlePress` always performs) but simply doesn't navigate, rather than navigating somewhere wrong. Verified both consumers of `resolveRiderNotificationRoute` (`notification-list-item.tsx:31`, `use-push-notifications.ts:15-31`) already null-check the result before acting on it, so this fix required no changes at either call site.

## Unused/dead fields
- `useNotifications`'s `markAllRead` (`use-notifications.ts:52-55`) is exported but never called anywhere in the app — there's no "Mark all read" affordance on this screen. Not a bug (nothing depends on it), just dead code; not removed since it's plausibly intended for a near-future UI addition rather than leftover cruft, and removing a working, correctly-scoped function isn't a "fix" this audit should make unilaterally.
- The frontend's `inferCategoryFromType` (`notification-types.ts:51-65`) duplicates the backend's `inferRiderNotificationCategory` (`rider-notification.constants.ts:29-47`) type-string-to-category mapping — the same "two hand-maintained copies of a classification list" pattern already flagged for `RIDER_DOCUMENT_TYPES` in [documents.md](documents.md) Findings #1. Lower severity here because `resolveNotificationCategory` always prefers the backend-supplied `notification.category` first (`notification-types.ts:41-49`), and the backend tags every notification with a `category` at creation time — so this frontend fallback is effectively dead code in normal operation, only exercised if a notification somehow reaches the client without a `category` field. Noting for completeness rather than re-flagging as a separate cross-package finding.

## Loading/error/realtime behavior
Independent `loading`/`refreshing`/`error` state with a clean full-screen-loading vs. full-screen-error split (only when there's no cached data, `error && items.length===0`). Refreshes on every screen focus (`useFocusEffect`, `notifications.tsx:40-44`) in addition to pull-to-refresh — appropriate for a screen the rider might return to after acting on a push notification. No live socket subscription for new notifications while this screen is open; a new notification arriving mid-session would only appear after the next focus-triggered or manual refresh, which is a reasonable trade-off for a notification list (push notifications themselves, via `use-push-notifications.ts`, are the actual real-time delivery mechanism — this screen is the persistent log, not the live channel).
