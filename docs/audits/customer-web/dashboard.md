# Audit: Customer-web — Dashboard

Date: 2026-08-23 (re-audited; see Findings #2 and UI/UX notes appended below)

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/dashboard/page.tsx` -> `dashboard-client.tsx` (`'use client'`)
- Component(s): `PageShell`, `PageHeader`, `DataPageStatus`, `ReviewNotifications`, `DealsCarousel`, `ShareInviteCard`, `OrderPartnerCoverageNotice`, `AuthLoading`, `Card`/`CardBody`, `ButtonLink`

## Sub-pages
This page links into several large, independent features rather than thin detail views — each is deep enough to warrant its own audit doc rather than being traced fully here:

| Linked page | Linked from | Notes |
|---|---|---|
| `/wallet` | wallet card | own fetches beyond balance (transactions) — separate module, not yet audited |
| `/book` | "Book laundry" CTA | booking flow, separate module, not yet audited |
| `/orders` | "View all" | order list, separate module, not yet audited |
| `/orders/[id]` | order card (non-pending orders) | order detail, separate module, not yet audited |
| `/checkout/[orderId]` | order card (status `PENDING` only) | checkout flow, separate module, not yet audited |

Param handoff for the two order-card links is correct: `o._id` (a real Mongo
ObjectId string from the `/orders` list response) is passed as the `id`/
`orderId` route param for both destinations, matching what those pages'
`useParams()` would expect (verified by shape, not yet by tracing the
sub-pages themselves — that's deferred to their own audits per the table
above).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Profile | GET | `/customers/me` | `CustomerProfile` (`firstName`/`lastName`/`loyaltyPoints?`) | `CustomersController.getMe` -> `CustomersService.getProfile` |
| Wallet balance | GET | `/wallets/me` | `{ balance: number }` | `WalletsController.getWallet` -> `WalletsService.getWallet` |
| Orders | GET | `/orders` | `{ items: OrderSummary[] }` | `OrdersController.findAll` -> `OrdersService.findAll` |

All three fetched in parallel via `Promise.all`, gated behind `ready` (auth + onboarding-complete check from `useProtectedPage`).

## Backend trace
`CustomersService.getProfile` returns the full `Customer` document for the
authenticated user (`findByUserId(userId)`, 404 if none) — the frontend
narrows it to `firstName`/`lastName`/`loyaltyPoints`, ignoring the rest
(addresses, phone, etc.), which is expected since this is the user's own
profile, not a truncation concern.

`OrdersService.findAll` (`orders.service.ts:248-272`) branches its Mongo
filter by `user.role`: `CUSTOMER` -> `{ customerId: userId }` (scoped
correctly to `req.user.sub`, cannot be widened — there's no request param
that lets a customer pass someone else's id), `RIDER` -> pickup/delivery
rider match, anything else (staff/admin/partner, used by other apps hitting
the same endpoint) -> unrestricted `{}`. Confirmed the unrestricted branch
is intentional and out of scope here (staff/admin need to see all orders;
this endpoint is shared across apps, not customer-web-specific) — no
`[authz]` issue for the customer-web case this page actually exercises.
Customer-role results additionally run through `enrichCustomerOrders` (adds
`partnerCoverage`, consumed by `OrderPartnerCoverageNotice`).

`OrdersController` has no `@Roles(...)` on `findAll` itself (only
`JwtAuthGuard`/`RolesGuard` at class level, which pass through when no roles
are declared on the route) — any authenticated role can call it, but since
filtering happens correctly by role inside the service, this isn't a data
leak, just a slightly wider-than-strictly-necessary guard surface. Not
flagged as a finding since it matches the multi-app-shared-endpoint pattern
already accepted elsewhere in this codebase.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Welcome header | `profile.firstName/lastName` (falls back to `'there'` if `null`) | |
| Wallet balance card | `balance` (via `formatCurrency`) | |
| "Book laundry" CTA | static copy, links to `/book` | |
| Review notifications | none from this page's own fetch — self-contained component with its own data flow, not traced here | |
| Deals carousel | none from this page's own fetch — self-contained, uses the same shared `useCustomerQuery` hook fixed in this pass (see Findings) | |
| Share/invite card | none from this page's own fetch — self-contained | |
| Active/recent orders list | `activeOrders` (derived: `allOrders.filter(isActiveOrderStatus)`, falls back to all orders if none active), sliced to 3; per-card: `_id`, `bookingType`, `total`, `status`, `partnerCoverage` (only for `PENDING_DISPATCH`) | `bookingType`/`status` formatted client-side via `.replace(/_/g, ' ')` |

## Mutations
None — dashboard is read-only; all actionable buttons are navigation links to other pages' mutation flows.

## Authorization
Page itself requires an authenticated customer with completed onboarding (`useProtectedPage({ requireOnboarding: true })`). All three endpoints it calls are scoped correctly to the authenticated user (`/customers/me`, `/wallets/me` by `req.user.sub`; `/orders` by role-branched filter, see Backend trace). No `[authz]` issues found.

## Findings

1. **[FIXED] Shared `useCustomerQuery` hook wiped previously-loaded data on any refetch error, including the very first load's error.** `apps/customer-web/src/lib/use-customer-query.ts:20-22` called `setData(null)` in its `catch` block, unconditionally clearing whatever had been loaded before — the same bug class already found and fixed in `usePartnerQuery` and `useNotifications` elsewhere in this audit series. On this page specifically: if the initial load partially races (network blip after the page has already shown data from a prior successful load, e.g. after a manual `reload()` elsewhere), the dashboard would blank out wallet balance/orders instead of leaving the last-known-good data visible under the error banner. This hook has 10 consumers across customer-web (`dashboard-client.tsx`, `deals-carousel.tsx`, `rewards/page.tsx`, `wallet/page.tsx`, `support/page.tsx`, `support/[id]/page.tsx`, `refunds/page.tsx`, `refunds/[id]/page.tsx`, `profile/page.tsx`), so this was a systemic issue, not dashboard-specific.
   **Fix:** removed the `setData(null)` call in `use-customer-query.ts`'s catch block — `data` now persists across a failed refetch, with `error` and `DataPageStatus` still surfacing the failure. Verified all 10 consumers render their own loading/error/empty states independently of whether `data` happens to be stale-but-present vs. `null` (none of them branch on "is `data` exactly `null`" in a way that would newly break — they all check `loading`/`error` first via `DataPageStatus` or equivalent), so this is a safe fix with no regressions across its other callers.

## Unused/dead fields
`/orders`'s response also includes `total`/`page`/`limit`/`totalPages` (pagination metadata) which this page ignores — expected, since the dashboard only needs the first 3 items for a preview, not full pagination; the full `/orders` list page (not yet audited) is presumably where that metadata is consumed.

## Loading/error/realtime behavior
Uses the shared `useCustomerQuery` hook (see Finding #1 for the fix applied here). Initial loading is gated by `useProtectedPage`'s `isLoading`/`ready` (shows `AuthLoading` until auth+onboarding checks resolve), then `DataPageStatus` handles the fetch's own loading/error display. Empty state ("No orders yet") only renders once `!loading && !error && displayOrders.length === 0`, correctly avoiding a false empty-state flash during loading or after a failed fetch. No polling or realtime subscription on this page itself.

## UI/UX notes
- Visual hierarchy reads well: greeting -> wallet balance chip -> primary CTA card ("Book now") -> quick actions -> orders — most-actionable content is front-loaded, consistent with the other authenticated pages' `PageShell` + header pattern.
- Icons throughout (`Wallet`, `ChevronRight`, quick-action icons) are correctly marked `aria-hidden`, with their meaning carried by adjacent visible text — no accessibility gap here.
- This is the one authenticated page that skips the shared `PageHeader` component (used by `orders/page.tsx`, `notifications/page.tsx`, etc.) in favor of a bespoke `<header>` block (`dashboard-client.tsx:85-99`) to fit the wallet-balance chip next to the title. Reasonable given the extra chip, but it means the title styling (`text-2xl font-bold`) isn't guaranteed to stay in sync with `PageHeader`'s if that component's styles change later — worth a mental note, not worth forcing into `PageHeader` just for consistency.
- The quick-actions row (`nav[aria-label="Quick actions"]`) horizontally scrolls on mobile with no visual affordance (no fade edge or scroll indicator) hinting there are 5 items when only ~4 fit in view — a minor discoverability gap, low-risk to leave as a finding rather than fix speculatively without a design pass.
- Order progress bar and "View all" link give quick scannability; status label duplicates info already conveyed by the progress bar + `currentStepLabel`, which is intentional redundancy for accessibility (colorblind/no-visual users still get the text status), not a defect.
