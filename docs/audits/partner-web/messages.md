# Audit: Partner-web — Messages

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/messages/page.tsx`
- Component(s): `MessageBubble` (inline in the page file)

## Sub-pages
None — no outbound navigation into a dynamic detail route. This is a
single-conversation chat view (one shop ↔ Lunara support thread), not a list
with detail sub-pages.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Get/create conversation | GET | `/partner/messages` | `PartnerConversation` | `MessagingController.getConversation` -> `MessagingService.getOrCreateConversation` |
| List messages | GET | `/partner/messages/:id/messages` | `{ items: ChatMessage[] }` | `MessagingController.listMessages` -> `MessagingService.listMessages` |
| Mark read | PATCH | `/partner/messages/:id/read` | — | `MessagingController.markRead` -> `MessagingService.markRead` |
| Upload attachment | POST (raw `fetch`, not `partnerFetch`) | `/partner/messages/:id/upload` | `MessageAttachment` | `MessagingController.uploadAttachment` |
| Send message | POST | `/partner/messages/:id/send` | `ChatMessage` | `MessagingController.sendMessage` -> `MessagingService.sendMessage` |
| Realtime new-message push | socket (`/tracking` namespace, `newMessage` event) | — | `ChatMessage` | `TrackingGateway` |

## Backend trace
Conversations are one-per-shop, keyed by `Conversation.partnerId`
(`getOrCreateConversation` does `findOne({ partnerId })` or creates one).
`listMessages` supports real cursor pagination (`before`/`limit`, sorted
`_id: -1` then reversed) but this page never sends `before` and always uses
the default `limit = 30` — see Finding #3. `sendMessage`/`uploadAttachment`
are otherwise straightforward: attachments upload to Cloudinary
(`lunara/message-attachments`) via `CloudinaryStorageService`, validated by a
server-side MIME allowlist (`attachmentUploadOptions.fileFilter`) matching
the same set the frontend's `<input accept>` already restricts to.
`assertOwnership` and the realtime gateway's `joinConversation` handler both
gate access by comparing the conversation's `partnerId` against the caller —
see Finding #1 for what was wrong with that comparison for `STAFF` accounts.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Message list | `messages[].senderId` (vs. locally-derived `myId`, for bubble alignment), `.senderName`, `.content`, `.attachments[].mimeType/url/filename`, `.createdAt` | image attachments render via `AuthenticatedImage`; non-image attachments render as a filename link; both open the resolved media URL in a new tab |
| Compose bar | local `content`/`pendingAttachment`/`pendingPreview` state | Enter sends, Shift+Enter inserts a newline; attach button opens a hidden file input restricted to the same MIME/extension set the backend enforces |
| Loading/empty states | `conversation`, `messages.length` | "Loading conversation…" before `conversation` resolves, "No messages yet" once it has but with zero messages |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Send message | no | n/a | yes (`disabled={sending || uploading || !conversation || (!content.trim() && !pendingAttachment)}`) | yes (`error`) |
| Upload attachment | no | n/a | yes (attach button `disabled={uploading || !conversation}`) | yes (`error`), and clears the broken preview on failure |
| Remove pending attachment | no | n/a | n/a | n/a — **before fix**, clicking remove during an in-flight upload didn't actually cancel it, see Finding #2 |
| Mark conversation read | no, side-effecting only | n/a | fire-and-forget (`void partnerFetch(...)`), no loading/error UI — acceptable, it's a passive read-receipt, not a user-initiated action |

## Authorization

`GET/PATCH/POST /partner/messages*` are `@Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)` (`messaging.controller.ts:46-48`) — matches the frontend (`useRequirePartner`... actually this page uses `useRequirePartner`, which only allows `PARTNER`/`ADMIN`, not `STAFF` — see Finding #4). Ownership is enforced two ways: `assertOwnership` on every REST call except `ADMIN`, and an equivalent check in `TrackingGateway.handleJoinConversation` for the realtime socket join. **[authz] Both were broken for `STAFF` accounts before the fix**, tagged as Finding #1 — a shop's staff member was being compared against a conversation keyed by their *employer's* userId using their *own* userId, which can never match.

## Findings

1. **[authz] [FIXED] Staff accounts got their own separate, empty conversation instead of joining their shop's real support channel — and their realtime message join was rejected as Forbidden.** `MessagingController.resolvePartnerId` (pre-fix) returned `user.sub` unconditionally for every role. A shop's conversation is looked up/created by `partnerId` (`MessagingService.getOrCreateConversation`, keyed on the *owning partner's* userId) — so when a `STAFF` account (whose `sub` is their own user id, not their employer's) called `GET /partner/messages`, it silently created a brand-new, empty conversation keyed by the staff member's own id instead of returning the shop's actual conversation with Lunara support. The partner owner and their staff would each see a completely different message history despite this page's own description text ("Direct support channel with Lunara") implying one shared shop channel. Separately, `TrackingGateway.handleJoinConversation` had the identical comparison bug (`convo.partnerId.toString() !== user.sub`), so even after fixing the REST side alone, a staff member's socket join to the (now-correct) conversation room would still be rejected as `Forbidden`, silently breaking live message push for staff specifically while REST fetch/send worked.
   **Fix:**
   - Added `MessagingService.resolveConversationOwnerId(userId, role)` — for `STAFF`, looks up their `branchId` then that branch's `partnerUserId`; otherwise returns `userId` unchanged — `apps/api/src/modules/messaging/messaging.service.ts`.
   - `MessagingController.resolvePartnerId` and every `assertOwnership(id, ...)` call now await this resolution instead of using raw `user.sub` — `apps/api/src/modules/messaging/messaging.controller.ts`.
   - **Regression-checked the realtime gateway**, which shares the exact same root cause: `TrackingGateway.handleJoinConversation` now resolves the same way (a local mirror of the service method, to avoid introducing a circular `MessagingService` ↔ `TrackingGateway` dependency — they already depend on each other via `forwardRef` for the opposite direction) — `apps/api/src/modules/realtime/tracking.gateway.ts`, with `User`/`Branch` schemas added to `RealtimeModule`'s `MongooseModule.forFeature` to support it.
   - Per-message `senderId` attribution was already correct before this fix (`sendMessage` is called with the actual sender's own `user.sub`, not the resolved owner id) — confirmed the fix doesn't touch that, so message bubbles still correctly attribute each message to whoever actually sent it.
   - Typechecked `apps/api` clean.

2. **[FIXED] Canceling an in-flight attachment upload didn't actually cancel it.** `removePending()` (pre-fix) cleared `pendingAttachment`/`pendingPreview` but the "✕ remove" button has no `disabled` guard tied to `uploading`, so a user could click it while `handleFileChange`'s upload `fetch` was still in flight. When that fetch eventually resolved, its `.then`-equivalent (`setPendingAttachment(att)`) would fire regardless, silently resurrecting the attachment the user had just dismissed.
   **Fix:** added an `AbortController` (`uploadAbortRef`), passed as the fetch's `signal`; `removePending()` now aborts it, and the success path checks the ref still points at the same controller before calling `setPendingAttachment` — `apps/partner-web/src/app/messages/page.tsx`.

3. Message history is capped at the most recent 30 messages with no way to see older ones — `listMessages` supports proper cursor pagination (`before`/`limit`) but this page never sends `before`, and there's no "load older messages" control or infinite-scroll-up behavior. A long-running shop/support thread's earlier history becomes permanently inaccessible from this UI. Left unfixed: this is a real UI feature (reverse infinite scroll with scroll-position preservation, or a "load more" button) rather than a page-level bug fix, and there's no existing pattern elsewhere in this codebase to mirror.

4. `useRequirePartner()` (this page's guard) only allows `[PARTNER, ADMIN]` (`hooks/use-protected-page.ts:50-52`), while the backend routes it calls are `@Roles(PARTNER, STAFF, ADMIN)` — so `STAFF` accounts are blocked from ever reaching this page client-side, even though the backend (and, after Finding #1's fix, the conversation-resolution logic) is fully built to support them correctly. This mirrors the same ambiguous-intent shape as the `STAFF`-scoping dead code found in `docs/audits/partner-web/customers.md` Finding #5. Left unfixed: whether shop staff should have their own access to the support channel is a product decision (the backend fix in this pass makes it *safe* to enable, but doesn't decide whether it *should* be enabled), not a bug fix in scope here.

5. `getPortalUser()`/`PortalUser` (`packages/types/src/partner.ts:5-9`) has no `id` field — `staffLogin` only stores `email`/`role`/`branchId` from the login response, discarding `user.id`. This page works around that by manually decoding the JWT payload client-side to read `sub` for its own `myId` (`page.tsx:73-82`) — a reasonable pattern for a non-security-critical UI-only value (bubble left/right alignment), but it's a workaround for a real gap in the shared `PortalUser` type. Left unfixed: adding `id` to `PortalUser` and threading it through `staffLogin` is a shared-type change with a wider blast radius than this page, out of scope here.

## Unused/dead fields
None — every field `ChatMessage`/`MessageAttachment`/`PartnerConversation`
return is rendered or used for a decision (e.g. `conversation.unreadCount` is
part of `PartnerConversation` but not surfaced on this page specifically —
checked, it's read elsewhere for the nav badge, not dead, just not this
page's concern).

## Loading/error/realtime behavior
Initial load is a manual `useEffect` + `.then/.catch` (not `usePartnerQuery`)
since this page fetches a single conversation-then-messages sequence rather
than a list — reasonable given the shape of the data. Realtime updates come
via `useMessagingSocket`, which joins the conversation's socket room and
appends incoming messages (de-duplicated by `_id`), marking them read
immediately. A disconnect/reconnect just stops/resumes live pushes; there's
no polling fallback, so a socket outage means new messages only appear after
a manual page reload — acceptable for a low-frequency support-chat page, not
flagged as a bug.
