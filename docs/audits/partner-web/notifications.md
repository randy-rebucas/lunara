# Audit: Partner-web — Notifications

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/notifications/page.tsx`
- Component(s): `NotificationListItem` (`components/notification-list-item.tsx`), shared `useNotifications` hook (`hooks/use-notifications.ts`)

## Sub-pages
None — no dynamic detail route. Clicking a notification navigates to an
existing sibling page (`/orders/incoming`, `/orders`, `/orders/progress`,
`/orders/:id`, `/orders/:id/receiving`, `/messages`) via
`resolvePortalNotificationRoute`/`notificationRouteToPath`, not a detail view
of this page's own data — verified every one of those route targets actually
exists in `apps/partner-web/src/app`.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List notifications | GET | `/partner/notifications?limit=50` | `PortalNotification[]` | `PartnerController.listNotifications` -> `PartnerNotificationsService.listNotifications` |
| Mark one read | PATCH | `/partner/notifications/:id/read` | — | `PartnerController.markNotificationRead` -> `PartnerNotificationsService.markNotificationRead` |
| Mark all read | PATCH | `/partner/notifications/read-all` | — | `PartnerController.markAllNotificationsRead` -> `PartnerNotificationsService.markAllRead` |
| Realtime new-notification push | socket (`/tracking` namespace, `joinPartnerPortal` -> `partnerNotification` event) | — | triggers a full `refresh()`, not an incremental append | `TrackingGateway.emitPartnerNotification` |

## Backend trace
Unlike Messages (shop-wide conversation, see `docs/audits/partner-web/messages.md`),
notifications are correctly per-*user*, not per-shop: `listNotifications`,
`markNotificationRead`, and `markAllRead` all filter/update by the exact
`userId` from the JWT (`req.user.sub`), and `markNotificationRead` explicitly
404s if the notification's `userId` doesn't match the caller
(`partner-notifications.service.ts:36-41`) — a partner and their staff each
correctly get their own independent notification feed, which is the right
model here (each login should know about their own assignments/read state,
unlike the shared support conversation). `listNotifications` clamps `limit`
to `[1, 100]` server-side regardless of what the client requests
(`Math.min(Math.max(limit, 1), 100)`) and derives `category` from
`data.category` or a `data.type` -> category lookup
(`inferPartnerNotificationCategory`) when the stored notification predates an
explicit category field — no N+1, single indexed-by-nature `find` + `sort` +
`limit`.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Unread count banner + "Mark all read" action | `unreadCount` (client-derived: `items.filter(i => !i.read).length`, not a server-provided count) | |
| Notification list items | `title`, `body`, `read`, `category` (via `resolveNotificationCategory`, prefers explicit `category`/`data.category`, else a `data.type` -> category switch also duplicated as `inferPartnerNotificationCategory` server-side — see Findings), `data.branchName` (conditional), `createdAt` (via `formatNotificationTime`), and a derived action link (`resolvePortalNotificationRoute` + `notificationRouteToPath`/`notificationActionLabel`) | clicking an unread item marks it read then navigates, in that order |
| Empty state | n/a | shown when not loading, no error, and zero items |
| Manual "Refresh" link | n/a | only rendered once `items.length > 0`; there's no way to manually retry a refresh from an *empty* state other than the "Try again" link shown on error |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Mark one read (row click) | no | n/a | implicit — the item briefly shows "read" styling immediately (optimistic), a second click on an already-read item skips the mark-read call entirely (`if (!notification.read)` guard in `NotificationListItem.handleClick`) | on failure, silently resyncs via `load()` rather than surfacing an error — acceptable for a low-stakes read-receipt, the optimistic state gets corrected either way |
| Mark all read | no | n/a | no explicit guard, but idempotent and cheap enough that a double-click has no real consequence | same silent-resync-on-failure pattern as above |

## Authorization
All three `/partner/notifications*` routes are `@Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)` (`partner.controller.ts:382,391,397`), matching the frontend's `useProtectedPage({ roles: [PARTNER, STAFF, ADMIN] })` — unlike Messages, this page correctly includes `STAFF` on both sides. Data is scoped to the caller's own `userId` throughout, with an explicit ownership check on the single-item mark-read route; no request param can widen this to another user's notifications (there's no `userId`/`branchId` query param accepted by any of the three routes at all). No `[authz]` issues.

## Findings

1. **[FIXED] [shared-code pattern] A failed background refresh wiped the entire notification list to empty.** `useNotifications`'s `load()` (pre-fix, `hooks/use-notifications.ts:25-27`) called `setItems([])` in its `catch` block — so a transient network error during `refresh()` (including the one triggered by every incoming realtime `partnerNotification` socket event, `page.tsx:19-23`) would blank the whole list back to the "No notifications yet" empty state instead of just showing an error over the last-good data. This is the same bug class already found and fixed in `usePartnerQuery` for `docs/audits/partner-web/inventory.md` (a different hook, not the one fixed there, but the identical anti-pattern) — worth calling out since it's the second independent hook in this app found with the same mistake.
   **Fix:** removed `setItems([])` from the `catch` block, matching the "keep previously loaded data on screen" convention already established in `usePartnerQuery` and the shared `@lunara/hooks` `useAsyncQuery` — `apps/partner-web/src/hooks/use-notifications.ts:25-27`. Checked the hook's other consumer, `components/portal-notifications-bell.tsx` (the nav bell badge) — it benefits from the same fix (a transient error no longer drops the badge count to 0) with no behavior it relied on removed.

2. Category derivation logic is duplicated: `resolveNotificationCategory` (frontend, `lib/notification-types.ts:51-82`) and `inferPartnerNotificationCategory` (backend, referenced in `partner-notifications.service.ts:29`) both map the same `data.type` strings to the same category enum, independently. They agree today, but nothing enforces they stay in sync if a new notification `type` is added on one side and not the other — a plausible future source of a notification silently falling into "System" on one surface but not another (e.g. if this same `data.type` is also read by a different client, like customer-mobile). Left unfixed: consolidating into one shared mapping (e.g. in `@lunara/utils` or `@lunara/types`) is a larger cross-package refactor, not a page-level bug — the two are correctly in sync today, so nothing is broken right now.

No authorization or data-flow mismatch issues found — every field `PortalNotification` declares is rendered, and the frontend's category/route-resolution logic correctly handles every notification `type` the backend's `inferPartnerNotificationCategory` (referenced, not modified in this pass) enumerates.

## Unused/dead fields
None — every field the three endpoints return or accept is used by this page
or its list item component.

## Loading/error/realtime behavior
`useNotifications` manages `loading`/`refreshing`/`error` itself (not
`usePartnerQuery`, since it needs the extra `refreshing` flag to distinguish
"first load" spinner from "manual/background refresh" — a reasonable reason
to not reuse the shared hook here). Initial load shows the shared
`DataPageStatus` spinner; a failed initial load (no items yet) shows a
dedicated "Try again" link in addition to the error text; after the fix, a
failed *background* refresh (manual or socket-triggered) now correctly
leaves prior items on screen with just the error line shown above them,
matching the pattern elsewhere in this app. Realtime updates don't append
incrementally — every `partnerNotification` socket event triggers a full
`refresh()` (re-fetches the whole list) rather than inserting just the new
item; acceptable at this feature's scale (≤100 items, human-triggered
notification volume), not flagged as a performance issue.
