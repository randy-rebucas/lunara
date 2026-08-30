# Audit: Customer-Web — Support, Chat & Notifications

Date: 2026-08-30

This is a combined pass over the "Support, Chat & Notifications" area. The support
ticket list/detail pages and the notifications page were already fully audited in
`docs/audits/customer-web/support.md` (2026-07-23) and
`docs/audits/customer-web/notifications.md` (2026-07-23, one fix already applied) —
those two docs' full card/mutation/auth tables still stand and are not repeated
here. This pass adds the one piece those docs didn't cover — the globally-mounted
AI chat widget (`ChatWidget`) and its backend (`apps/api/src/modules/ai-agents/`)
— and carries out the fix that `refunds-reviews.md` (2026-08-30) explicitly flagged
but left out of scope: the raw-serializer leak pattern in three more
`SupportService` create endpoints.

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/support/page.tsx` (see `support.md`)
- Page: `apps/customer-web/src/app/(authenticated)/support/[id]/page.tsx` (see `support.md`)
- Page: `apps/customer-web/src/app/(authenticated)/notifications/page.tsx` (see `notifications.md`)
- Component: `apps/customer-web/src/components/chat/chat-widget.tsx` — globally
  mounted (outside the authenticated route group; renders for both guests and
  signed-in customers) — **new to this pass**.
- Lib: `apps/customer-web/src/lib/ai-chat.ts`, `apps/customer-web/src/lib/support-tickets.ts`
  (pure formatting helpers, no fetches), `apps/customer-web/src/lib/notification-types.ts`
  (route-resolution helpers, no fetches), `apps/customer-web/src/hooks/use-notifications.ts`.

## Sub-pages
None new. `support/[id]/page.tsx` and the notifications list were already traced as
this-module's only sub-page/list pair in `support.md`/`notifications.md`. The chat
widget has no sub-page — it's a floating overlay, not a route; "Talk to a human"
is an in-widget view swap (`view: 'chat' | 'escalate' | 'escalated'`), not a
navigation.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List tickets | GET | `/support/tickets` | `Ticket[]` | `SupportController.listMyTickets` -> `SupportService.listCustomerTickets` (see `support.md`) |
| Create general ticket | POST | `/support/tickets` | `{ _id }` | `SupportController.createTicket` -> `SupportService.createGeneralTicket` |
| Create area-coverage request | POST | `/support/area-requests` | — | `SupportController.requestAreaCoverage` -> `SupportService.createAreaCoverageRequest` |
| Ticket detail | GET | `/support/tickets/:id` | `{ ticket, investigation }` | `SupportController.getMyTicket` -> `SupportService.getCustomerTicket` (see `support.md`) |
| List notifications | GET | `/notifications/me?limit=` | `AppNotification[]` | `ReviewsController.listNotifications` -> `ReviewsService.listNotifications` (see `notifications.md`) |
| Mark one read | PATCH | `/notifications/:id/read` | — | `ReviewsController.markRead` -> `ReviewsService.markNotificationRead` (see `notifications.md`) |
| Suggested prompts | GET | `/ai-agents/emma/prompt-library` (or `/ai-agents/guest/emma/prompt-library` for guests) | `string[]` (derived) | `AiAgentsController.getPromptLibrary`/`getGuestPromptLibrary` -> `AiAgentsService.getPromptLibrary` |
| Send chat message | POST | `/ai-agents/emma/messages` (or `/ai-agents/guest/emma/messages`) | `SendMessageResult { conversationId?, message: ChatMessage }` | `AiAgentsController.sendMessage`/`sendGuestMessage` -> `AiAgentsService.sendMessage`/`sendGuestMessage` |
| Escalate to human | POST | `/ai-agents/escalate` (or `/ai-agents/guest/escalate`) | `string` (confirmation message) | `AiAgentsController.escalate`/`escalateGuest` -> `AiAgentsService.escalateToHuman`/`escalateGuestToHuman` |

## Backend trace
`AiAgentsService.sendMessage` resolves the persona (`emma`), rejects it if the
caller's audience isn't allowed (`isAudienceAllowed`), loads/creates a
`conversationModel` document scoped to `userId`, replays up to `HISTORY_WINDOW`
prior messages plus the new one to Claude (with tool-calling rounds capped at
`MAX_TOOL_ROUNDS`), persists both the user and assistant messages, and returns
only `serializeMessage(assistantMessage)` (`ai-agents.service.ts:429-436`) — `id`,
`role`, `content`, `createdAt`; no internal fields (`model`, `personaId`, raw
Claude response) leak through. `getMessages`/existing-conversation sends both call
`findOwnedConversation(userId, conversationId, agentId?)`
(`ai-agents.service.ts:408-420`), which 404s on a missing conversation and throws
`ForbiddenException` if `conversation.userId.toString() !== userId` — a customer
cannot read or continue another customer's chat by guessing/reusing a
`conversationId`. `sendGuestMessage` is fully stateless (no persistence, no tool
registry, single Claude turn) — nothing to scope, so no authz surface there.
`escalateToHuman` calls `SupportService.createGeneralTicket` under the hood (a real
ticket, tagged "Chat hand-off: ..." in the subject) and always emails a fixed
chat-escalation inbox regardless of the configurable admin-notification-email
setting; `escalateGuestToHuman` just emails support with a supplied name/email
(no ticket, no auth — guest identity is unverified, which is expected for an
anonymous "talk to a human" form).

All chat/escalate routes are `@Throttle`-limited per `ai-agents.controller.ts:12-22`
(20/min signed-in messages, 8/min guest messages, 5/min escalations) — a
reasonable guard against runaway Claude spend, not part of this audit's scope to
change.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Floating chat button | none | toggles `open`; icon swaps `MessageCircle`/`X` |
| Chat header | static "Emma · Lunara Support" copy + `view` (drives subtitle text) | — |
| Message list | `messages[].{id,role,content}`, rendered as Markdown for assistant messages (`MarkdownContent`), plain text for user messages | `sending` shows a static "Emma is typing…" indicator, not tied to a field |
| Suggested prompts (empty-state only) | `prompts: string[]` from `fetchSuggestedPrompts` | client caps to first 4 (`.slice(0, 4)`), one per category — a client-side truncation of a list the backend already returns un-truncated; minor, not a defect |
| Escalate form | local `escalateName`/`escalateEmail`/`escalateMessage` state, prefilled from `user?.email` (signed-in) and the last user chat message | `email` field only rendered for guests (`!isAuthenticated`) — matches backend's `EscalateDto` (no email field) vs `GuestEscalateDto` (requires email) split |
| Escalated confirmation | `escalateConfirmation` (server message, falls back to a hardcoded string) | — |

Support-page and notifications-page cards/panels are unchanged from `support.md`/
`notifications.md` and not re-tabulated here.

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Send chat message | no | n/a | yes — `if (!trimmed \|\| sending) return` guard in `handleSend`, `chat-widget.tsx:92` | yes — `setError`, shown under the message input |
| Escalate to human | no | n/a | yes — `Button disabled={escalating}`, `chat-widget.tsx:306` | yes — `setError`, shown above the form buttons |
| Submit general ticket / area-coverage request / mark notification read | — see `support.md`/`notifications.md`, unchanged | | | |

Both new chat mutations are single-fire, non-destructive (creating a message/ticket,
not deleting anything), with visible in-flight disabling and error surfacing —
same standard the rest of this module already meets.

## Authorization
No `[authz]` issues found in the chat backend: `findOwnedConversation` (see Backend
trace) scopes every read/append to the caller's own `userId` server-side, so a
customer cannot list, read, or post into another customer's conversation by
supplying a foreign `conversationId` — confirmed by direct read of
`ai-agents.service.ts:408-420` and its two call sites (`getMessages`,
`sendMessage`). `escalate` is `@Roles(UserRole.CUSTOMER)`-gated and uses
`req.user.sub`, not a client-supplied id, for the ticket's `customerId`. Guest
routes (`sendGuestMessage`, `escalateGuestToHuman`) are intentionally unauthenticated
and stateless — no cross-user data to leak. Support-ticket and notification authz
are unchanged from `support.md`/`notifications.md` (both already confirmed clean).

## Findings

1. **[sensitive-data] `createGeneralTicket` returned the raw (admin-inclusive)
   ticket serializer instead of the customer-safe one.**
   `apps/api/src/modules/support/support.service.ts:135` (pre-fix) returned
   `this.serializeTicket(ticket)` — the same unfiltered shape flagged by
   `refunds-reviews.md`'s Finding #2 for `createLostItemComplaint`, including
   `adminNote`, `riderId`, `photosReviewedAt`, `logsReviewedAt`. This endpoint is
   also the one `AiAgentsService.escalateToHuman` calls under the hood for every
   "Talk to a human" chat hand-off, so the leak applied to both the support page's
   general-ticket form and the chat widget's escalate flow. At creation time these
   fields are unset, so the practical exposure window was narrow, but the endpoint
   was inconsistent with its sibling `listCustomerTickets`/`getCustomerTicket`.
   **Fix:** changed `support.service.ts:135` to `this.serializeTicketForCustomer(ticket)`.
   Regression-checked the only other caller, `AiAgentsService.escalateToHuman`
   (`ai-agents.service.ts:317-323`), which only reads `ticketResult.data.customerEmail`
   — still present on the customer-safe serializer, so unaffected. `apps/api`
   `tsc --noEmit` passes clean.

2. **[sensitive-data] `createAreaCoverageRequest` returned the raw ticket
   serializer on both its success paths (new ticket and "already requested"
   duplicate).** `support.service.ts:263` and `:303` (pre-fix) both returned
   `this.serializeTicket(...)` — same field set as Finding 1. Frontend
   (`support-create-section.tsx`, per `support.md`) never reads ticket fields
   from this response, only `success`/`message`, so this was unused as well as
   sensitive. **Fix:** changed both return sites to
   `this.serializeTicketForCustomer(...)`. No other callers of
   `createAreaCoverageRequest` found (grepped `apps/api/src`).

3. **[sensitive-data] `createRiderIssueTicket` returned the raw ticket serializer
   instead of the rider-safe one.** `support.service.ts:178` (pre-fix) returned
   `this.serializeTicket(ticket)` even though this is a rider-facing endpoint
   (`SupportController.reportRiderIssue`, `@Roles(UserRole.RIDER)`) whose sibling
   read endpoints (`listRiderTickets`, `getRiderTicket`) both correctly use
   `serializeTicketForRider` (which strips `customerId`, `adminNote`,
   `photosReviewedAt`, `logsReviewedAt`). This is technically a rider-mobile
   concern rather than customer-web, but it's the same file/bug class this audit
   was asked to sweep, and fixing it now keeps all four `SupportService` create
   endpoints consistent with their respective read-endpoint serializers. **Fix:**
   changed `support.service.ts:178` to `this.serializeTicketForRider(ticket)`. No
   other callers found (grepped `apps/api/src`); this endpoint is not reachable
   from customer-web at all (rider-mobile only), so no customer-web regression risk.

4. Suggested-prompts list is truncated client-side (`.slice(0, 4)`,
   `ai-chat.ts:51`) after the backend already returns one prompt per category
   un-truncated. Not a defect — just noting the truncation happens on the
   frontend rather than via a `limit` param, so a future category addition
   silently drops out of the last slot rather than the backend deciding what's
   most relevant. Left as-is: cosmetic, no product-decision needed, not worth a
   round-trip change for a 4-item starter list.

No other dead-field, type-mismatch, or authz issues found in the chat backend.
Support-ticket-list/detail and notifications findings are unchanged from
`support.md` (none) and `notifications.md` (one, already fixed in that pass).

## Unused/dead fields
- None found in the chat data flow — `ChatMessage`/`SendMessageResult` fields are
  all either rendered or used for state (`conversationId` threading).
- Support/notifications: unchanged from prior docs (none found).

## Loading/error/realtime behavior
Chat widget uses local `useState` trios (`sending`/`error`, `escalating`/`error`)
rather than the shared `useCustomerQuery` hook — appropriate for a compose-and-send
UI, not a list/detail fetch. No polling or socket subscription anywhere in this
module: chat messages are strict request/response (no live "agent typing" signal
from the server — the "Emma is typing…" indicator is purely client-side, tied to
the local `sending` flag, not a push event), support tickets and notifications
also have no realtime channel (confirmed already in `support.md`/`notifications.md`).
Suggested prompts are fetched once per widget-open (`useEffect` gated on
`open && messages.length === 0 && prompts.length === 0`, `chat-widget.tsx:80-84`)
and silently fall back to an empty list on failure (`fetchSuggestedPrompts`'s
`catch { return [] }`, `ai-chat.ts:52-54`) — reasonable since suggested prompts are
a pure enhancement, not required for the widget to function.
