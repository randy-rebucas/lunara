# Audit: Rider-mobile — Help & Support

Date: 2026-09-02 (supersedes the 2026-07-24 support.md pass and folds in the 2026-08-23 report-issue.md pass — `report-issue.tsx`/`my-reports.tsx` are traced here as full sub-pages of Support per this pass's scope, rather than as a separate doc; `report-issue.md` is left in place as history but this file is now the authoritative Support audit)

## Entry point
- Page: `apps/rider-mobile/app/support.tsx`
- Component(s): inline `FaqCard`, `ContactCard` — no sub-components in other files.

Reached from `(tabs)/profile.tsx`'s "Help & support" row (see [profile.md](profile.md) Sub-pages table).

## Sub-pages

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `report-issue.tsx` | "Report an issue" card, `support.tsx:229` (`router.push('/report-issue')`) | none — a plain create form, no id handoff | n/a, no param expected |
| `my-reports.tsx` | "My reports" card, `support.tsx:239` (`router.push('/my-reports')`) | none — lists all of the caller's own tickets, scoped server-side by JWT | n/a, no param expected |

Neither screen navigates to the other directly: `report-issue.tsx`'s success state only offers a "Done" button that calls `router.back()` (back to `support.tsx`, not to `my-reports.tsx` — see Findings #4), and `my-reports.tsx` has no link into `report-issue.tsx`. Both are thin enough (one create form, one flat list) to fully trace inline below rather than split into their own doc.

### `report-issue.tsx`
The rider-facing create flow for a support ticket. Fetches nothing on load; submits `{ issueType, subject, description }` via `POST /support/rider-issues`. See Data flow / Mutations below — its own loading/error/realtime behavior is just the submit-in-flight state covered in Mutations, no separate fetch lifecycle to trace.

### `my-reports.tsx`
Lists the rider's own tickets via `GET /support/rider-issues`, independent `loading`/`refreshing`/`error` state (own `useState`, not shared with `report-issue.tsx` or the parent Support screen), pull-to-refresh only, no socket subscription. See Loading/error/realtime behavior below.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Submit report (`report-issue.tsx`) | POST | `/support/rider-issues` | inline body `{ issueType, subject, description }` | `SupportController.reportRiderIssue` → `SupportService.createRiderIssueTicket` |
| List reports (`my-reports.tsx`) | GET | `/support/rider-issues` | `RiderTicket[]` | `SupportController.listMyRiderIssues` → `SupportService.listRiderTickets` |
| (unused) Get one report | GET | `/support/rider-issues/:id` | none | `SupportController.getMyRiderIssue` → `SupportService.getRiderTicket` — implemented but never called by any rider-mobile screen, see Findings #5 |

`support.tsx` itself makes no network calls — its only "data" is a hardcoded FAQ array (`support.tsx:9-30`) and `appConfig.supportEmail`/`appConfig.supportPhone` (`@lunara/config`) for the two `Linking.openURL` contact actions.

## Backend trace
`createRiderIssueTicket` (`support.service.ts:146-181`) optionally validates `dto.orderId` against the order's `pickupRiderId`/`deliveryRiderId` to confirm the order is actually assigned to the requesting rider, maps the UI 3-way `issueType` to the ticket's `TicketType` (`damaged_item`/`delivery_delay`/`other`→`general`), sets priority to `HIGH` for damaged items and `MEDIUM` otherwise, and creates a `SupportTicket` with `riderId` set to the caller. `listRiderTickets`/`getRiderTicket` (`support.service.ts:183-198`) filter strictly by `riderId: new Types.ObjectId(riderId)` taken from the JWT (`req.user.sub`), not from any client-supplied param — no widening vector. `report-issue.tsx` never actually sends `orderId` (there is no order picker on the form), so that validation path is currently dead code for this screen, though the DTO/service still support it for a future order-linked report.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| FAQ cards (×4, `support.tsx`) | hardcoded `q`/`a`/`icon` | static copy, no data dependency |
| Email support (`support.tsx`) | `appConfig.supportEmail` | correctly centralized in `@lunara/config` |
| Dispatch hotline (`support.tsx`) | `appConfig.supportPhone` | previously hardcoded inline in this file, already centralized in an earlier pass — see prior fix note below |
| Emergency SOS (`support.tsx`) | static informational card, `disabled` (no `onPress`) | correctly signals via `hint`/`actionLabel` that the real SOS action lives on task screens (`SosButton`, covered in [home.md](home.md)) rather than duplicating that control here |
| Issue-type chip row (`report-issue.tsx:14-18,81-99`) | client-only `issueType` state | hardcoded `ISSUE_TYPES` list (id/label/icon); must stay in sync with backend `RiderIssueType` enum (`create-rider-issue.dto.ts:3-7`) and `RIDER_ISSUE_TYPE_MAP` (`support.service.ts:140-144`) — three variants match today |
| Details form card (`report-issue.tsx:102-127`) | `subject`, `description` | client-side validation mirrors backend `MinLength`/`MaxLength` (subject ≥3, description ≥10); frontend `maxLength={120}` matches backend `MaxLength(120)` |
| Success panel (`report-issue.tsx:53-68`) | none (static copy) | no link to `my-reports.tsx` — see Findings #4 |
| My-reports list rows (`my-reports.tsx:90-116`) | `t._id`, `t.type` (icon + label), `t.subject`, `t.status` (pill) | `ticketIcon()` and `RESOLVED_STATUSES` (`my-reports.tsx:10,24-28`) are hardcoded and must stay in sync with backend `TicketType`/`TicketStatus` enums |
| Empty state (`my-reports.tsx:81-87`) | `tickets.length` | standard empty card, no issues |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Submit report (`report-issue.tsx:32-51`) | no | n/a | yes — `submitting` disables the button and swaps its label (`report-issue.tsx:121-126`) | yes — caught error rendered via `styles.error` (`report-issue.tsx:120`) |
| Email support / call dispatch (`support.tsx:197-203`) | no (opens OS mail/phone app, no backend write) | n/a | n/a | no — `Linking.openURL(...)` promise is fired with `void` and not caught; if no mail/phone app is available the promise rejects silently and the rider sees nothing happen. See Findings #6. |

No destructive/update/delete actions exist on any of the three screens.

## Authorization
Both `/support/rider-issues` endpoints are guarded with `@Roles(UserRole.RIDER)` (`support.controller.ts:56-69`), matching what rider-mobile expects. List/get queries filter by `riderId` taken from the authenticated JWT subject, not any client-supplied id, so a rider cannot widen the query to see another rider's tickets. The optional `orderId` on create is independently validated against `pickupRiderId`/`deliveryRiderId` before being trusted (`support.service.ts:147-157`), so a rider cannot attach a report to an order that is not theirs. No `[authz]` issues found.

## Findings

1. **Sensitive-data exposure: rider ticket responses leaked a customer's email field name (though not populated for rider-created tickets today) — `[fixed]`.** `serializeTicketForRider` (`support.service.ts`) already stripped `customerId`, `adminNote`, `photosReviewedAt`, `logsReviewedAt` from an earlier fix pass (matching the customer-facing serializer's internal-only exclusions), but did not strip `customerEmail` — a field that exists on the shared `SupportTicket` schema and is populated for customer-initiated tickets (lost-item reports, general tickets). Rider-created tickets (`createRiderIssueTicket`) never set `customerEmail`, so today this returns `undefined` for every rider ticket — not a live leak — but it's a latent one: any future code path that sets `customerEmail` on a ticket a rider later reads back (e.g. a merged/escalated ticket) would leak a customer's email to a rider with no legitimate need for it, silently, since nothing in the type or serializer flags it as rider-visible-by-mistake.
   **Fix:** added `customerEmail` to the destructured/excluded fields in `serializeTicketForRider` (`apps/api/src/modules/support/support.service.ts:672-687`), matching how `customerId` is already excluded there. Typechecked `apps/api` — no errors. Regression check: `serializeTicket` (the full internal shape) and `serializeTicketForCustomer` (used by `listCustomerTickets`/`getCustomerTicket`) are untouched — customer-web/admin flows still receive `customerEmail` where appropriate; only the two rider endpoints are affected.

2. **Two independent hardcoded classification lists must stay in sync across three places** (`ISSUE_TYPES` in `report-issue.tsx`, `RiderIssueType` enum in `create-rider-issue.dto.ts`, `RIDER_ISSUE_TYPE_MAP` in `support.service.ts`) — currently all three agree (3 variants), but nothing enforces it. Same category of finding as the notification-category and document-type duplication already flagged in [notifications.md](notifications.md) and [documents.md](documents.md).
   **Fix: left unfixed — cross-cutting, out of scope for this module alone.** A shared-enum refactor (e.g. exporting `RiderIssueType` from `@lunara/types` and importing it in the frontend instead of a hand-typed `IssueType` union) would fix this and the two other flagged instances at once, but touches package boundaries and build output (`@lunara/config`/`@lunara/types` are consumed as built packages — the same constraint Findings #5's dispatch-phone fix had to work around) — a dedicated pass, not a single-module fix.

3. **No navigation link from the submit success screen to `my-reports.tsx`.** After a rider submits a report (`report-issue.tsx:53-68`), the only action is "Done" → `router.back()`, returning to `support.tsx`. A rider who wants to confirm their report shows up must manually navigate to "My reports" again from the support screen.
   **Fix: left unfixed — product/UX decision.** Adding a second action ("View my reports") is a reasonable improvement but changes the confirmation screen's UX/copy, out of scope for a data-flow fix; flagging for product input rather than guessing at placement.

4. **`GET /support/rider-issues/:id` is implemented on the backend but never called by rider-mobile.** `my-reports.tsx` rows are non-interactive (no `Pressable`/`onPress`, `my-reports.tsx:93-113`), so there is no detail view despite the endpoint supporting one — a rider can't see `outcome`/`compensationAmount`/`investigationStage` for a resolved damaged-item report, even though the backend already computes and returns them (see Unused/dead fields).
   **Fix: left unfixed — out of scope/product decision.** Building a per-ticket detail sub-page is a UI feature addition, not a data-flow bug; noting it since the backend already supports it cheaply if product wants it.

5. **Dispatch phone number was hardcoded in the component instead of centralized config — `[fixed, prior pass]`.** `support.tsx` previously called `Linking.openURL('tel:+63281234567')` directly, asymmetric with the "Email support" card's use of `appConfig.supportEmail`. Already fixed in an earlier audit pass: `appConfig.supportPhone` was added to `packages/config/src/index.ts` and `support.tsx` now uses `appConfig.supportPhone` (`support.tsx:201-202`). Re-verified still in place this pass, no regression.

6. **`Linking.openURL` failures for Email support / Call dispatch are silent.** `contactSupport()`/`callDispatch()` (`support.tsx:197-203`) call `void Linking.openURL(...)` with no `.catch()` — if the device has no mail or phone app configured, the promise rejects and the rider sees nothing happen (no error, no feedback), for what looks like a simple button tap.
   **Fix: left unfixed — shared pattern across the app, not Support-specific.** The same unguarded `void Linking.openURL(...)` pattern is used in `app/login.tsx:109` and `src/lib/task-contact.ts:21,30,55` (customer/dispatch call buttons on task screens). Fixing it only in `support.tsx` would leave the identical gap in three other call sites and create an inconsistent error-handling pattern across the app; this is a candidate for a small shared helper (e.g. `safeOpenUrl(url, fallbackMessage)` with a single `Alert.alert` on rejection) applied everywhere at once, not a single-file fix.

## Unused/dead fields
- Before an earlier fix pass, `adminNote`, `customerId`, `photosReviewedAt`, `logsReviewedAt` were both unused by the frontend and sensitive on rider ticket responses — now excluded (Findings #1's prior pass); `customerEmail` is now also excluded as of this pass (Findings #1).
- Still returned by `serializeTicketForRider` but not currently rendered by `my-reports.tsx`: `description`, `priority`, `orderId`, `missingItems`, `investigationStage`, `outcome`, `outcomeNotes`, `compensationAmount`, `compensationCreditedAt`, `timeline`, `createdAt`. These are harmless (the rider's own ticket data, not sensitive to them) and are plausible future detail-view fields (Findings #4) — left as-is rather than trimmed further, since the frontend `RiderTicket` type already only declares the fields it actually reads plus a few reasonable additions (`description`, `priority`, `orderId`, `createdAt`, `updatedAt`) from an earlier fix pass, so the over-fetch is now type-visible rather than hidden.
- `notification.data.branchName`/`earningType` are unrelated to Support — see [notifications.md](notifications.md) Unused/dead fields instead.

## Loading/error/realtime behavior
`support.tsx` has no fetch, so no loading/error states apply. `report-issue.tsx` has only the submit-in-flight `submitting` boolean (Mutations table above), no read fetch. `my-reports.tsx` uses local `loading`/`refreshing`/`error` state plus the shared `DataLoadState` component for the initial loading/error UI, and `RefreshControl` for pull-to-refresh. A failed `load()` sets `error` but leaves `tickets` at its last-known value (`my-reports.tsx:38-46`) — since the render only shows the list when `!loading && !error` (`my-reports.tsx:80`), a failed refresh correctly falls through to the `DataLoadState` error/retry UI instead of showing stale data silently alongside an error. This is the same pattern `notifications.tsx`'s `useNotifications` hook was just brought into line with (see [notifications.md](notifications.md) Findings #2) — `my-reports.tsx` already had it right, no change needed here. No polling or socket subscriptions on any of the three screens; refresh is purely pull-to-refresh or manual retry.
