# Audit: Admin-web — Refunds

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/refunds/page.tsx` -> `RefundsBoard` (`apps/admin-web/src/components/datacenter/refunds-board.tsx`)

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `refunds/[id]/page.tsx` | "Review refund" link + "Download receipt" link, `refunds-board.tsx:789,793` | `selected._id` -> `id` route param | yes — `adminFetch<RefundReview>('/admin/refunds/${id}')` |

`[id]/page.tsx` (`AdminRefundReviewPage`) is a full review/action workflow — not a
thin detail view — with its own multi-step approve/reject/process/notify
mutation surface, so it gets full treatment below rather than a one-line note.
It correctly fetches only what the list didn't already have (order detail,
payment record, eligibility verification), not a redundant re-fetch of fields
the list row already carried.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Refund queue + counts | GET | `/admin/refunds` | `{ items: RefundRow[]; counts: RefundCounts }` | `AdminController.listRefunds` -> `RefundsService.listAdminRefunds` |
| Payment info for selected row (list's right rail) | GET | `/admin/refunds/:id` | `{ payment }` (subset of `RefundReview`) | Same handler as below, `getAdminRefund` |
| Refund review detail | GET | `/admin/refunds/:id` | `RefundReview` | `AdminController.getRefund` -> `RefundsService.getAdminRefund` |
| Review action (start review / verify order / approve / reject / process / notify) | POST | `/admin/refunds/:id/review` | — | `AdminController.reviewRefund` -> `RefundsService.reviewRefund` |

## Backend trace
`listAdminRefunds(status?)` accepts an optional single-status filter (unused by
the frontend — see Finding 2) and always caps the item list to the 100
most-recently-updated refunds (`refunds.service.ts:157`), while separately
computing `counts.{pending,underReview,approved,total,rejected,processed,refundedAmount}`
via uncapped `countDocuments`/aggregate queries — the counts are always accurate
platform-wide, the `items` list is not. `reviewRefund` is a well-built state
machine: `START_REVIEW`/`VERIFY_ORDER`/`APPROVE`/`REJECT`/`PROCESS`/`NOTIFY` each
validate their preconditions server-side (can't approve before verifying, can't
process before approving, approved amount is capped to what was actually paid
not just what was requested), and `PROCESS` uses an atomic
`findOneAndUpdate({status: APPROVED}, {status: PROCESSED})` claim with a
rollback on `executeRefund` failure — the same double-claim protection pattern
already seen in `PartnerOperationsService.createSettlement` and
`LaundryTagsService.assignToOrder`.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Queue state banner | Client-derived `deriveRefundState()` from `counts.pending`/`.underReview` (≥8 open = critical, >0 = attention) | Hardcoded thresholds, reasonable, consistent with similar banners elsewhere. |
| Stat tiles (6) | `counts.{total,refundedAmount,pending,underReview,processed}`, client `queueValue` (sum of open items' `requestedAmount` — see Finding 1 note) and `successRate` | Every tile here reads the accurate, uncapped `counts.*` fields — **not** the capped `items` list, so these were already correct before this pass. |
| Status tabs (6) | Tab badge counts | **Fixed** — previously re-derived from the capped `items` array; see Finding 1. |
| Refund ledger table | Every `RefundRow` field: `customerName`+`customerAvatarUrl` (via `Avatar`), `orderId`, `approvedAmount ?? requestedAmount`, `reason`, `status` (via `statusBadgeClass`+`formatRefundStatus`), `createdAt`, `processedAt` | `statusBadgeClass` (`refunds-board.tsx:86-92`) is a hardcoded status->badge map — same low-risk "must stay in sync" class noted elsewhere, small stable set. |
| Right rail — refund detail | `selected.{requestedAmount,approvedAmount,bookingType,orderStatus,createdAt,processedAt,reason,rejectionReason,adminNote,timeline[]}`, plus `paymentInfo.{method,receiptCode}` from the separate fetch | Full use; "View order"/"Review refund"/"Download receipt" links out. |
| `[id]` — Workflow panel | `REFUND_FLOW` (shared const from `@lunara/utils`) + `refund.stage` via `refundFlowIndex()` | Shared stage-list/index helper, not duplicated locally — good, avoids yet another hardcoded map. |
| `[id]` — Customer request panel | `refund.{requestedAmount,approvedAmount,rejectionReason,reason}` | Full use. |
| `[id]` — Verify order panel | `order.{_id,bookingType,total,status}`, `payment.{method,status,amount,receiptCode}`, `verification.{paymentPaid,paymentMatchesOrder,eligibleForRefund}` | Full use — the three verification checkmarks are all backend-computed, not re-derived client-side. |
| `[id]` — Approve/reject panel | `approvedAmount` (form input, pre-filled from `refund.approvedAmount ?? requestedAmount`), `rejectionReason` (form input) | No client-side bound on `approvedAmount` beyond what the number input allows — server enforces the real cap (`> maxRefundable` check), so a client-side attempt to over-approve just gets rejected with a clear error, not silently accepted. |
| `[id]` — Process & notify panel | `refund.status`/`.processedAt`/`.customerNotifiedAt` (gates which buttons are enabled) | See Mutations — Process now requires confirmation. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Start review | no | n/a | yes, `disabled={loading}` | yes |
| Mark order verified | no | n/a | yes, also disabled once already verified | yes |
| Approve | no (reversible in practice — nothing downstream depends on it until Process) | n/a | yes, `disabled={loading}` | yes |
| Reject | no (an admin can still re-approve afterward — backend doesn't lock out `APPROVE` after a `REJECT`) | n/a | yes, `disabled={loading}` | yes |
| Process refund (wallet) | **yes** — moves real money into the customer's wallet via `executeRefund`, no reversal action exists anywhere in the review-action switch or elsewhere in the API | no (pre-fix) | yes, `disabled={loading \|\| refund.status !== 'approved'}` | yes |
| Notify customer | no (sends a notification, not reversible, but not financial) | n/a | yes, also disabled once already notified | yes |

## Authorization
`AdminController` is class-level `@Roles(UserRole.ADMIN)` — matches the frontend
(admin-only pages). Note there's a *separate*, customer-facing
`RefundsController` (`@Controller('refunds')`, `@Roles(UserRole.CUSTOMER)`) for
customers to create/view their own refund requests — different controller,
different base path (`/refunds` vs `/admin/refunds`), no overlap or widening
risk between the two. No `[authz]` findings.

## Findings

1. **Status-tab badge counts disagreed with the stat tiles once refund volume exceeds 100.**
   `STATUS_TABS` (pre-fix, `refunds-board.tsx:334-341`) computed every tab's count
   by filtering the client-side `items` array — but `listAdminRefunds` caps
   `items` to the 100 most-recently-*updated* refunds
   (`refunds.service.ts:157`), while the "Total refunds"/"Needs review"/etc. **stat
   tiles** right above the tabs already read the accurate, uncapped
   `counts.{total,pending,underReview,approved,processed,rejected}` fields from
   the same response. Once total refund volume passed 100, the tab badges and
   the stat tiles directly above them would show two different numbers for the
   same thing on the same page — e.g. "Needs review: 12" (stat tile, accurate)
   next to a "Needs review 9" tab badge (client-derived, capped window).
   **Fix:** `STATUS_TABS` now reads `counts.total`/`counts.pending + counts.underReview`/
   `counts.approved`/`counts.processed`/`counts.rejected` directly
   (`refunds-board.tsx:334-341`) — the same accurate source the stat tiles
   already used. "Closed" has no corresponding server-count field, so it's still
   derived from the capped `items` window — flagged in Finding 2, not silently
   left inconsistent without explanation.

2. **The 100-item cap has no real pagination or server-side status filtering behind it.**
   `listAdminRefunds` hard-caps `items` to the 100 most-recently-updated refunds
   with no `page`/`limit` params, and while it does accept an optional `status`
   query param, the frontend never sends it — `RefundsBoard.load()` always calls
   plain `/admin/refunds` and does all status/date/reason/search filtering and
   pagination client-side over that same capped 100-row window
   (`refunds-board.tsx:211-217`). The UI's search box and "Showing X to Y of Z"
   pager look like full pagination but can only ever surface refunds within the
   100 most-recently-updated — an admin searching for an older refund by order
   ID could get zero results with no indication that older records exist beyond
   what was fetched. This is the same class of gap already fixed for
   `laundry-tags-board.tsx` (full client-side fetch/filter instead of using
   server-side `status`/`limit`/`page` support), but here closing it properly
   would mean extending `listAdminRefunds` to accept a comma-separated status
   group (to express "needs review" = pending + under_review, mirroring
   `AdminService.getOrders`'s `status.split(',')` pattern) plus real `page`/`limit`
   params and a `closed` count — a larger, multi-part backend change rather than
   a one-line endpoint swap (there was no existing ready-made lightweight
   endpoint to reuse, unlike the branches/parents case). Left unfixed as
   disproportionate to this pass; noted here for whoever revisits this board
   under real refund volume.

3. **"Process refund (wallet)" had no confirmation despite moving real, unreversed money.**
   `review('process')` (`refunds/[id]/page.tsx`, pre-fix) fired directly from the
   button's `onClick` with no guard, even though `executeRefund` credits the
   customer's wallet and posts ledger entries with no reversal action anywhere
   in the `reviewRefund` switch or the rest of the API. This is the same class
   of finding as the un-confirmed service-area delete and partner-brand
   deactivation found earlier in this audit series.
   **Fix:** added a `window.confirm` stating the exact amount and that it can't
   be undone from the page, before calling `review('process')`
   (`refunds/[id]/page.tsx`).

4. **Payment-info rail fetch reimplemented loading/error state instead of using the shared hook.**
   The list board's right-rail payment lookup (`refunds-board.tsx`, pre-fix) used
   a raw `useEffect` + two `useState`s + manual `.then/.catch/.finally` with a
   `cancelled` flag, instead of `useAdminQuery` — the fourth occurrence of this
   exact pattern found this session (after `partner-branding.md`'s detail page
   and `partner-settlements.md`'s `CreateSettlementModal`).
   **Fix:** converted to `useAdminQuery(loadPaymentInfo, [selected?._id])`, where
   the loader itself returns `null` immediately when nothing is selected instead
   of skipping the fetch imperatively (`refunds-board.tsx:292-299`) — same
   approach used to fix the settlements modal. Regression-checked: local to this
   component, no other consumer of the removed manual pattern.

## Unused/dead fields
None on the list board. On `[id]`, `refund.orderVerifiedAt` and
`refund.customerNotifiedAt` are read only to gate button `disabled` states, not
displayed as timestamps directly — a minor missed-display opportunity (e.g.
"Order verified 2h ago"), not a bug.

## Loading/error/realtime behavior
List board: `useAdminQuery` for the main queue, plus a 120-second
visibility-gated `setInterval` (`refunds-board.tsx:219-224`) that only refetches
when `document.visibilityState === 'visible'` — a reasonable, non-thrashing
polling pattern given refund requests are a live-ish queue admins should notice
new arrivals in, but not a full socket subscription. Review sub-page: standard
`useAdminQuery` behavior, plus a `print=1` query param that auto-triggers
`window.print()` after data loads (`refunds/[id]/page.tsx:68-73`) — a
print-friendly receipt view, not a bug.
