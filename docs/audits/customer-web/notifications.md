# Audit: Customer-web — Notifications

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/notifications/page.tsx` (`'use client'`)
- Component(s): `PageShell`, `PageHeader`, `DataPageStatus`, `NotificationListItem`; data via `hooks/use-notifications.ts` (`useNotifications`), also consumed by `components/notification-bell.tsx` (header bell/unread badge)

## Sub-pages
None as detail routes — clicking a notification navigates to whatever it points at (`/orders/:id`, `/orders/:id/review`, `/refunds/:id`, `/wallet`, via `resolveNotificationRoute`/`notificationRouteToPath` in `lib/notification-types.ts`), which are separate already-or-yet-to-be-audited modules, not detail views of this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List notifications | GET | `/notifications/me?limit=` | `AppNotification[]` | `ReviewsController.listNotifications` -> `ReviewsService.listNotifications` |
| Mark one read | PATCH | `/notifications/:id/read` | — | `ReviewsController.markRead` -> `ReviewsService.markNotificationRead` |

(Routes live on `ReviewsController` alongside the reviews endpoints — an organizational quirk, not a bug; confirmed both routes are still correctly `@Roles(UserRole.CUSTOMER)`-gated regardless of which controller class they're declared on.)

## Backend trace
`listNotifications` scopes the query to `{ userId: new Types.ObjectId(userId) }` from `req.user.sub` — no request param can widen it. `markNotificationRead` loads the notification by id and explicitly checks `notification.userId.toString() !== userId`, throwing if it doesn't match — a customer cannot mark another customer's notification as read by guessing its id. Both routes are `@Roles(UserRole.CUSTOMER)`-gated. No `[authz]` issues.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Notification list item | `_id`, `title`, `body`, `read`, `createdAt` (via `formatNotificationTime`), `data.type`/`data.orderId`/`data.refundId` (via `resolveNotificationRoute` -> optional "View X →" action label) | unread items get a filled dot + subtle highlight background; clicking any item marks it read (if unread) before navigating |
| Empty state | none | shown only once `!loading && !error && items.length === 0` |
| Refresh button | none — triggers `refresh()` | only rendered once `items.length > 0` |
| "Try again" link (error + empty) | none — triggers `load()` | only shown when `error && items.length === 0`, i.e. the *initial* load failed with nothing to show; a refresh-time failure with existing items just shows the error banner without hiding the list (see Backend/hook trace below) |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Mark notification read (via click-to-navigate) | no | n/a | implicit — `read: true` is optimistically set locally before the PATCH, so a rapid double-click on the same item is a no-op on the second click (`if (!notification.read)` guard in `NotificationListItem`) | on failure, `markRead` re-`load()`s to reconcile state rather than leaving a phantom "read" item that didn't actually persist — reasonable, though this happens silently (no visible error toast for a failed mark-read, just a silent resync) |
| Refresh | no | n/a | yes (`disabled={refreshing}`) | yes (`error`) |

## Authorization
Both endpoints are `@Roles(UserRole.CUSTOMER)`-gated and scoped to `req.user.sub` server-side, with `markNotificationRead` additionally verifying ownership of the specific notification id before mutating it. No `[authz]` issues.

## Findings

1. **[FIXED] `useNotifications`'s `load()` wiped previously-loaded notifications on any fetch error** (`hooks/use-notifications.ts:22-24`, `catch` block called `setItems([])` alongside `setError(...)`) — the same "must preserve prior data on fetch error" bug class already found and fixed in this audit series for `usePartnerQuery`/`useNotifications` **in other apps** (partner-web) and for `use-customer-query.ts` in this app (`docs/audits/customer-web/dashboard.md`, Finding #1) — but this is a **separate, per-app copy** of the hook (`apps/customer-web/src/hooks/use-notifications.ts`, distinct from `apps/partner-web/src/hooks/use-notifications.ts` and the mobile apps' own copies), so the earlier partner-web fix never touched this file. Confirmed via grep that four independent copies of `use-notifications.ts` exist across `customer-web`/`partner-web`/`customer-mobile`/`rider-mobile` — worth flagging as a duplication risk (a bug fixed in one copy silently doesn't propagate to the others) even though consolidating them is out of scope for this pass.
   Concretely, on this page: a transient network blip while refreshing (or the bell's periodic load) would blank out every previously-loaded notification, including ones the customer had already seen and not yet acted on, until the next successful load.
   **Fix:** removed the `setItems([])` call from the catch block in `use-notifications.ts`; `items` now persists across a failed load, with `error` still surfacing the failure via `DataPageStatus`. Regression-checked the hook's only other consumer, `notification-bell.tsx`, which only reads `unreadCount` (derived from `items`) — preserving stale `items` on error just means the unread badge keeps showing its last-known count instead of dropping to zero on a transient failure, which is the correct behavior, not a regression.

## Unused/dead fields
None found — every field on `AppNotification` is used (either rendered directly or consumed by `resolveNotificationRoute` for the click-through action).

## Loading/error/realtime behavior
No polling or socket subscription — notifications only refresh on mount, manual refresh, or a `window.dispatchEvent(new CustomEvent('lunara-notifications-bump'))` triggered elsewhere in the app (the hook listens for this event and reloads). `DataPageStatus` handles the loading/error display for the initial load; **[FIXED]** a failed *refresh* no longer discards already-shown notifications (see Finding #1).
