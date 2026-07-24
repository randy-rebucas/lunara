# Audit: Customer-web — Support (tickets list + detail)

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/support/page.tsx` (`'use client'`) — ticket list + creation
- Component(s): `PageShell`, `PageHeader`, `DataPageStatus`, `SupportCreateSection` (`components/support-create-section.tsx`, three-mode create form), `Card`/`CardBody`

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `support/[id]/page.tsx` | ticket row link | `t._id` -> `id` route param | yes |

`support/[id]/page.tsx` is a read-only ticket detail/timeline view (lost-item investigation stages, compensation outcome, free-form updates timeline) — no mutations, small enough to fully cover here rather than as a separate doc.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List tickets | GET | `/support/tickets` | `Ticket[]` | `SupportController.listMyTickets` -> `SupportService.listCustomerTickets` |
| Create general ticket | POST | `/support/tickets` | `{ _id }` | `SupportController.createTicket` -> `SupportService.createGeneralTicket` |
| Create area-coverage request | POST | `/support/area-requests` | — | `SupportController.requestAreaCoverage` -> `SupportService.createAreaCoverageRequest` |
| Orders (for general/lost-item mode selectors) | GET | `/orders?page=1&limit=30` | `{ items: OrderOption[] }` | `OrdersController.findAll` (already traced in `docs/audits/customer-web/dashboard.md`) |
| Addresses (for area-request mode) | GET | `/addresses` | `AddressOption[]` | `AddressesController.findAll` (already traced in `docs/audits/customer-web/profile.md`) |
| Ticket detail | GET | `/support/tickets/:id` | `{ ticket, investigation }` | `SupportController.getMyTicket` -> `SupportService.getCustomerTicket` |

Lost-item reports themselves are created via `/orders/:id/lost-item` (already fully traced in `docs/audits/customer-web/orders.md`) — this page's "Missing item" mode is a router into that flow (links to `/orders/:id/lost-item` per eligible order) rather than submitting directly.

## Backend trace
Every mutating/reading endpoint on `SupportController` is `@Roles(UserRole.CUSTOMER)`-gated and scopes its query/mutation to `req.user.sub` server-side: `createGeneralTicket` verifies a referenced `orderId` actually belongs to the caller before attaching it (`ForbiddenException` otherwise); `createAreaCoverageRequest` resolves the address via the already-ownership-scoped `addressesService.findAll(customerId)` (so a non-owned address id 404s) and — good defensive-UX detail — returns the *existing* open/in-progress area-coverage ticket instead of creating a duplicate if the customer already has one pending; `listCustomerTickets`/`getCustomerTicket` both filter/verify by `customerId`, with `getCustomerTicket` throwing `ForbiddenException` on an id that isn't the caller's.

## Cards / panels

**List page:**
| Card | Fields consumed | Notes |
|---|---|---|
| Create-ticket section (3 modes) | General: `subject`, `description`, optional `relatedOrderId` (from `/orders`); Lost item: eligible orders (`DELIVERED`/`COMPLETED` only) routed to the per-order lost-item flow; Area: `selectedAddressId` (from `/addresses`), optional `areaMessage` | mode-specific data (`orders`/`addresses`) is lazily fetched only when that mode is first selected, not all three up front — efficient |
| Ticket row | `subject`, `type` (via `formatTicketType`), `status` (via `formatTicketStatus`/`ticketStatusBadgeClass`), `updatedAt`/`createdAt` (via `formatTicketDate`) | |
| Refresh button | none — triggers `reload()` | |
| Empty state | none | |

**Detail page:**
| Card | Fields consumed | Notes |
|---|---|---|
| Header | `subject`, `status` | |
| Lost-item investigation stepper (only for `type === 'lost_item'`) | `LOST_ITEM_FLOW` (static step list) + `currentStage`/`ticket.status` to derive done/active per step | |
| Outcome banner | `outcome` (via `formatLostItemOutcome`), `compensationAmount`/`compensationCreditedAt` | |
| Report panel | `description`, `missingItems` | |
| Updates timeline | `timeline[]` (`stage`/`label`/`at`/`note`) | |
| Footer actions | static links to `/support` and (if `orderId` present) `/orders/:orderId` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Submit general ticket | no | n/a | yes (`disabled={generalSubmitting \|\| subject.trim().length < 3 \|\| description.trim().length < 10}`) | yes (`generalError`) |
| Submit area-coverage request | no | n/a | yes (`disabled={areaSubmitting \|\| !selectedAddressId}`) | yes (`areaError`); success also surfaced (`areaSuccess`), including the "already requested" case which still returns `success: true` with a friendly message rather than an error |
| Refresh ticket list | no | n/a | yes (`disabled={loading \|\| refreshing}`) | yes (`error`) |

Ticket detail page has no mutations — pure read/timeline view.

## Authorization
Every endpoint this module touches independently verifies ownership server-side (ticket ownership, referenced-order ownership, referenced-address ownership) rather than trusting the client — confirmed via direct reads of `createGeneralTicket`, `createAreaCoverageRequest`, `listCustomerTickets`, and `getCustomerTicket`. No `[authz]` issues.

## Findings
No issues found. Both pages consistently guard their mutations, the create form only fetches the data each mode actually needs (not everything up front), and the area-coverage request endpoint's duplicate-detection returns a success-shaped response with a clear message rather than erroring on a legitimate repeat click — a thoughtful UX choice that also happens to prevent ticket spam.

## Unused/dead fields
None found — every field on `Ticket`/`TicketData` is rendered somewhere, conditionally by ticket `type`/`status`.

## Loading/error/realtime behavior
List page uses the shared `useCustomerQuery` hook (benefits from the fix in `docs/audits/customer-web/dashboard.md`, Finding #1). The create section manages three independent loading states (`ordersLoading`/`addressesLoading`/per-mode submitting) rather than a shared hook — appropriate given its lazy, mode-triggered fetches don't fit a single-query pattern. Detail page also uses `useCustomerQuery`; unlike other pages in this series it renders its own loading/error block *inline* (`if (loading || error || !data)`) rather than rendering the main content behind a loading overlay, which is a reasonable simplification for a page with no partial-content-while-loading use case. No polling or realtime subscription on either page.
