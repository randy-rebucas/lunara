# Audit: Admin-web — Notifications (push broadcast)

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/notifications/page.tsx` -> `NotificationsBoard` (`apps/admin-web/src/components/datacenter/notifications-board.tsx`)

## Sub-pages
None — no outbound navigation into a detail route. The "detail" for a past
broadcast is an in-page right-rail preview, not a route.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Audience device counts | GET | `/admin/broadcast/audience-counts` | `AudienceCounts` | `AdminController.getBroadcastAudienceCounts` -> `PushNotificationService.getAudienceDeviceCounts` |
| Broadcast history | GET | `/admin/broadcast/history` | `BroadcastHistoryItem[]` | `AdminController.getBroadcastHistory` -> `PushNotificationService.listBroadcasts` |
| Send broadcast | POST | `/admin/broadcast` | `{ success, sent }` | `AdminController.broadcast` -> `PushNotificationService.broadcastToAll`/`.broadcastToRole` + `.recordBroadcast` |

## Backend trace
`getAudienceDeviceCounts` aggregates registered push tokens grouped by the
owning user's role (`$group` on distinct `userId`, `$lookup` into `users`,
`$group` by role) — a real per-role device count, not an estimate.
`listBroadcasts` is a simple sorted+limited find. `broadcast()` (pre-fix) took
an untyped inline object as its body — see Finding 1. `broadcastToAll`/
`broadcastToRole` funnel into `sendToTokens`, which (pre-fix) sent one Firebase
Cloud Messaging call per device **sequentially inside the single HTTP
request** — see Finding 2, the most significant finding in this audit.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Stat tiles (4) | `items.length` (all-time sent), client-summed `totalRecipients` (sum of `sentCount` across history), `totalDevices` (sum of all `counts.*`), `counts.customer` | All derived from the two small, uncapped datasets (broadcast history, audience counts) — no pagination/truncation concerns given the low volume of broadcasts sent. |
| Compose form — audience picker | `AUDIENCE_OPTIONS` (static list) cross-referenced with live `counts[audience]` via `reachFor()` | Shows a live device-reach number per audience before sending — good, this is exactly the kind of visibility that should precede a broadcast; previously not backed by a confirmation step, see Finding 3. |
| Compose form — title/body | Client `maxLength={65}`/`{240}` | Previously not enforced server-side at all — see Finding 1, now matched exactly (65/240) in the new DTO. |
| Compose form — live preview | `title`/`body` (client state, not fetched) | Cosmetic preview of the push notification appearance, no backend involvement. |
| Broadcast history table | `title`, `body`, `audience` (via `audienceLabel`), `createdAt` (via `formatSentAt`), `sentCount` | Full use. |
| Right rail — broadcast detail | `selected.{audience,createdAt,sentCount,createdByName,title,body}` | Full use. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Send notification | yes — an irreversible push blast to potentially every registered device on the platform ("All users"), with no recall mechanism | no (pre-fix) | yes, `disabled={sending \|\| !title.trim() \|\| !body.trim()}` | yes |

## Authorization
`AdminController` is class-level `@Roles(UserRole.ADMIN)` — matches the
frontend (admin-only page). No role-scoped filter to widen (an admin choosing
"all"/a specific role as the broadcast audience is the intended admin
capability, not a privilege-escalation vector) — no `[authz]` findings.

## Findings

1. **[authz-adjacent] The single highest-blast-radius endpoint in the audited app had zero server-side input validation.**
   `AdminController.broadcast` (pre-fix, `admin.controller.ts:621-623`) declared
   its body as a plain inline TypeScript type
   (`{ title: string; body: string; audience?: 'all' | UserRole }`) instead of a
   validated DTO class. NestJS's `ValidationPipe` (configured globally with
   `whitelist`/`forbidNonWhitelisted`/`transform`, `main.ts:29-33`) only applies
   when the parameter type is a class carrying `class-validator` decorators — a
   plain inline type has none, so **no validation ran at all**: no length limits
   (the frontend's 65/240-char caps were purely cosmetic), no `audience` enum
   check (an arbitrary string would silently fall through to
   `broadcastToRole()` and just match zero users), and no required-field check
   (a malformed request with a missing `title`/`body` would have gone straight
   into `broadcastToAll({ title: undefined, body: undefined })`, sending blank
   notifications to every device on the platform). Every other mutation
   endpoint audited this session goes through a real DTO class.
   **Fix:** added `dto/broadcast.dto.ts` (`BroadcastDto`) with `@IsString()` +
   `@MinLength(1)` + `@MaxLength(65|240)` on `title`/`body` (matching the
   frontend's existing limits exactly) and `@IsIn(['all', ...UserRole values])`
   on `audience`, and switched the controller parameter to it
   (`admin.controller.ts`).

2. **Broadcasting to a large audience sent one Firebase push per device, sequentially, inside a single HTTP request.**
   `PushNotificationService.sendToTokens` (pre-fix,
   `push-notification.service.ts`) looped over every token and `await`ed
   `messaging.send()` one at a time. For a broadcast to "All users" — every
   registered device on the platform — this meant the admin's `POST /admin/broadcast`
   request wouldn't resolve until every single device had been contacted in
   turn; at any non-trivial device count this would very plausibly exceed
   typical HTTP/reverse-proxy timeouts, leaving the admin looking at a "failed"
   request in the UI while the send loop kept running to completion server-side
   regardless (a confusing, misleading failure that isn't actually a failure).
   **Fix:** rewrote `sendToTokens` to batch via Firebase's
   `messaging.sendEachForMulticast()` (500 tokens per call — FCM's per-request
   cap), turning a broadcast to N devices into `ceil(N/500)` round-trips instead
   of N, while preserving the exact same invalid-token pruning and sent-count
   behavior per-token via the batch response's per-message results
   (`push-notification.service.ts`). Regression-checked: `sendToTokens` is also
   called by `sendToUser`/`sendToUsers` (single/targeted notifications
   elsewhere in the app) — its public signature and return value are unchanged,
   so those callers are unaffected.

3. **"Send notification" had no confirmation before an irreversible platform-wide blast.**
   `send()` (pre-fix, `notifications-board.tsx:146-165`) submitted directly from
   the form with no confirmation step, despite the UI already computing and
   displaying the exact device-reach count for the selected audience right next
   to the button. Same class of finding as the un-confirmed refund-processing
   and partner-deactivation actions fixed earlier this session, but with a
   larger and less recoverable blast radius than either (a push notification,
   once sent, can't be recalled from any device).
   **Fix:** added a `window.confirm` stating the audience label and the exact
   device-reach count before calling the send endpoint
   (`notifications-board.tsx`).

## Unused/dead fields
None — every field on `AudienceCounts`/`BroadcastHistoryItem` is read
somewhere on the page.

## Loading/error/realtime behavior
Two independent `useAdminQuery`s (audience counts, broadcast history) — a
successful send reloads both in parallel (`Promise.all`). No realtime
subscription or polling; reasonable for a low-frequency marketing broadcast
tool with no other actor pushing changes.
