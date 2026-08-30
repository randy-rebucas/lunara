# Audit: Customer-Web — Refunds, Reviews & Lost Items (submission flows)

Date: 2026-08-30

This audit covers the three per-order *submission* flows reached from order detail — refund
request, lost-item report, and review — which the prior `orders.md`/`support.md`/`refunds.md`
passes explicitly deferred ("thin detail forms, not traced in depth"). The refund list/detail
pages (`/refunds`, `/refunds/[id]`) were already fully audited in `docs/audits/customer-web/refunds.md`
(2026-07-23) and are only re-verified here for the new finding below; see that doc for their
full card/mutation/auth tables. The support-ticket list/detail (`/support`, `/support/[id]`) were
audited in `docs/audits/customer-web/support.md`.

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/orders/[id]/page.tsx` (order detail) — links out
  to the three submission forms.
- Component(s)/sub-pages traced in this pass:
  `apps/customer-web/src/app/(authenticated)/orders/[id]/refund/page.tsx`,
  `apps/customer-web/src/app/(authenticated)/orders/[id]/lost-item/page.tsx`,
  `apps/customer-web/src/app/(authenticated)/orders/[id]/review/page.tsx` (using
  `apps/customer-web/src/components/review/review-form.tsx`,
  `apps/customer-web/src/components/review/star-rating.tsx`).

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/refund/page.tsx` | `ButtonLink` `orders/[id]/page.tsx:796` (only rendered when `order.refundable === true`) | `id` route param | yes — posts `orderId: id` to `/refunds` |
| `orders/[id]/lost-item/page.tsx` | `ButtonLink` `orders/[id]/page.tsx:792`, `Link` `orders/[id]/page.tsx:815` | `id` route param | yes — posts `orderId: id` to `/support/lost-items` |
| `orders/[id]/review/page.tsx` | `ButtonLink` `orders/[id]/page.tsx:776/782` | `id` route param | yes — fetches `/reviews/orders/{id}`, posts `orderId: id` to `/reviews` |
| `refunds/[id]/page.tsx` (post-submit redirect) | `router.push` after refund submit, `orders/[id]/refund/page.tsx:75` | `res.data._id` -> `id` route param | yes |
| `support/[id]/page.tsx` (post-submit redirect) | `router.push` after lost-item submit, `orders/[id]/lost-item/page.tsx:45` | `res.data._id` -> `id` route param | yes |

All three forms redirect on success into an already-audited read-only detail page
(`refunds/[id]` — this doc's finding #1 aside — or `support/[id]`, both in `refunds.md`/`support.md`)
rather than staying on the form, so no further sub-page tracing needed here.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Refund-eligibility precheck | GET | `/payments/orders/{id}` | inline `{ order: { total }, payment: { method, cashTiming? } \| null }` | `PaymentsController.getForOrder` -> `PaymentsService.getForOrder` (already traced in `booking-checkout-orders.md`) |
| Submit refund request | POST | `/refunds` | `{ _id: string }` | `RefundsController.create` -> `RefundsService.createRequest` |
| Submit lost-item report | POST | `/support/lost-items` | `{ _id: string }` | `SupportController.reportLostItem` -> `SupportService.createLostItemComplaint` |
| Review eligibility + existing review | GET | `/reviews/orders/{id}` | `ReviewStatus { canReview, review, orderStatus }` | `ReviewsController.getOrderReviewStatus` -> `ReviewsService.getOrderReviewStatus` |
| Submit review | POST | `/reviews` | `{ review: ReviewData }` | `ReviewsController.submitReview` -> `ReviewsService.createReview` |
| Notifications (mark review-prompt read) | GET/PATCH | `/notifications/me?limit=10`, `/notifications/{id}/read` | inline | `ReviewsController.listNotifications`/`markRead` |

## Backend trace
`RefundsService.createRequest` verifies order ownership (`order.customerId !== customerId` ->
`ForbiddenException`), rejects already-refunded/ineligible-status orders, requires a `PAID`
non-cash payment, and blocks a second concurrent open request for the same order
(`refunds.service.ts:76-112`). On success it fires `tryAutoApprove` (fire-and-forget) which, under
a configured threshold, walks the refund through the same `start_review -> verify_order -> approve
-> process` state machine an admin would use, crediting the customer wallet automatically.

`SupportService.createLostItemComplaint` verifies order ownership, requires the order to be
`DELIVERED`/`COMPLETED`, and blocks a second open lost-item ticket for the same order
(`support.service.ts:200-219`) — mirroring the refund module's duplicate-request guard.

`ReviewsService.createReview` verifies order ownership, requires `COMPLETED` status, and blocks a
second review for the same order (`reviews.service.ts:75-89`); it also marks the
`review_request` notification read and emits a `reviewPublished` tracking-socket event.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Refund form — eligibility banner | `payment.method`, `payment.cashTiming` (via `formatCashTimingLabel`) | cash/non-refundable-method check is a client-side pre-check (`isRefundablePaymentMethod`) duplicating the backend's own check in `createRequest` — correct defense-in-depth, backend is still authoritative |
| Refund form — order total | `order.total` | — |
| Refund form — reason textarea | local `reason` state, min 10 chars enforced client-side (backend has no matching length validator — see Findings) | |
| Lost-item form — missing items / details | local `missingItems`/`description` state, min 10 chars enforced client-side (backend `CreateLostItemDto.description` does enforce `@MinLength(10)`, matching) | comma-split client-side, sent as `string[]` |
| Review form — star rating + comment | local `rating`/`comment` state; `comment` capped at 2000 chars client-side, matching `CreateReviewDto.@MaxLength(2000)` | rating `< 1` blocked client-side, matching backend `@Min(1)` |
| Review page — "not yet eligible" panel | `status.orderStatus` | — |
| Review page — published-review panel | `published.{rating,comment,publishedAt}` | `ReviewData.createdAt` type field is fetched-but-unused (see Unused/dead fields) |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Submit refund request | no (creates a request, doesn't move money itself) | n/a | yes — `submitting` disables the button, `refund/page.tsx:127` | yes — `setError` |
| Submit lost-item report | no | n/a | yes — `submitting` disables the button, `lost-item/page.tsx:93` | yes — `setError` |
| Submit review | no | n/a | yes — `submitting` disables the button via `ReviewForm`'s `loading` prop, `review-form.tsx:64` | yes — `try/catch` in `ReviewForm.handleSubmit` surfaces `err.message` |

All three are single-fire forms with in-flight `disabled` guards and visible error text; none are
destructive from the customer's side (all just create a request/report/review for staff or an
automated process to act on).

## Authorization
No `[authz]` issues in the *new* code traced this pass — all three create endpoints independently
re-verify `order.customerId === req.user.sub` server-side before doing anything
(`refunds.service.ts:78-81`, `support.service.ts:203-205`, `reviews.service.ts:78-80`), so a
customer cannot submit a refund/lost-item/review against another customer's order by editing the
`id` route param or POST body. `RefundsController`/`SupportController`/`ReviewsController` are all
`@Roles(UserRole.CUSTOMER)`-gated.

One `[sensitive-data]` finding (not `[authz]` — no cross-customer access, just an over-broad
response shape) is recorded below.

## Findings
1. **[sensitive-data] Refund creation response used the raw (admin-inclusive) serializer, missed
   by the earlier `refunds.md` audit's fix.** `RefundsService.createRequest`
   (`apps/api/src/modules/refunds/refunds.service.ts:138`, pre-fix) returned
   `this.serializeRefund(refund)` — the same unfiltered serializer whose `adminNote` field
   `refunds.md`'s Finding #1 (2026-07-23) already found leaking on the customer-facing *list/detail*
   endpoints and fixed by introducing `serializeRefundForCustomer`. That fix touched
   `listCustomerRefunds`/`getCustomerRefund` but not `createRequest`, so the `POST /refunds`
   response itself still returned the admin-only `adminNote` field straight to the customer that
   submitted the request. In practice `adminNote` is empty at creation time (nothing has reviewed
   the refund yet), but `tryAutoApprove` (`refunds.service.ts:143-183`) runs as a fire-and-forget
   auto-approval state machine immediately after `createRequest` returns and does set `adminNote`
   as part of that flow — the same in-memory `refund` object is what gets serialized, so this
   wasn't purely theoretical exposure, just narrow in timing. The customer-web frontend never reads
   `adminNote` from this response (only `res.data._id`), so it was unused *and* sensitive.
   **Fix:** changed `apps/api/src/modules/refunds/refunds.service.ts:138` to
   `this.serializeRefundForCustomer(refund)`, matching the pattern already used by
   `listCustomerRefunds`/`getCustomerRefund`. `reviewRefund`'s admin-facing call sites
   (`listAdminRefunds`/`getAdminRefund`, lines 253/285) are untouched and still return the full
   `adminNote` — verified by re-reading both call sites. `apps/api` `tsc --noEmit` passes clean.

2. **[sensitive-data] Lost-item report creation response used the raw ticket serializer instead of
   the customer-safe one.** `SupportService.createLostItemComplaint`
   (`apps/api/src/modules/support/support.service.ts`, pre-fix) returned
   `this.serializeTicket(ticket)` directly — the same unfiltered serializer used for admin
   endpoints (`getTicket`/`getTickets`/`updateTicket`), which includes `adminNote`, `riderId`,
   `photosReviewedAt`, and `logsReviewedAt`. Every other customer-facing support endpoint
   (`listCustomerTickets`, `getCustomerTicket`) correctly uses `serializeTicketForCustomer`, which
   strips those internal-only fields — this create endpoint was the one inconsistent path. At
   creation time these fields are all still unset, so the practical exposure window is narrow
   (equivalent to Finding 1's `tryAutoApprove` timing note, but here there's no matching
   fire-and-forget follow-up mutating the in-memory object before serialization), but the
   inconsistency was a real gap between this endpoint and every sibling customer-ticket endpoint.
   The customer-web frontend only reads `res.data._id` from this response, so the fields were
   unused as well as sensitive.
   **Fix:** changed the return statement to `this.serializeTicketForCustomer(ticket)`. Grepped
   other `createLostItemComplaint` callers — none found outside `SupportController.reportLostItem`,
   so no other consumer is affected. `createGeneralTicket`/`createAreaCoverageRequest`/
   `createRiderIssueTicket` in the same file have the identical raw-serializer pattern on their
   create-response paths, but those are the general-ticket/area-request/rider-issue flows, out of
   this module's scope (general ticket creation was already audited clean in `support.md`, and
   rider-issue creation is a rider-facing flow, not customer) — left unfixed here as a scope
   boundary, not a missed bug; worth a follow-up pass on `support.md`'s module if desired.

No other dead-field, type-mismatch, or double-submit issues found across the three submission
flows. `CreateRefundDto.reason` and `CreateLostItemDto.description` both correctly enforce
`@MinLength(10)` server-side (`apps/api/src/modules/refunds/dto/create-refund.dto.ts:8`,
`apps/api/src/modules/support/dto/create-lost-item.dto.ts:8`), matching the client-side checks —
no gap there.

## Unused/dead fields
- `ReviewData.createdAt` (`orders/[id]/review/page.tsx:19`) is typed on the frontend interface but
  `serializeReview` (`reviews.service.ts:196-205`) does return it — the field itself is fine
  (not sensitive, it's a review's own creation timestamp), it's simply never rendered; the page only
  displays `publishedAt`. Minor, not flagged as a Finding since it isn't sensitive.
- No other fetched-but-unused fields found in this pass's three data flows.

## Loading/error/realtime behavior
All three submission pages use local `useState` loading/error trios (`loadError`/`error`/
`submitting` on refund and lost-item; `loadError`/`submitting` plus `ReviewForm`'s own local error
on review) rather than the shared `useCustomerQuery` hook seen on the list/detail pages in
`refunds.md`/`support.md` — appropriate here since these are one-shot precheck-then-submit forms,
not list/detail views with a reload button. None of the three submission flows have realtime
updates (no socket); status only becomes visible after redirecting to the read-only detail page,
which itself has no live socket either (confirmed in `refunds.md` — refund status only updates on
manual refresh/navigation). Review submission is synchronous (the form's local state updates
immediately from the POST response, no polling needed since the action is instant).
