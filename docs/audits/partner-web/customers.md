# Audit: Partner-web — Customers

Date: 2026-08-31

## Entry point
- Page: `apps/partner-web/src/app/customers/page.tsx`
- Component(s): `CustomerDetailPanel` (same file) — the page has been reworked since the
  last audit: it no longer links out to `orders/history`; clicking a row now opens an
  inline detail panel (edit name/phone, order history) beside the table.

## Sub-pages
None — no outbound navigation into a detail route. The order-history list previously
reached via a "View orders →" link into `orders/history/page.tsx` is now rendered
inline in `CustomerDetailPanel` via its own `/partner/orders/history?customerId=`
fetch, so there is no longer a separate sub-page to trace for this module.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List customers | GET | `/partner/customers` | `PartnerCustomerSummary[]` | `PartnerController.getCustomers` |
| Customer detail | GET | `/partner/customers/:customerId` | `PartnerCustomerDetail` | `PartnerController.getCustomer` |
| Update customer | PATCH | `/partner/customers/:customerId` | `PartnerCustomerDetail` | `PartnerController.updateCustomer` -> `UpdateCustomerDto` |
| Customer's order history | GET | `/partner/orders/history?customerId=` | local `CustomerOrder[]` (page.tsx:13-19) | `PartnerController.getOrderHistory` -> `PartnerOperationsService.getOrderHistory` |

## Backend trace
`getCustomers` aggregates `orders` (role-scoped: `partnerId` for `PARTNER`, `branchId`
for `STAFF`, unscoped for `ADMIN`) for completed-ish statuses
(`COMPLETED`/`DELIVERED`/`CUSTOMER_PICKUP`), groups by `customerId` for
`totalOrders`/`totalSpent`/`lastOrderAt`, joins `users` for `phone` and `customers`
for the name, sorts by `lastOrderAt desc`, capped at 200 (`partner.controller.ts:920-959`).
`getCustomer` re-derives the same summary for one customer plus `email`/`customerSince`
(`partner.controller.ts:961-1012`). `updateCustomer` re-validates that the caller's
role-scoped `orderModel.exists(...)` still finds at least one order for that customer
before writing (`partner.controller.ts:1014-1053`) — so a partner can't patch an
arbitrary user's name/phone by guessing a `customerId` that never ordered from them;
it then re-fetches via `getCustomer` for the response, so the PATCH result and a
follow-up GET are guaranteed consistent. `getOrderHistory` (used by the detail panel)
runs a similarly role-scoped `find` over `orders`, then a second query against
`payments` for the latest payment method and a third against `customers` for names —
all capped at `.limit(200)`, no N+1.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Export CSV button | all of `customers[]` (`name`, `phone`, `totalOrders`, `totalSpent`, `lastOrderAt`) | disabled when `!customers?.length`; serializes already-loaded data, no extra fetch |
| Customer table | `customerId`, `name` (fallback `'—'`), `phone` (fallback `'—'`, column hidden once a row is selected to make room for the detail panel), `totalOrders` (badge), `totalSpent` (via `formatPeso`), `lastOrderAt` (via `formatDate`) | no client-derived thresholds/color maps; row click sets `selectedId` |
| Detail panel — identity | `detail.name`, `detail.phone`, `detail.email` | falls back to "No phone on file" |
| Detail panel — edit form | `detail.firstName`, `detail.lastName`, `detail.phone` seeded into local state on load (page.tsx:161-168) | resets `editing` to `false` whenever `detail` changes (including after every save) |
| Detail panel — stats | `detail.totalOrders`, `detail.totalSpent` (via `formatPeso`), `detail.lastOrderAt` (via `formatDate`), `detail.customerSince` (via `formatDate`, only rendered if present) | |
| Detail panel — order history | `orders[].status` (mapped through local `STATUS_LABELS`, falls back to raw value), `orders[].createdAt` (via `formatDate`), `orders[].totalAmount` (via `formatPeso`, fallback `'—'`) | `STATUS_LABELS` (page.tsx:21-26) is a small hardcoded map that must stay in sync with `OrderStatus` values used in order history; a status not in the map just falls back to the raw enum string, so it degrades gracefully rather than breaking |
| Empty state | n/a | shown when `!loading && !error && customers.length === 0` |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save edited name/phone | no (in-place field update, not a delete) | n/a | yes — `disabled={saving \|\| !firstName.trim() \|\| !lastName.trim()}` | yes — `saveError` rendered via `alert-error`, `finally` always clears `saving` |

Note: the "Cancel" button while editing calls `reload()` (page.tsx:240) instead of just
resetting local state — it re-fetches `/partner/customers/:customerId` over the network
to discard an in-progress edit. Not a correctness bug (the `useEffect` re-seeds the form
from the reloaded `detail` and clears `editing`), just an avoidable round-trip; left as
a minor inefficiency rather than a fix, since it's low-impact and the pattern (reload
to cancel) is used consistently for this hook's `setData`/`reload` API elsewhere in the
app.

## Authorization
`GET /partner/customers`, `GET /partner/customers/:customerId`, and
`PATCH /partner/customers/:customerId` are all `@Roles(UserRole.PARTNER, UserRole.ADMIN)`
(`partner.controller.ts:921,962,1015`) — excluding `UserRole.STAFF`. All three handlers
still contain a dead `else if (role === UserRole.STAFF)` branch that scopes the query by
the staff member's `branchId` (`partner.controller.ts:929-931,977-979,1031-1033`), unreachable
since `RolesGuard` rejects staff before the handler runs. The frontend is consistent:
`useRequirePartner()` (`hooks/use-protected-page.ts:50-52`) only allows
`[PARTNER, ADMIN]`, so staff are redirected to `/orders` before reaching this page — no
live authz gap, just dead code left over from before (or in anticipation of) a staff-facing
version of this page. For `ADMIN`, no `partnerId`/`branchId` filter is applied at all,
so admin intentionally sees the customer roster across every partner — matches the
role's platform-wide scope used elsewhere (e.g. reports, settlements). All role-scoped
filters are derived from `req.user`, never from a client-suppliable param — no `[authz]`
finding. `GET /partner/orders/history` correctly includes `STAFF` and applies
`applyStaffBranchFilter`/branch scoping independently — consistent with its other callers.

## Findings

1. Three handlers (`getCustomers`, `getCustomer`, `updateCustomer`) each carry an
   unreachable `STAFF`-branch check because `@Roles` on all three excludes
   `UserRole.STAFF` while the handler body still branches on it
   (`partner.controller.ts:929-931,977-979,1031-1033`). This is dead code, not a live
   bug (client and server agree staff can't reach this page), but it's ambiguous whether
   staff access to the customer roster was deliberately dropped or just never wired
   through to `@Roles`/`useRequirePartner`. **Left unfixed** — deciding whether shop
   staff should see the cross-order customer roster and be able to edit customer
   contact info is a product call, not something to flip silently in an audit pass.
2. `getOrderHistory`'s response includes `customerName` and `completedAt`
   (`partner-operations.service.ts:659,663`), neither of which the Customers page's
   local `CustomerOrder` interface (page.tsx:13-19) declares or reads — dead payload
   for this particular caller. Not sensitive (derived from data the caller already
   has), and the same endpoint's other consumer (`orders/history/page.tsx`) does use
   `customerName`, so this isn't a candidate for trimming the backend response.
   **Left as noted, not fixed** — trimming per-caller would require a query param or
   a second endpoint shape, out of scope for a read-only inefficiency this minor.
3. `UpdateCustomerDto.phone` has no format validation beyond `@MaxLength(30)`
   (`dto/update-customer.dto.ts:14-17`) — a partner can save any string as a phone
   number. Consistent with how phone is validated elsewhere in this controller (no
   stricter DTO found for comparable fields), so **left unfixed** as a pre-existing,
   app-wide convention rather than a customers-specific gap.

## Unused/dead fields
`customerName` and `completedAt` from `GET /partner/orders/history`'s response are
unused by this page's local `CustomerOrder` type (see Finding #2) — not sensitive.

## Loading/error/realtime behavior
Both the list and the detail panel use the shared `usePartnerQuery` hook (spinner via
`DataPageStatus`, error text without clearing previously-loaded data, explicit empty
states). No polling or realtime subscription on this page. The detail panel's two
fetches (`/partner/customers/:id` and `/partner/orders/history?customerId=`) run
independently and don't block each other's loading/error state — a slow order-history
fetch doesn't delay the identity/stats section from rendering.
