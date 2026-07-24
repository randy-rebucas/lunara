# Audit: Partner-web — Customers

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/customers/page.tsx`
- Component(s): inline in the page file, no separate board component

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/history/page.tsx` | "View orders →" link, `customers/page.tsx:107-112` | `customer=<customerId>` query param | **no (before fix)** — see Findings |

`orders/history/page.tsx` is itself a standalone top-level page (also reachable from the main nav via `portal-shell.tsx`), not exclusively a detail view of Customers — traced here only as far as the link contract with this page. `orders/history/page.tsx` in turn links each row to `orders/[id]/page.tsx`, a large, independent order-processing feature (photo upload, QR handoff, realtime socket) — genuinely a separate deep feature per this skill's scope guidance, not traced further here; it deserves its own audit pass.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List customers | GET | `/partner/customers` | `CustomerRow[]` | `PartnerController.getCustomers` |
| (sub-page) Order history, optionally scoped by customer | GET | `/partner/orders/history?status=&customerId=` | `HistoryOrder[]` | `PartnerController.getOrderHistory` -> `PartnerOperationsService.getOrderHistory` |

## Backend trace
`getCustomers` aggregates the `orders` collection: matches completed-ish
orders for the caller's scope (partner's own `partnerId`, or a staff member's
own `branchId`), groups by `customerId` for `totalOrders`/`totalSpent`/
`lastOrderAt`, then joins customer identity. Before the fix (see Findings)
this joined the wrong collection for the name and used a status value that
doesn't exist in the `OrderStatus` enum, so it silently produced blank names
and undercounted customers. `getOrderHistory` (used by the linked sub-page)
runs a similarly role-scoped `find` over `orders`, then a second query against
`payments` for the latest payment method per order (`loadLatestOrderPaymentsByOrderId`)
— both queries capped at 200/`.limit(200)`, no N+1.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Export CSV button | all of `customers[]` (`name`, `phone`, `totalOrders`, `totalSpent`, `lastOrderAt`) | disabled when `!customers?.length`; button itself doesn't fetch, just serializes already-loaded data |
| Customer table | `customerId`, `name` (fallback `'—'`), `phone` (fallback `'—'`), `totalOrders` (badge), `totalSpent` (via `formatPeso`), `lastOrderAt` (via `formatDate`), "View orders →" link | no client-derived thresholds or color maps — every value is either a direct field or a straightforward formatter |
| Empty state | n/a | shown when `!loading && !error && customers.length === 0` |

## Mutations
None — this page is read-only (a customer roster derived from completed orders).

## Authorization
`GET /partner/customers` is `@Roles(UserRole.PARTNER, UserRole.ADMIN)` (`partner.controller.ts:712`) — notably **excludes `UserRole.STAFF`**, even though the handler itself contains a dead `else if (role === UserRole.STAFF)` branch that scopes the query by the staff member's `branchId` (`partner.controller.ts:720-723`, now unreachable since `RolesGuard` rejects staff before the handler runs). The frontend is consistent with this: `useRequirePartner()` (used by this page) only allows `[PARTNER, ADMIN]` (`hooks/use-protected-page.ts:50-52`), so staff are redirected to `/orders` before ever reaching this page — no live authz gap, just dead code with an ambiguous signal about intent (see Findings #3). `GET /partner/orders/history` correctly includes `STAFF` in `@Roles` and applies `applyStaffBranchFilter`, matching its use from both this page's link and the main nav. Role-scoped filters (`partnerId`/`branchId`/`customerId` after the fix) are all derived from `req.user`, never from a client-suppliable param that could widen scope — no `[authz]` finding.

## Findings

1. **Customer names were always blank — the aggregation joined the wrong collection.** `getCustomers`'s `$lookup` (pre-fix, `partner.controller.ts:732`) joined `orders.customerId` against the `users` collection (`{ from: 'users', localField: '_id', foreignField: '_id' }`) and read `customer.firstName`/`customer.lastName` from the result — but `firstName`/`lastName` don't exist on the `User` schema at all (confirmed via `apps/api/src/modules/users/schemas/user.schema.ts`); they live on a separate `Customer` document (collection `customers`, keyed by `userId`, `apps/api/src/modules/customers/schemas/customer.schema.ts`). Every row's `name` field was therefore the concatenation of two `undefined` values plus a space — `" "` — which `customers/page.tsx`'s `c.name.trim() || '—'` (`page.tsx:99`) silently rendered as `'—'` for every customer, and the CSV export fell back to the raw `customerId` (`page.tsx:57`). The Customers page has never shown a real customer name.
   **Fix:** added a second `$lookup` against `customers` on `userId`, and read `firstName`/`lastName` from that instead, keeping the existing `$lookup` against `users` only for `phone` (which *is* a `User` field) — `apps/api/src/modules/partner/partner.controller.ts:711-747`.

2. **Customers whose only completed orders were in-store pickups never appeared at all.** The `$match` status filter (pre-fix) was `{ $in: ['completed', 'delivered', 'customer_pickup_complete'] }` — but `'customer_pickup_complete'` is not a value in the `OrderStatus` enum; the real value is `'customer_pickup'` (`packages/types/src/enums.ts:35`). Since Mongo matches on the literal string, any order with status `customer_pickup` was silently excluded from the aggregation's `$match` stage, so a customer whose only completed transactions were picked up in-store (never delivered) would never group into a row and would be invisible on this page and absent from the CSV export — undercounting the partner's customer base with no error or indication anything was excluded.
   **Fix:** replaced the raw string array with the `OrderStatus` enum values (`COMPLETED`, `DELIVERED`, `CUSTOMER_PICKUP`), matching the same three-status set `getOrderHistory` already uses correctly for its own history statuses (`partner-operations.service.ts:505-510`) — `apps/api/src/modules/partner/partner.controller.ts:716`.

3. **The "View orders →" link into order history didn't actually filter by customer.** `customers/page.tsx:108` links to `/orders/history?customer=${c.customerId}`, but `orders/history/page.tsx` (pre-fix) never read any `customer` search param — its `load()` only ever sent `?status=` — and the backend `GET /partner/orders/history` handler didn't accept a customer filter at all. Clicking "View orders" for any customer silently showed the full, unfiltered order history instead.
   **Fix:** added an optional `customerId` query param end-to-end — `PartnerController.getOrderHistory` now accepts and forwards it (`partner.controller.ts:578-586`), `PartnerOperationsService.getOrderHistory` filters by it when present and valid (`partner-operations.service.ts:504-521`), and `orders/history/page.tsx` now reads the `customer` search param via `useSearchParams()` (wrapped in `Suspense`, matching the pattern already used for the same hook in `admin-web`'s `login/page.tsx`) and includes it in the fetch, also updating the page description when scoped to a customer.

4. **`orders/history/page.tsx` never actually returned a `customerName`, despite the frontend already rendering one.** Separately from finding #3, `PartnerOperationsService.getOrderHistory`'s response mapping (pre-fix, `partner-operations.service.ts:531-543`) never set `customerName` at all — so the "Customer" column on the order-history table (`order.customerName ?? '—'`, `orders/history/page.tsx:131`) was dead code showing `'—'` for every row, unrelated to whatever's dead due to finding #3.
   **Fix:** `getOrderHistory` now looks up matching `Customer` documents (same `customers` collection, keyed by `userId`) for the fetched orders and populates `customerName` — `apps/api/src/modules/partner/partner-operations.service.ts:504-545`. Regression-checked: this is the same service method used by both the plain (no-`customerId`) and customer-scoped calls, so the fix benefits both paths, not just the one this audit's link exercises.

5. `getCustomers`'s handler contains a `STAFF`-scoping branch that's unreachable because `@Roles` on the route excludes `UserRole.STAFF` (`partner.controller.ts:712,720-723`), and the frontend's `useRequirePartner()` independently blocks staff from this page too. Both gates agree today (staff can't reach this page or its data), so there's no live authz gap — but the dead branch signals an ambiguous original intent (was staff access meant to ship and got missed in the `@Roles` list, or is exclusion deliberate and the branch just leftover?). Left unfixed: adding `UserRole.STAFF` to `@Roles` and to `useRequirePartner`'s allowed roles would be a product decision about whether shop staff should see the cross-order customer roster, not a bug fix.
   Frontend `orders/history` doesn't have this ambiguity — it already grants `STAFF`, both client and server side.

6. The frontend's `HistoryOrder` type (`orders/history/page.tsx:15`) declares an `orderNumber?: string` field, but no such field exists anywhere on the `Order` schema (`apps/api/src/modules/orders/schemas/order.schema.ts`) or in `PartnerOperationsService.getOrderHistory`'s response — the table always falls back to `order._id.slice(-6).toUpperCase()` (`orders/history/page.tsx:128`). Left unfixed: introducing a real human-readable order-number scheme is a feature addition (needs a generation/uniqueness strategy), out of scope for this pass — noted so it isn't mistaken for working today.

## Unused/dead fields
None on the Customers page itself — `CustomerRow`'s `customerId`/`name`/`phone`/
`totalOrders`/`totalSpent`/`lastOrderAt` are all rendered (in the table and/or
CSV export). On the linked `orders/history` sub-page, `orderNumber` was
effectively dead before and after this fix (see Finding #6 — it was never
populated by the backend to begin with, not something this pass removed).

## Loading/error/realtime behavior
Both pages use the shared `usePartnerQuery` hook (spinner via `DataPageStatus`,
error text without clearing prior data, explicit empty state). No polling or
realtime subscription on either page — the deeper `orders/[id]` detail page
does use a socket (`usePartnerOrderSocket`) but that's out of scope here per
the Sub-pages note above.
