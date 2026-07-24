# Audit: Admin-web — Messages (partner support conversations)

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/messages/page.tsx` -> `MessagesBoard` (`apps/admin-web/src/components/datacenter/messages-board.tsx`)
- Embedded component: `ConversationPane` (`apps/admin-web/src/components/conversation-pane.tsx`) — a substantial chat UI with its own fetch/mutation/realtime surface, given full treatment below rather than a one-line note, even though it's not a routed sub-page.

## Sub-pages
None — no outbound navigation into a detail route. The conversation view is an
embedded component (`ConversationPane`), not a route; see above.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Conversation list | GET | `/admin/messages` | `ConversationListItem[]` | `AdminMessagingController.listConversations` -> `MessagingService.listAllConversations` |
| Conversation detail (list's right rail + pane header) | GET | `/admin/messages/:id` | `ConversationDetail` | `AdminMessagingController.getConversationDetail` -> `MessagingService.getConversationDetail` |
| Message history (pane) | GET | `/admin/messages/:id/messages` | `{ items: ChatMessage[] }` | `AdminMessagingController.listMessages` -> `MessagingService.listMessages` |
| Send message (pane) | POST | `/admin/messages/:id/send` | `ChatMessage` | `AdminMessagingController.sendMessage` -> `MessagingService.sendMessage` |
| Upload attachment (pane) | POST (multipart) | `/admin/messages/:id/upload` | `MessageAttachment` | `AdminMessagingController.uploadAttachment` -> Cloudinary upload |
| Mark read (pane, on open + on new message) | PATCH | `/admin/messages/:id/read` | — | `AdminMessagingController.markRead` -> `MessagingService.markRead` |
| Realtime new-message push | socket | `onNewMessage` | `ChatMessage` | `subscribeAdminRealtime` (shared with other boards, e.g. accounting's rider links) |

Note: there's a **second, partner-facing controller** on the same messaging
feature — `MessagingController` (`@Controller('partner/messages')`,
`@Roles(PARTNER, STAFF, ADMIN)`) — used by partner-web, not this admin page,
but sharing the same `MessagingService` and, critically, the same
authorization gap found in Finding 1.

## Backend trace
`listAllConversations` finds up to 50 most-recently-updated conversations (hard
cap, see Finding 5), then batch-loads the owning users and branches via `$in`
queries — this part was already efficient. `getConversationDetail`/
`listMessages` are straightforward. `sendMessage` creates a message document and
updates the conversation's `lastMessageId`/unread counters; `markRead` flips an
unread counter and bulk-updates message `readAt`. Neither `sendMessage` nor
`markRead` checked conversation ownership before this pass — see Finding 1.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Header stat chips | `items.length`, client `unreadCount` (count of conversations with `unreadCount > 0`) | Full use. |
| Conversation list | `recipient.branchName`/`.branchCode` (via `initials`), `lastMessage.{content,attachments,createdAt}` (via `timeAgo`), `unreadCount` | `partnerId` is declared on `ConversationListItem` but never read anywhere in `messages-board.tsx` — see Unused/dead fields. |
| Right rail — Contact/Location/Conversation | `recipient.{email,phone,line1,city,province}`, `detail.createdAt`, `selected.unreadCount` | Full use; `email`/`phone` are real PII, appropriately admin-only for a support-context conversation with a business partner (not a customer), reasonable exposure for the audience. |
| `ConversationPane` — message list | Every `ChatMessage` field: `senderRole` (bubble alignment/label), `content`, `attachments[]` (image vs. generic-file rendering via `AuthenticatedImage`/plain link), `createdAt` | Attachments render through `AuthenticatedImage` for images (auth-gated fetch + blob URL) — consistent with that component's purpose for access-gated media, unlike the Cloudinary-public-URL pattern used for partner branding/addon images (different asset classes, correctly handled differently). |
| `ConversationPane` — composer | `content`, `pendingAttachment`, `uploading`/`sending` state | Full use. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Send message | no | n/a | yes, `disabled={sending \|\| uploading \|\| (!content.trim() && !pendingAttachment)}` | yes |
| Upload attachment | no | n/a | yes, `disabled={uploading}` on the attach button | yes |
| Mark conversation read | no (idempotent, fire-and-forget) | n/a | n/a | silently swallowed on failure (`.catch(() => {})`) — acceptable for a non-critical, automatically-retried-on-next-open background action |

## Authorization
`AdminMessagingController` (backing this admin page) is class-level
`@Roles(UserRole.ADMIN)` — matches the frontend. The messaging feature also has
a second, partner-facing controller sharing the same service — see Finding 1,
tagged `[authz]`, for a real cross-tenant gap found there.

## Findings

1. **[authz] `sendMessage` and `markRead` on the partner-facing controller had no ownership check — any partner or staff user could act on any conversation.**
   `MessagingController` (`@Controller('partner/messages')`,
   `@Roles(PARTNER, STAFF, ADMIN)`) is reachable by every partner and staff
   account, not just admins — it's not the controller this admin page calls,
   but shares the same `MessagingService` this module's endpoints use, so it's
   in scope as the same feature's other half. Its `listMessages` handler
   already calls `this.messaging.assertOwnership(id, user.sub)` for non-admin
   roles (`messaging.controller.ts`, pre-fix) — but `sendMessage` and
   `markRead` (same file) did not call it at all, and neither did the
   underlying `MessagingService.sendMessage`/`.markRead` methods. A partner or
   staff user who knew or guessed another partner's conversation id could
   `POST /partner/messages/:otherPartnersId/send` and inject a message into a
   conversation they don't own (appearing to Lunara support as coming from
   that sender role), or `PATCH .../read` to clear another partner's unread
   badge — a genuine cross-tenant broken-access-control gap, the most
   significant finding of this audit.
   **Fix:** added the same `if (user.role !== UserRole.ADMIN) { await
   this.messaging.assertOwnership(id, user.sub); }` guard already used in
   `listMessages` to both `sendMessage` and `markRead`
   (`messaging.controller.ts`). The admin-facing `AdminMessagingController` was
   never affected (admins are allowed to act on any conversation by design).

2. **`sendMessage`'s request body had no server-side validation, on both controllers.**
   Both `MessagingController.sendMessage` and `AdminMessagingController.sendMessage`
   (pre-fix) declared their body as a plain inline type
   (`{ content?: string; attachments?: any[] }`) rather than a validated DTO
   class — the same class of gap just found and fixed on the Notifications
   broadcast endpoint (`notifications.md`, Finding 1): NestJS's global
   `ValidationPipe` only validates class-decorated parameters, so this ran with
   **no** length limits and a completely untyped `attachments: any[]` accepted
   as-is into the stored message document.
   **Fix:** added `dto/send-message.dto.ts` (`SendMessageDto` +
   `MessageAttachmentDto`, matching the `MessageAttachment` shape from
   `@lunara/types`) with length/size bounds and `@ValidateNested({ each: true })`
   + `@Type(() => MessageAttachmentDto)` on the attachments array (the same
   nested-validation pattern fixed for `PartnerBrandConfig.colors`/`.fonts` in
   `partner-branding.md`), and switched both controllers to it
   (`messaging.controller.ts`).

3. **`listAllConversations` looked up each conversation's last message individually (N+1).**
   The per-conversation `.map(async (c) => { ... this.messageModel.findById(c.lastMessageId) ... })`
   (pre-fix, `messaging.service.ts:168-174`) issued one `findById` per
   conversation (up to 50, run concurrently via the outer `Promise.all` — not
   sequential, but still N round-trips instead of one).
   **Fix:** collected all `lastMessageId`s up front and replaced the per-row
   lookups with a single batched `$in` query, joined via a `Map` — same pattern
   as the existing user/branch batch-loads directly above it in the same
   function (`messaging.service.ts`).

4. **Stale-response race when quickly switching conversations.**
   Both `MessagesBoard`'s selected-conversation detail fetch and
   `ConversationPane`'s per-`conversationId` fetches (detail + message list,
   pre-fix) had no cancellation guard — if an admin clicked conversation A then
   quickly clicked conversation B before A's response arrived, A's late
   response would overwrite the correct data for B (`setDetail`/`setMessages`
   from a stale closure). This is a real, user-visible correctness bug (wrong
   partner's info/messages briefly shown), not just a style nit, since the
   effects fire on every `conversationId`/`selectedId` change and there was
   nothing to prevent the earlier request's callback from running after a
   newer one.
   **Fix:** added a `cancelled` flag (the same pattern used throughout this
   session, e.g. `refunds-board.tsx`'s prior payment-info fetch) to both
   effects, set `true` in the cleanup function so a stale response's
   `setState` calls are skipped (`messages-board.tsx`, `conversation-pane.tsx`).

5. **`listAllConversations` hard-caps at 50 conversations with no pagination.**
   `AdminMessagingController.listConversations` always calls
   `listAllConversations()` with the default `limit = 50`
   (`messaging.service.ts:151`) and there's no `page`/`limit` param wired from
   the frontend or exposed by the controller — if partner-conversation volume
   ever exceeds 50, older conversations become permanently unreachable from
   this list with no indication anything is missing. Left unfixed: this is the
   same class of gap as the Refunds/Withdrawals 100-item caps
   (`refunds.md`/`rider-withdrawals.md`), but lower urgency here since the
   dataset is one conversation per partner account, not per-transaction — with
   partner counts observed elsewhere in this audit series being small (tens),
   50 is unlikely to be hit soon; noted for whoever revisits this once the
   partner base grows.

## Unused/dead fields
- `ConversationListItem.partnerId` is returned by `listAllConversations` and
  declared on the frontend type, but never read anywhere in
  `messages-board.tsx` (the UI always keys/looks up by conversation `_id`, not
  the owning partner's user id). Not sensitive on its own (just an id), left as
  a minor dead field.

## Loading/error/realtime behavior
`MessagesBoard` uses a raw `useEffect` + manual `.then/.catch` for its list
load (not `useAdminQuery`) — unlike most other boards audited this session,
but this one has a genuine reason to diverge: it also needs a live socket
subscription (`subscribeAdminRealtime`) merged into the same list state on
every new message, which doesn't fit `useAdminQuery`'s simple
fetch-and-replace model. Not flagged as an instance of the recurring
"should use the shared hook" finding for that reason. `ConversationPane`
correctly unsubscribes its socket listener and leaves the conversation room on
every `conversationId` change (cleanup runs before the next effect's setup, so
no realtime message can be misattributed to the wrong conversation — only the
initial REST fetches had the race, fixed in Finding 4).
