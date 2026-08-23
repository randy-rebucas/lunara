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

1. **[sensitive-data] `adminNote` was leaked to the customer on both the list and detail endpoints.** `RefundsService.serializeRefund` (`refunds.service.ts`) is a single shared serializer used by both the admin-facing (`listAdminRefunds`/`getAdminRefund`) and customer-facing (`listCustomerRefunds`/`getCustomerRefund`) methods, and it included `adminNote` unconditionally — internal reviewer commentary (e.g. "Auto-approved by automation settings", or an admin's private note while reviewing) was returned in every `GET /refunds` and `GET /refunds/:id` response body a customer receives. The customer-web frontend never reads `adminNote` (it's absent from both `RefundRow` and `RefundDetail`), so this was a genuinely unused *and* sensitive field — worse than ordinary dead payload. This is a shared-code issue: `serializeRefund` is also called from `apps/api/src/modules/ai-agents/tools/refunds.tools.ts`'s `get_my_refunds`/`get_my_refund_detail` tools (the "emma" customer persona), so the same leak reached the AI assistant's customer-facing tool responses too.
   **Fix:** added a `serializeRefundForCustomer` wrapper (`refunds.service.ts`) that strips `adminNote` from `serializeRefund`'s output, and switched `listCustomerRefunds`/`getCustomerRefund` to use it. `listAdminRefunds`/`getAdminRefund` (and the `benjamin`/admin AI-agent tools that call them) are untouched and still get the full `adminNote` — verified by re-reading `refunds.tools.ts`, which routes admin tools through the unchanged `listAdminRefunds`/`getAdminRefund` methods. Typechecked `apps/api` clean after the change.

2. The eligible-orders picker's client-side exclusion of orders with an already-open refund request is a good defensive UX detail layered on top of (not instead of) server-side enforcement — no issue, noted for completeness.

## Unused/dead fields
None found — every field on `RefundRow`/`RefundDetail` is rendered.

## Loading/error/realtime behavior
Both pages use the shared `useCustomerQuery` hook (benefits from the fix in `docs/audits/customer-web/dashboard.md`, Finding #1); `RefundRequestSection` manages its own separate loading/error state for the orders picker, matching the same lazy-fetch-on-demand pattern already seen in `docs/audits/customer-web/support.md`'s create section. No polling or realtime subscription on either page — a refund's status only updates on manual refresh or navigation.

## UI/UX notes
- List and detail pages consistently reuse `refundStatusBadgeClass`/`formatRefundStatus` for the status pill — good cross-page consistency, no divergent color/label mapping to keep in sync.
- The detail page's flow stepper (`REFUND_FLOW` + `refundFlowIndex`) gives clear progress feedback with distinct done/active/pending icon states (`Check`/`ArrowRight`/`Circle`) — a strong pattern, comparable to the lost-item stepper on `/support`.
- List page's "Refresh" button duplicates what `DataPageStatus`'s automatic loading state already communicates; harmless but slightly redundant UI, not worth changing given it also lets the customer force a manual refetch without navigating away.
- Refund rows are entirely wrapped in a `<Link>` with no visible affordance (chevron/arrow) hinting the whole card is clickable, unlike the picker's `Request →` rows in `RefundRequestSection` just above it on the same page — minor inconsistency in "is this whole row a link" affordance within one page. Left as a note rather than fixed, since adding an icon is a small design choice better made alongside the rest of a list-card pattern audit than as a one-off change here.
