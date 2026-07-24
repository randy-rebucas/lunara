# Audit: Customer-web — Refunds (list + detail)

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/refunds/page.tsx` (`'use client'`) — refund request list + eligible-orders picker
- Component(s): `PageShell`, `PageHeader`, `DataPageStatus`, `RefundRequestSection` (`components/refund-request-section.tsx`), `Card`/`CardBody`

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `refunds/[id]/page.tsx` | refund row link | `r._id` -> `id` route param | yes |

`refunds/[id]/page.tsx` is a read-only refund detail/timeline view (status stepper, approved/rejected amount, wallet-credit confirmation) — no mutations, covered in full here. Actual refund *submission* happens on `/orders/:id/refund` (already fully traced in `docs/audits/customer-web/orders.md`) — this list page's picker only routes into that flow, it doesn't submit directly.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List refund requests | GET | `/refunds` | `RefundRow[]` | `RefundsController.listMine` -> `RefundsService.listCustomerRefunds` |
| Eligible orders (for the picker) | GET | `/orders?page=1&limit=30` | `{ items: OrderOption[] }` | `OrdersController.findAll` (already traced) |
| Refund detail | GET | `/refunds/:id` | `{ refund: RefundDetail }` | `RefundsController.getMine` -> `RefundsService.getCustomerRefund` |

## Backend trace
All three routes on `RefundsController` are `@Roles(UserRole.CUSTOMER)`-gated with `req.user.sub` threaded into the service, which was already read in full during the orders-module audit: `listCustomerRefunds`/`getCustomerRefund` both filter/verify by `customerId`, with `getCustomerRefund` throwing on a non-owned id. `createRequest` (the actual submission, reached via `/orders/:id/refund`) independently verifies order ownership too — nothing new to re-trace here beyond confirming this list/detail pair calls the same already-audited, correctly-scoped service methods.

## Cards / panels

**List page:**
| Card | Fields consumed | Notes |
|---|---|---|
| Eligible-orders picker (`RefundRequestSection`) | `orders[]` filtered client-side by `o.refundable === true`, `NOT_REFUNDABLE_STATUSES` (`PENDING`/`REFUNDED`), and excluding any order with an already-open refund (`isOpenRefundStatus`, computed from `existingRefunds` passed in as a prop) | the "exclude orders with an open refund" filter is a nice touch that prevents a customer from starting a second concurrent refund request for the same order from this list, on top of whatever the backend independently enforces |
| Refund row | `orderId` (truncated), `requestedAmount`, `approvedAmount` (only shown if it differs from requested), `status` (via `formatRefundStatus`/`refundStatusBadgeClass`), `updatedAt`/`createdAt` | |
| Refresh button | none — triggers `reload()` | |
| Empty state | none | |

**Detail page:**
| Card | Fields consumed | Notes |
|---|---|---|
| Header | `orderId` (truncated), `processedAt`, `status` | |
| Refund flow stepper | `REFUND_FLOW` (static) + `stage`/`status` to derive done/active, same pattern as the lost-item stepper in `docs/audits/customer-web/support.md` | |
| Request panel | `reason`, `requestedAmount`, `approvedAmount`, `rejectionReason`, `processedAt` (-> "Refund credited to your wallet.") | |
| Timeline | `timeline[]` | |
| Footer actions | static links to `/orders/:orderId` and `/wallet` | |

## Mutations
None on either page — refund *submission* is a mutation but lives entirely on `/orders/:id/refund` (audited in `docs/audits/customer-web/orders.md`); this list/detail pair is read-only navigation/tracking.

## Authorization
Every endpoint this module touches is `@Roles(UserRole.CUSTOMER)`-gated and scoped to the caller server-side (see Backend trace). No `[authz]` issues.

## Findings
No issues found. The eligible-orders picker's client-side exclusion of orders with an already-open refund request is a good defensive UX detail layered on top of (not instead of) server-side enforcement.

## Unused/dead fields
None found — every field on `RefundRow`/`RefundDetail` is rendered.

## Loading/error/realtime behavior
Both pages use the shared `useCustomerQuery` hook (benefits from the fix in `docs/audits/customer-web/dashboard.md`, Finding #1); `RefundRequestSection` manages its own separate loading/error state for the orders picker, matching the same lazy-fetch-on-demand pattern already seen in `docs/audits/customer-web/support.md`'s create section. No polling or realtime subscription on either page — a refund's status only updates on manual refresh or navigation.
