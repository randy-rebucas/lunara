# Audit: Customer-mobile — Notifications

Date: 2026-07-24

## Entry point
- Screen: `apps/customer-mobile/app/notifications.tsx`
- Component(s): `NotificationListItem`, `Card`, `DataLoadState`; data via `hooks/use-notifications.ts` (`useNotifications`), also consumed by `components/notifications-preview.tsx` (`NotificationsPreview`, `NotificationBell`)

## Sub-pages
None as detail routes — tapping a notification navigates to whatever it points at (order/review/refund/wallet), matching the same `resolveNotificationRoute` logic already traced for customer-web.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List notifications | GET | `/notifications/me?limit=` | `AppNotification[]` | already traced in `docs/audits/customer-web/notifications.md` |
| Mark one read | PATCH | `/notifications/:id/read` | — | same |
| Mark all read (mobile-only capability) | PATCH | `/notifications/read-all` | — | `ReviewsController.markAllRead` -> `ReviewsService.markAllNotificationsRead` — scoped to `req.user.sub`, confirmed |

## Backend trace
Same already-traced, correctly-scoped endpoints, plus `markAllNotificationsRead` (not present on the customer-web notifications page, a mobile-only affordance) — also correctly scoped via `updateMany({ userId, read: false }, { read: true })`.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| "Mark all read" row (only shown when `unreadCount > 0`) | none — triggers `markAllRead()` | optimistically marks all items read locally, reverting on failure (see Mutations) |
| Notification list item | same fields as the web version (`title`, `body`, `read`, `createdAt`, `data.*` for routing) | |
| `NotificationsPreview`/`NotificationBell` (used elsewhere, e.g. home screen) | `items` (sliced), `unreadCount` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Mark one read (via tap-to-navigate) | no | n/a | implicit no-op on second tap of an already-read item (`NotificationListItem`'s own guard) | on failure, `markRead` re-`load()`s to reconcile rather than leaving a phantom "read" state — same pattern as web |
| Mark all read | no | n/a | n/a — single button, optimistic update makes rapid re-taps harmless (all items already show read after the first tap) | yes — on failure, `markAllRead` explicitly reverts `items` back to the pre-tap snapshot (`previous`) rather than leaving a false "all read" state that doesn't match the server; more robust than a simple reload-on-failure since it doesn't require a network round-trip to recover visually |
| Pull-to-refresh / focus-triggered refresh (`useFocusEffect`) | no | n/a | n/a | yes (`error`) |

## Authorization
Both endpoints scoped to `req.user.sub` server-side (confirmed `markAllNotificationsRead` independently, `listNotifications`/`markNotificationRead` already confirmed for web). No `[authz]` issues.

## Findings

1. **[FIXED] `useNotifications`'s `load()` wiped previously-loaded notifications on any fetch error — the exact same bug already found and fixed in customer-web's copy of this hook** (`docs/audits/customer-web/notifications.md`, Finding #1), confirming the duplication risk flagged there: four independent per-app copies of `use-notifications.ts` exist, and fixing one doesn't propagate to the others. This mobile copy (`apps/customer-mobile/src/hooks/use-notifications.ts:19-21`) still had `setItems([])` in its catch block. Concretely, on this screen a transient refresh failure would blank the full notifications list; on `NotificationsPreview` (used elsewhere, e.g. the home screen) it was worse — that component returns `null` entirely once `!loading && previewItems.length === 0`, so a failed background refresh would make the whole "Notifications" section on the home screen silently disappear rather than just showing stale data; `NotificationBell`'s unread badge would also spuriously drop to 0.
   **Fix:** removed the `setItems([])` call from the catch block, matching the customer-web fix exactly. Regression-checked both other consumers (`NotificationsPreview`, `NotificationBell`) — both only ever read `items`/`unreadCount` for display, neither branches on `items` being exactly `null`/empty in a way the fix would break; both now correctly show stale-but-present data instead of vanishing/zeroing on a transient error.

## Unused/dead fields
None found.

## Loading/error/realtime behavior
Refreshes on `useFocusEffect` (every time the screen gains focus) in addition to a `syncTick` store value bumped elsewhere in the app (push-notification-triggered sync, not otherwise re-traced here). `DataLoadState` handles the full-screen loading/error state for the initial load; **[FIXED]** a failed refresh after that no longer wipes the list (Finding #1).
