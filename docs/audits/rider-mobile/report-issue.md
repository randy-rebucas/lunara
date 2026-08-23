# Audit: Rider-mobile - Report issue

Date: 2026-08-23

## Entry point
- Screens: `apps/rider-mobile/app/report-issue.tsx`, `apps/rider-mobile/app/my-reports.tsx`
- Component(s): none beyond the screen files themselves (uses shared `Card`, `Button`, `Input`, `Screen`, `DataLoadState`)

Both screens are reached only from `apps/rider-mobile/app/support.tsx:229` ("Report an issue" -> `router.push('/report-issue')`) and `support.tsx:239` ("My reports" -> `router.push('/my-reports')`). Neither screen navigates to the other directly: `report-issue.tsx` success state (`report-issue.tsx:53-68`) only offers a "Done" button that calls `router.back()` (back to `support.tsx`), and `my-reports.tsx` has no link into `report-issue.tsx`.

## Sub-pages
None -- no outbound navigation between report-issue.tsx and my-reports.tsx, and no per-ticket detail route. `my-reports.tsx` rows are static (not pressable) even though a `GET /support/rider-issues/:id` endpoint exists (`support.controller.ts:71-75`, `SupportService.getRiderTicket`) -- it is currently unused by any rider-mobile screen.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Submit report | POST | `/support/rider-issues` | inline body `{ issueType, subject, description }` | `SupportController.reportRiderIssue` -> `SupportService.createRiderIssueTicket` |
| List reports | GET | `/support/rider-issues` | `RiderTicket[]` | `SupportController.listMyRiderIssues` -> `SupportService.listRiderTickets` |
| (unused) Get one report | GET | `/support/rider-issues/:id` | none | `SupportController.getMyRiderIssue` -> `SupportService.getRiderTicket` |

## Backend trace
`createRiderIssueTicket` (`support.service.ts:146-181`) optionally validates `dto.orderId` against the order's `pickupRiderId`/`deliveryRiderId` to confirm the order is actually assigned to the requesting rider, maps the UI 3-way `issueType` to the ticket's `TicketType` (`damaged_item`/`delivery_delay`/`other`->`general`), sets priority to `HIGH` for damaged items and `MEDIUM` otherwise, and creates a `SupportTicket` with `riderId` set to the caller. `listRiderTickets`/`getRiderTicket` (`support.service.ts:183-198`) filter strictly by `riderId: new Types.ObjectId(riderId)` taken from the JWT (`req.user.sub`), not from any client-supplied param -- no widening vector. `report-issue.tsx` never actually sends `orderId` (there is no order picker on the form), so that validation path is currently dead code for this screen, though the DTO/service still support it for future use.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Issue-type chip row (`report-issue.tsx:81-99`) | client-only `issueType` state | Hardcoded `ISSUE_TYPES` list (id/label/icon) at `report-issue.tsx:14-18`; must stay in sync with backend `RiderIssueType` enum (`create-rider-issue.dto.ts:3-7`) and `RIDER_ISSUE_TYPE_MAP` (`support.service.ts:140-144`) -- three variants match today. |
| Details form card (`report-issue.tsx:102-127`) | `subject`, `description` | Client-side validation mirrors backend `MinLength`/`MaxLength` (subject >=3, description >=10); frontend `maxLength={120}` matches backend `MaxLength(120)`. |
| Success panel (`report-issue.tsx:53-68`) | none (static copy) | No link to `my-reports.tsx` to view the just-submitted report -- see Findings. |
| My-reports list rows (`my-reports.tsx:85-113`) | `t._id`, `t.type` (icon + label), `t.subject`, `t.status` (pill) | `ticketIcon()` (my-reports.tsx:20-24) and `RESOLVED_STATUSES` (my-reports.tsx:10) are hardcoded and must stay in sync with backend `TicketType`/`TicketStatus` enums. `updatedAt` was declared in the frontend type but never rendered (dead field, now removed -- see Findings/Fix). |
| Empty state (`my-reports.tsx:77-83`) | `tickets.length` | Standard empty card, no issues. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Submit report (`report-issue.tsx:32-51`) | no | n/a | yes -- `submitting` disables the button and swaps its label (`report-issue.tsx:121-126`) | yes -- caught error rendered via `styles.error` (`report-issue.tsx:120`) |

No destructive/update/delete actions exist on either screen.

## Authorization
Both endpoints are guarded with `@Roles(UserRole.RIDER)` (`support.controller.ts:56-69`), matching what the rider-mobile UI expects. List/get queries filter by `riderId` taken from the authenticated JWT subject, not any client-supplied id, so a rider cannot widen the query to see another rider's tickets. The optional `orderId` on create is independently validated against `pickupRiderId`/`deliveryRiderId` before being trusted (`support.service.ts:147-157`), so a rider cannot attach a report to an order that is not theirs. No `[authz]` issues found.

## Findings

1. **Sensitive-data exposure: rider ticket list/detail returned the full internal ticket record, including staff-only `adminNote` and internal investigation timeline notes.** `listRiderTickets`/`getRiderTicket` (`support.service.ts:183-198`, before fix) called the generic `serializeTicket()`, which includes `adminNote`, `customerId`, `photosReviewedAt`, `logsReviewedAt`, and unredacted `timeline[].note` entries -- the same fields the codebase already treats as staff-only for the customer-facing ticket view (`serializeTicketForCustomer`, `support.service.ts:646-662`, whose doc comment explicitly says these are "internal-only"). Riders would receive any dispatcher-written internal note attached to their own ticket, even though nothing in the UI currently renders it (still worse than a merely-unused field, since it travels over the wire to a role that does not need it).
   **Fix:** added `serializeTicketForRider()` (`support.service.ts`, mirroring `serializeTicketForCustomer`) that strips `customerId`, `adminNote`, `photosReviewedAt`, `logsReviewedAt`, and staff-authored timeline notes (keeping only the rider's own `submitted` stage note). Wired it into `listRiderTickets` and `getRiderTicket` in place of `serializeTicket`. Typechecked `apps/api` -- no errors in the support module. Regression check: `serializeTicket` and the customer-facing `serializeTicketForCustomer` path (used by `listCustomerTickets`/`getCustomerTicket`) are untouched, so customer-web/admin flows are unaffected; only the two rider endpoints changed.

2. **Frontend `RiderTicket` type under-declared the response shape**, listing only `_id`, `subject`, `status`, `type`, `updatedAt` while the backend actually returned (pre-fix) the full ticket object including `description`, `priority`, `orderId`, `missingItems`, `investigationStage`, `outcome`, `timeline`, `createdAt`, plus the sensitive fields in Finding 1. This masked the over-fetch in Finding 1 from a type-level review.
   **Fix:** updated `RiderTicket` in `my-reports.tsx` to declare the fields the (now-trimmed) rider serializer actually returns and the list plausibly needs (`description`, `priority`, `orderId`, `createdAt`, `updatedAt`), dropping the old `updatedAt`-only shape. Fields like `timeline`, `missingItems`, `investigationStage`, `outcome` are omitted from the type since `my-reports.tsx` does not render them (see Unused/dead fields).

3. **No navigation link from the submit success screen to `my-reports.tsx`.** After a rider submits a report (`report-issue.tsx:53-68`), the only action is "Done" -> `router.back()`, returning to `support.tsx`. A rider who wants to confirm their report shows up must manually navigate to "My reports" again from the support screen.
   **Fix: left unfixed -- product/UX decision.** Adding a second action ("View my reports") is a reasonable improvement but changes the confirmation screen's UX, out of scope for a data-flow fix; flagging for product input rather than guessing at copy/placement.

4. **`GET /support/rider-issues/:id` is implemented on the backend but never called by rider-mobile** -- `my-reports.tsx` rows are non-interactive (no `Pressable`/`onPress`, `my-reports.tsx:89-109`), so there is no detail view despite the endpoint supporting one.
   **Fix: left unfixed -- out of scope/product decision.** Building a detail sub-page is a UI feature addition, not a data-flow bug; noting it since the backend already supports it cheaply if product wants it.

## Unused/dead fields
Before the fix, `adminNote`, `customerId`, `photosReviewedAt`, `logsReviewedAt` were both unused by the frontend and sensitive -- now removed from the rider-facing response (Finding 1). Still returned by the rider serializer but not currently rendered by `my-reports.tsx`: `description`, `priority`, `orderId`, `missingItems`, `investigationStage`, `outcome`, `outcomeNotes`, `compensationAmount`, `compensationCreditedAt`, `timeline`, `createdAt`. These are harmless (rider's own ticket data) and plausible future detail-view fields (see Finding 4), so left as-is rather than trimmed further.

## Loading/error/realtime behavior
`my-reports.tsx` uses local `loading`/`refreshing`/`error` state plus the shared `DataLoadState` component (`my-reports.tsx:66-74`) for the initial loading/error UI, and `RefreshControl` for pull-to-refresh (`my-reports.tsx:58-63`). A failed `load()` sets `error` but leaves `tickets` at its last-known value (`my-reports.tsx:38-42`) -- since the render only shows the list when `!loading && !error` (`my-reports.tsx:76`), a failed refresh does not show stale data next to an error message, it correctly falls through to the `DataLoadState` error/retry UI instead. This matches the pattern used in `support.md` and `tasks.md` for this app (shared `DataLoadState` component; nothing in `DataLoadState` itself was changed, so no other consumers affected). No polling or socket subscriptions on either screen; refresh is purely pull-to-refresh or manual retry.
