# Audit: Partner-web — Orders history

Date: 2026-08-31

## Entry point
- Page: `apps/partner-web/src/app/orders/history/page.tsx`
- Component(s): `OrderHistoryContent` (client component), `OrderDetailPanel` (inline
  detail panel — new since the last audit pass), shared `DataPageStatus`/`PageHeader`/
  `AuthLoading`, `usePartnerQuery` hook.

## Sub-pages

The page no longer links out to `orders/[id]/page.tsx` — clicking a row now opens
`OrderDetailPanel` inline (same pattern as the reworked Customers page), which fetches
`GET /partner/orders/:id/processing` directly rather than navigating away.

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| None (inline panel, not a route) | row click, `orders/history/page.tsx:299` | `order._id` -> `/partner/orders/:id/processing` | yes |

`GET /partner/orders/:id/processing` is the same endpoint already fully audited in
[order-detail.md](order-detail.md) (`PartnerController.getProcessing` ->
`ProcessingService.getOrderProcessing`) — it re-derives the caller's portal branch and
calls `assertOrderPortalAccess(order, userId, role, branchId)` before returning
anything, so a completed/cancelled order opened from this history list gets the same
ownership check as the live processing view; not re-traced here. The panel only reads
`detail.order` (`PartnerOrderDetailView`) for a read-only breakdown (items, subtotal,
delivery fee, discount, total, scheduling) — no mutation actions are exposed from this
panel, unlike the full `orders/[id]` page it stands in for.

This page is itself reachable with a `?customer=<id>` query param (read via
`searchParams.get('customer')`, `orders/history/page.tsx:216`) from the Customers
module's detail panel — not re-traced here since the Customers module's own audit
([customers.md](customers.md)) is the place that link's correctness belongs.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Order history | GET | `/partner/orders/history?status=&customerId=` | `HistoryOrder[]` | `PartnerController.getOrderHistory` → `PartnerOperationsService.getOrderHistory` |
| (inline panel) Order breakdown | GET | `/partner/orders/:id/processing` | `PartnerOrderDetailView` | `PartnerController.getProcessing` -> `ProcessingService.getOrderProcessing` |

## Backend trace
`getOrderHistory` (`partner-operations.service.ts:507-559`): filters `Order.find` to a fixed set of terminal statuses (`DELIVERED`, `COMPLETED`, `CUSTOMER_PICKUP`, `CANCELLED`), narrowed further by the `status` query param if it's one of those four (an invalid/unrecognized value falls back to "all history statuses" rather than erroring — reasonable). Role-scoped: `PARTNER` → `partnerId` filter; `STAFF` → resolves the staff's branch via `resolvePortalBranchId` and applies it via the shared `applyStaffBranchFilter` helper (also used identically in `processing.service.ts`, already vetted there). `ADMIN` gets no scoping filter at all — deliberate, matching the platform-wide visibility admins have elsewhere in this module. An optional `customerId` param is ANDed into the filter (not OR'd), so a partner passing another partner's customer id still only sees orders that are *both* that customer's *and* their own — no cross-partner leak. Query is capped at `.limit(200)`, sorted `updatedAt: -1`, with batched (non-N+1) lookups for the latest payment per order (`loadLatestOrderPaymentsByOrderId`) and customer names (`customerModel.find({userId:{$in:...}})`) — no per-row queries.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Status filter chips | client-side `statusFilter` state, refetches via `usePartnerQuery`'s dependency array | — |
| History table | `order._id`, `orderNumber` (always absent — see Unused/dead fields), `customerName`, `status` (via `STATUS_LABELS`/`STATUS_BADGE` maps), `totalAmount`, `paymentMethod`, `completedAt ?? createdAt` | `STATUS_LABELS`/`STATUS_BADGE` are hardcoded client-side maps keyed by the same four `OrderStatus` string values the backend filters on (verified exact match against `packages/types/src/enums.ts`) — correctly in sync today, but a future new terminal status added to `OrderStatus` wouldn't automatically get a label/badge here without a matching frontend edit (the same "manually-synced key map" pattern flagged elsewhere in this codebase's audits, e.g. rider-mobile's document-types duplication) |
| Order detail panel (inline) | from the clicked row's already-loaded `HistoryOrder`: `status`, `customerName`, `paymentMethod`, `createdAt`, `completedAt`; from its own fetch (`detail.order`): `items[]` (`serviceType`/`notes`/`quantity`/`unitPrice`), `subtotal`, `deliveryFee`, `discount`, `couponCode`, `total`, `scheduledPickupAt`, `scheduledDeliveryAt`, `estimatedWeightKg` | correctly avoids re-fetching what the row already has (status/customer/payment/dates) and only fetches the additional line-item breakdown — no redundant round-trip |

## Mutations
None — this is a read-only history view, including the inline detail panel (no edit/cancel/refund actions are exposed here, unlike the full `orders/[id]` page).

## Authorization
Correctly role-scoped for `PARTNER` (own orders only) and `STAFF` (own branch only, via the shared, already-audited `applyStaffBranchFilter`); `ADMIN` intentionally unscoped. No `[authz]` findings.

## Findings

1. **`orderNumber` field declared on the frontend type is never populated by the backend.** `HistoryOrder.orderNumber` (`orders/history/page.tsx:15`) is read with a fallback (`order.orderNumber ?? order._id.slice(-6).toUpperCase()`, line 137), but `getOrderHistory`'s mapped response (`partner-operations.service.ts:546-557`) never includes an `orderNumber` field — and the `Order` schema itself has no such field at all (confirmed via grep of `order.schema.ts`); "order number" elsewhere in this codebase is purely a display convention derived from the last 6 characters of `_id`, not a stored field. So the fallback always fires and the table always displays correctly — this isn't a visible bug, just a dead/aspirational field on the frontend interface that could confuse a future reader into thinking a real `orderNumber` exists to fetch. Left unfixed (not worth a code change): removing the dead interface field is a trivial cleanup with zero behavioral effect, and adding a real `orderNumber` to the `Order` schema would be a much larger, unrelated data-model change this audit shouldn't scope-creep into.

2. **No pagination beyond the first 200 most-recent orders.** `getOrderHistory` caps results at `.limit(200)` (`partner-operations.service.ts:531`) with no offset/page parameter, and the frontend has no "load more" affordance — a partner shop with more than 200 completed/cancelled orders simply cannot see anything older than the 200th most recent through this view, with no indication that older history exists and is being silently cut off. Left unfixed: this matches an established pattern used throughout the codebase (rider-mobile's task/notification history endpoints are similarly capped with no pagination, per [rider-mobile's tasks.md](../rider-mobile/tasks.md) and [notifications.md](../rider-mobile/notifications.md)) — appears to be a deliberate product-wide simplicity trade-off rather than a one-off oversight, so fixing it here alone (without a matching pagination UI/API convention decision for the rest of the app) would be inconsistent scope creep rather than a targeted fix.

## Unused/dead fields
- `HistoryOrder.orderNumber` — see Findings #1. Not sensitive, purely a naming/type-accuracy nit.

## Loading/error/realtime behavior
`usePartnerQuery` (shared hook, already vetted in other partner-web audits) handles loading/error state; `DataPageStatus` renders it consistently with the rest of the app. The inline `OrderDetailPanel` uses its own local `useState`/`useEffect` fetch (not `usePartnerQuery`) with a `cancelled` flag guarding against a stale response landing after the selected order changes or the component unmounts — correct, and independent of the parent list's loading state, so switching between rows doesn't flash the parent table's spinner. No realtime subscription anywhere on this page — appropriate for a historical/completed-orders view that doesn't need live updates.
