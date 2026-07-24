# Audit: Admin-web — Support

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/support/page.tsx`
- Component(s): `apps/admin-web/src/components/datacenter/support-board.tsx`

## Sub-pages

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `support/[id]/page.tsx` | ticket detail rail "Open full ticket" link, `support-board.tsx:554` | `selected._id` -> `id` route param | yes |

`support/[id]/page.tsx` (the investigation/manage page) re-fetches the full ticket via
`GET /admin/tickets/:id` even though the parent list already has `subject`,
`status`, `priority`, `customerEmail`, `orderId`, `description` for the selected
row. This is a minor redundant round-trip (not a bug — the detail page needs a
fresh/authoritative copy before allowing mutations, and for lost-item tickets it
follows up with a second call to `/admin/tickets/:id/investigation` for
flow/order/photos/logs data the list never had). Loading/error state uses its own
`useAdminQuery` call (`DataPageStatus`), independent of the parent board — no
realtime/socket subscription on this sub-page.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List tickets | GET | `/admin/tickets?status=&type=` | `{ items: Ticket[]; counts: TicketCounts }` | `AdminController.getTickets` -> `SupportService.getTickets` |
| Get ticket | GET | `/admin/tickets/:id` | `InvestigationData['ticket']` | `AdminController.getTicket` -> `SupportService.getTicket` |
| Get investigation | GET | `/admin/tickets/:id/investigation` | `InvestigationData` | `AdminController.getInvestigation` -> `SupportService.getInvestigation` |
| Advance investigation | POST | `/admin/tickets/:id/investigate` | n/a (refetches investigation) | `AdminController.investigate` -> `SupportService.advanceInvestigation` |
| Update ticket | PATCH | `/admin/tickets/:id` | n/a (refetches) | `AdminController.updateTicket` -> `SupportService.updateTicket` |

## Backend trace
`SupportService.getTickets` runs `ensureSeeded()` (counts docs, seeds two demo
tickets if empty — a repo-wide pattern shared by `admin.service.ts`,
`catalog.service.ts`, `promotions.service.ts`, `service-areas.service.ts`,
`branches.service.ts`; not specific to this module, left as-is) then issues the
filtered `find` plus five parallel `countDocuments` calls for the status/type
tallies and total. `getInvestigation` loads the ticket, then the linked order (if
any) and derives `photos` (pickup/delivery/processing-step photo URLs) and
`laundryLogs` (processing steps + status history) from the order document — no
extra queries beyond the one order lookup. `advanceInvestigation` mutates the
ticket's status/stage/timeline per action; the `compensate` action calls
`WalletsService.credit` and `LedgerService.post` to move real money, guarded
against double-crediting by `ticket.compensationCreditedAt`.

## Cards / panels
List page (`support-board.tsx`), render order:

| Card | Fields consumed | Notes |
|---|---|---|
| State banner | `counts.open`, `counts.inProgress`, `highPriorityOpen` (client-derived from `items`) | `deriveSupportState` thresholds (`open >= 10`, `highPriorityOpen >= 3`) are hardcoded, not server-configurable |
| High-priority / lost-item pills | `highPriorityOpen`, `counts.lostItem` | lost-item pill toggles `typeFilter` client-side |
| Stat tiles (5) | `counts.total/open/inProgress/resolved/closed`, `counts.lostItem` | each tile doubles as a status/type filter button |
| Status tabs | `STATUS_TABS` built from `counts` | tab click resets `selectedId` |
| Ticket table | `subject`, `customerEmail`, `type`, `priority`, `status`, `updatedAt` | row tint derived client-side from `priority`/`status`/`type` (urgent = red, lost-item-open = amber) |
| Detail rail | `subject`, `status`, `priority`, `type`, `description`, `customerEmail`, `orderId`, `createdAt`, `updatedAt` | links to `/orders/:orderId` and `/support/:id` |

Detail sub-page (`support/[id]/page.tsx`), render order:

| Card | Fields consumed | Notes |
|---|---|---|
| Ticket details | `description`, `missingItems` | |
| Investigation flow (lost-item only) | `investigationStage` -> `lostItemFlowIndex`, `flow` (server-provided `LOST_ITEM_FLOW`) | step done/active state derived client-side from index |
| Linked order (lost-item only) | `order.bookingType/total/status/shelfSlot/pickupReceipt/deliveryReceipt` | |
| Review photos | `photos[]` (`source/label/url/at`) | |
| Review laundry logs | `laundryLogs[]` (`kind/label/at/note/photoUrl`) | |
| Outcome & compensation | `outcome`, `compensationAmount`, `compensationCreditedAt` | outcome `<select>` options (`found/compensated/no_action/denied`) hardcoded, matches `TicketOutcome` enum |
| Investigation actions | `investigationStage`, `status` | |
| Manage ticket (general tickets) | `status`, `priority`, `adminNote` | status/priority `<select>` options hardcoded, matches `TicketStatus`/`TicketPriority` enums |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Mark photos reviewed | no | n/a | yes (`disabled={loading}`) | yes (`error` state) |
| Mark logs reviewed | no | n/a | yes (`disabled={loading}`) | yes |
| Start investigation | no | n/a | yes | yes |
| Save outcome | no | n/a | yes | yes |
| Credit wallet (compensate) | yes — moves real money, irreversible once credited | **no (before fix)** | yes, plus backend rejects a second credit once `compensationCreditedAt` is set | yes |
| Close ticket | soft (status change, reopenable via general-ticket status select) | no | yes | yes |
| Save changes (general ticket status/priority/note) | no | n/a | yes | yes |

## Authorization
All `/admin/tickets*` routes sit under `AdminController` (`apps/api/src/modules/admin/admin.controller.ts:69-71`), guarded by `JwtAuthGuard` + `RolesGuard` with class-level `@Roles(UserRole.ADMIN)` and no route-level override — every ticket read/write requires the ADMIN role, matching what the frontend shows (only admin-web calls these paths). The customer-facing ticket routes live separately on `SupportController` (`/support/tickets*`), scoped to `UserRole.CUSTOMER` and filtered by `req.user.sub` — `getCustomerTicket` checks `ticket.customerId` ownership before returning data, so a customer can't widen access to another customer's ticket via the `:id` param. No role-scope widening found on either side.

## Findings

1. **Wallet-crediting mutation had no confirmation prompt.** `support/[id]/page.tsx`, "Credit wallet" button called `investigate('compensate', ...)` directly on click — a misclick would credit a customer's wallet with real money (backed by a ledger entry) with no way to cancel, only a `compensationCreditedAt` guard preventing a *second* credit, not the first one.
   **Fix:** added a `window.confirm` prompt showing the peso amount before calling `investigate('compensate', ...)`, `apps/admin-web/src/app/support/[id]/page.tsx:372-382`. Matches the confirm pattern already used for other destructive actions elsewhere in admin-web (e.g. refunds).

2. Hardcoded support-state thresholds (`open >= 10`, `highPriorityOpen >= 3` in `deriveSupportState`, `support-board.tsx:36`) aren't configurable — out of scope, a product/ops decision, not a bug.

No other issues found in data flow, authorization, or loading/error handling.

## Unused/dead fields
None — every field `serializeTicket` returns is either rendered on the list, the
detail rail, or the investigation sub-page (or, for `customerId`, not sent to
`/admin/tickets` responses' consumers beyond linking role checks server-side; it
is returned but not read by either admin-web view — low sensitivity, an ADMIN-
only internal id, not flagged as a real exposure).

## Loading/error/realtime behavior
Both the list board and the detail sub-page use the shared `useAdminQuery` hook:
initial load shows a spinner, a failed fetch surfaces `error` via `alert-error`
without wiping previously-loaded `data`, and empty results show a dedicated
empty state (`dc-panel-empty` on the list; n/a on the detail page since it 404s
via `NotFoundException` before rendering). The list board additionally polls
every 120s while the tab is visible (`support-board.tsx:181-186`) and refetches
on `statusTab`/`typeFilter` change; the detail sub-page has no polling, only an
explicit `reload()` after each mutation.
