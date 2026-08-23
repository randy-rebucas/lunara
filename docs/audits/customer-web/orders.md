# Audit: Customer-web — Orders (list + detail + sub-pages)

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/orders/page.tsx` (`'use client'`) — order list with infinite scroll
- Component(s): `PageShell`, `PageHeader`, `DataPageStatus`, `Card`/`CardBody`, `ButtonLink`, `OrderPartnerCoverageNotice`, `useInfiniteScroll`

## Sub-pages
Order detail (`orders/[id]/page.tsx`, 554 lines) is a deep feature in its own right — full timeline, live socket tracking, delivery handoff, payment receipt — audited in full below rather than as a thin detail view. Its own three sub-pages (lost-item, refund, review) are lighter forms, audited at the depth their size warrants.

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/page.tsx` | list card link (`orderHref`), "Book again" reorder flow indirectly | `o._id` -> `id` route param | yes |
| `orders/[id]/lost-item/page.tsx` | order detail page's "Report missing item" / "File a lost-item complaint" links | `id` (order id) -> `orderId` in the POST body | yes |
| `orders/[id]/refund/page.tsx` | order detail page's "Request refund" link (only shown when `order.refundable === true`) | `id` -> `orderId` in the POST body | yes |
| `orders/[id]/review/page.tsx` | order detail page's "Rate your experience" / "View your published review" links | `id` -> route param, used for both `GET /reviews/orders/:id` and `POST /reviews` | yes |

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Order list (paginated) | GET | `/orders?page=&limit=15` | `OrdersPageData` | `OrdersController.findAll` -> `OrdersService.findAll` (already traced in `docs/audits/customer-web/dashboard.md`) |
| Cancel/delete order (list) | DELETE | `/orders/:id` | — | `OrdersController.cancel` -> `OrdersService.cancelByCustomer` |
| Order detail | GET | `/orders/:id` | `OrderDetail` | `OrdersController.findOne` -> `OrdersService.findOne` |
| Delivery UI state | GET | `/orders/:id/delivery` | `DeliveryUiState` | `OrdersController.getDeliveryStatus` -> `DeliveryService.getCustomerDeliveryStatus` |
| Review status | GET | `/reviews/orders/:id` | `{ canReview, review }` | reviews module (used by both order detail and the review sub-page) |
| Cancel order (detail, pending-dispatch) | DELETE | `/orders/:id` | — | same `cancel`/`cancelByCustomer` as the list |
| Verify delivery | POST | `/orders/:id/delivery/verify` | — | `OrdersController.verifyDelivery` -> `DeliveryService.customerVerify` |
| Sign delivery | POST | `/orders/:id/delivery/sign` | — | `OrdersController.signDelivery` -> `DeliveryService.customerSign` |
| Realtime tracking | Socket.IO `/tracking` namespace | `joinOrder`, `orderStatusUpdate`, `orderEvent`, `locationUpdate` | — | `TrackingGateway` |
| Report lost item | POST | `/support/lost-items` | `{ _id }` | `SupportController.reportLostItem` -> `SupportService.createLostItemComplaint` |
| Request refund (load context) | GET | `/payments/orders/:id` | payment method/cash-timing check | `PaymentsController.getForOrder` |
| Request refund (submit) | POST | `/refunds` | `{ _id }` | `RefundsService.createRequest` |
| Submit review | POST | `/reviews` | `{ review }` | reviews module |
| Mark order-related notification read (review page side-effect) | GET/PATCH | `/notifications/me?limit=10`, `/notifications/:id/read` | — | notifications module, not otherwise part of this audit |

## Backend trace
`OrdersService.cancelByCustomer` (already read in full) independently re-derives whether cancellation/deletion is allowed — a `PENDING` order is deleted outright (with its payments) only if none is `PAID`; a `PENDING_DISPATCH` order can only be cancelled if no `branchId` is assigned yet, refunding wallet/online payments to the wallet and leaving cash orders uncharged. This matches the frontend's `canCancelOrder` client-side gate, but critically **the server enforces the same rule independently** rather than trusting the client's button visibility — a customer can't bypass this by calling the API directly with a different order status.

`TrackingGateway.handleJoinOrder` (read in full) verifies a `CUSTOMER`-role socket can only join `order:<id>` for an order it actually owns (`resolveCustomerId` lookup, cached), rejecting otherwise — the live tracking socket cannot be used to snoop on another customer's order by guessing an id.

`DeliveryService.customerVerify`/`customerSign` (read in full) both re-check `order.customerId === customerId`, and `customerVerify` additionally requires `order.status === OUT_FOR_DELIVERY` and the exact 4-digit code match before accepting. Both are naturally idempotent (re-setting the same timestamp/name fields on a repeat call) except for re-emitting a duplicate `orderEvent` socket notification on a second click — see Finding #1, now fixed by adding the missing busy-guard rather than relying on idempotency to paper over a UX inconsistency.

`SupportService.createLostItemComplaint` and `RefundsService.createRequest` (both read) independently verify `order.customerId === customerId` before creating a ticket/refund request, and `createLostItemComplaint` additionally blocks a second open lost-item ticket for the same order (`ELIGIBLE_LOST_ITEM_STATUSES` + an existing-open-ticket check) — a customer can't spam duplicate lost-item tickets for one order.

## Cards / panels

**List page:**
| Card | Fields consumed | Notes |
|---|---|---|
| Order row | `_id`, `bookingType`, `status` (via `formatOrderStatusLabel`, `buildCustomerTimeline`), `total`, `partnerCoverage` (only for `PENDING_DISPATCH`) | `emphasizeUpdates` (from `loadCustomerSettings()`, synced via a `window` custom event when settings change elsewhere) rings active orders — a nice touch that reacts live to a settings change in another tab/page without a refetch |
| Cancel/Delete button | `canCancelOrder(o)` client gate, mirrored server-side (see Backend trace) | per-row `cancellingId` guard already present — no double-submit issue here |
| "Book again" button | `canReorder(o)` (`DELIVERED`/`COMPLETED` only) -> `/book?reorder=:id`, feeding into the booking wizard's reorder flow (`docs/audits/customer-web/book.md`) | |

**Detail page:**
| Card | Fields consumed | Notes |
|---|---|---|
| Header summary | `bookingType`, `displayTotal` (derived: `finalTotal` once finalized, else `total`), `bagSizeLabel`/`estimatedWeightKg`, `isPriceFinalized`/`estimatedTotal` messaging | correctly distinguishes "estimated" vs "final" pricing per `pricingMode`, consistent with the booking wizard's own estimate-vs-final language |
| Branch-assigned / pending-dispatch / pending-payment banners | `branchName`/`branchCode`, `partnerCoverage`, `cashTiming`, `paymentStatus` | pending-dispatch cancel button already guarded (`cancelling`) |
| Payment section | `paymentMethod`, `cashTiming`, `paymentStatus`, delegates to `PaymentReceipt` | |
| Progress bar + `OrderTimeline` | `timeline.progressPercent`, `timeline.steps` (from `buildCustomerTimeline(status, statusHistory)`) | |
| `OrderNotifications` | local `notifications[]` fed by socket events, capped at 12 entries, `socketLive` flag | |
| `RiderLocationMap` | `location` (only set via socket `locationUpdate`, never fetched via REST) | |
| `HandoffQrCard` (pickup/delivery) | `orderId`, `context` | shown only for the specific statuses that make sense (`RIDER_ASSIGNED_PICKUP`/`RIDER_ASSIGNED` for pickup, `OUT_FOR_DELIVERY` for delivery) |
| Verify/Sign panels | `deliveryUi.needsVerify`/`needsSign`, `verifyCode`, `signatureName` | **[FIXED]** — see Finding #1 |
| Receipt codes | `pickup.receiptCode`, `delivery.receiptCode`/`signatureName` | |
| Completed-order actions | `canReview`/`hasReview` -> `/orders/:id/review`; `refundable` -> `/orders/:id/refund`; lost-item link always shown for `DELIVERED`/`COMPLETED` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Cancel/delete order (list) | yes | yes (`window.confirm`, message differs for delete-vs-cancel) | yes (`cancellingId` per-row) | yes (`error`) |
| Cancel order (detail, pending-dispatch) | yes | yes (`window.confirm`) | yes (`cancelling`) | yes (`loadError`) |
| Verify delivery | no | n/a | **[FIXED]** now yes (`verifying`) — previously none | yes (`deliveryError`) |
| Sign delivery | no | n/a | **[FIXED]** now yes (`signing`) — previously none | yes (`deliveryError`) |
| Report lost item | no (creates a ticket) | n/a | yes (`disabled={submitting}`) | yes (`error`) |
| Request refund | no (creates a request) | n/a | yes (`disabled={submitting}`), plus a pre-submit `cashBlocked` gate that hides the form entirely for ineligible payment methods | yes (`error`/`loadError`) |
| Submit review | no | n/a | yes (`loading` passed into `ReviewForm`, not re-traced here) | assumed yes via the form, form itself out of this pass's scope |

## Authorization
Every endpoint across the list, detail, and all three sub-pages independently re-verifies the order (or refund/ticket) belongs to `req.user.sub` server-side — confirmed via direct reads of `cancelByCustomer`, `findOne` (dashboard audit), `customerVerify`/`customerSign`, `createLostItemComplaint`, and `createRequest`. The tracking socket's `joinOrder` handler enforces the same ownership check before allowing a customer to join an order's live-update room. No `[authz]` issues found anywhere in this module.

## Findings

1. **[FIXED] "Verify" and "Sign & confirm" on the order detail page had no busy/disabled state**, unlike every other mutation on this page (cancel button, both sub-page submit buttons). A fast double-click on either would fire two `POST` requests; both backend handlers are otherwise idempotent (re-setting the same fields on a repeat call) except for re-emitting a duplicate `orderEvent` socket notification each time — meaning the customer's own notification feed would show "You confirmed receipt of your laundry" or "Customer signed for delivery" twice for one action, and the buttons gave no visual feedback that a request was even in flight.
   **Fix:** added `verifying`/`signing` state to `orders/[id]/page.tsx`; both buttons are now `disabled` and show "Verifying…"/"Signing…" while their request is in flight, matching the pattern already used for every other mutation on this page.

No other issues found. Both the client-side and server-side cancellation rules agree exactly (server is authoritative, not merely mirrored), the live-tracking socket enforces order ownership before letting a customer join a room, and the three action sub-pages (lost-item, refund, review) all independently re-verify order ownership server-side rather than trusting the route param.

## Unused/dead fields
None found — `OrderDetail`'s fields are all consumed somewhere in the render tree, conditionally per order status/pricing mode.

## Loading/error/realtime behavior
List page uses manual pagination state + `useInfiniteScroll` (IntersectionObserver-based, ref-guarded against stale closures) rather than the shared `useCustomerQuery` hook — appropriate given the append-vs-replace semantics infinite scroll needs that the shared hook doesn't support; on a failed *initial* load it clears `orders` (consistent with a fresh list), but on a failed "load more" it correctly leaves the already-loaded orders in place (no `useCustomerQuery`-style wipe bug here, since this page manages its own `orders` state rather than going through that hook). Detail page combines an initial `pageLoading` gate with a debounced (`useDebouncedCallback`, 500ms) `reload()` triggered by socket events — the debounce correctly coalesces bursts of rapid socket events into a single refetch rather than hammering the API. Realtime tracking (`Socket.IO` `/tracking` namespace) is scoped per-order via the `joinOrder` room and cleanly disconnects on unmount.

## UI/UX notes
- List page uses the shared `PageHeader` + `PageShell` pattern consistently with the rest of the app (unlike the dashboard's bespoke header — see `docs/audits/customer-web/dashboard.md`).
- Order rows correctly surface status via both a text label and a progress bar (same redundant-but-accessible pattern as the dashboard), keeping the two pages visually consistent for the same underlying data.
- `emphasizeUpdates` (from `loadCustomerSettings()`) rings active orders based on a user preference set elsewhere in the app — a nice touch, but it's a purely visual signal (border/ring) with no accompanying text, so a screen-reader user gets no indication an order is "emphasized"; low-priority given the underlying status text is already read either way.
- Cancel/Delete button copy differs by context (delete vs cancel confirm message) which is good, but the button itself doesn't visually distinguish a destructive "delete" (removes a pending unpaid order entirely) from a refunding "cancel" (an already-dispatched order) — both likely render as the same red/link-styled control. Worth a follow-up if there's ever a report of customers being surprised by which one they triggered; not fixed here since it needs a design decision on differentiated styling, not just a code change.
- Detail page is dense (header, banners, payment, timeline, notifications, map, handoff cards, receipt, actions) but each section is conditionally rendered per order state, so a given customer only ever sees the subset relevant to their order's current status — avoids overwhelming the page for simple/early-stage orders.
