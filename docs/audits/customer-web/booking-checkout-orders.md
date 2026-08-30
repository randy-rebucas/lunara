# Audit: Customer-Web — Booking & Checkout

Date: 2026-08-30

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/book/page.tsx`
- Component(s): `apps/customer-web/src/components/booking/booking-wizard.tsx`, using
  `apps/customer-web/src/hooks/use-booking-quote.ts`,
  `apps/customer-web/src/components/booking/branch-picker-modal.tsx`,
  `apps/customer-web/src/components/booking/pickup-schedule-picker.tsx`,
  `apps/customer-web/src/components/booking/promo-code-field.tsx`,
  `apps/customer-web/src/components/booking/quote-breakdown.tsx`.

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `checkout/[orderId]/page.tsx` | `router.push` after `createOrder()`, `booking-wizard.tsx:466`; also `orders/page.tsx:221` (pending orders) and `orders/[id]/page.tsx:546` | `res.data._id` → `orderId` route param | yes — `PaymentCheckout` fetches `/payments/orders/{orderId}` |
| `checkout/[orderId]/success/page.tsx` | `window.location.href` in `payment-checkout.tsx:85/141/146` | `paymentId` query param | yes — fetches `/payments/{paymentId}` |
| `orders/page.tsx` | `PageHeader backHref` on checkout page; `ButtonLink` on success page | none (list) | yes |
| `orders/[id]/page.tsx` | `orders/page.tsx:235` row link, `checkout/[orderId]/success/page.tsx:88` "Track order" | `order._id` → `id` route param | yes — fetches `/orders/{id}`, `/orders/{id}/delivery`, `/reviews/orders/{id}` |
| `orders/[id]/lost-item/page.tsx`, `orders/[id]/refund/page.tsx`, `orders/[id]/review/page.tsx` | buttons on `orders/[id]/page.tsx` (lines 792/796/776) | `id` route param | thin detail forms, not traced in depth — out of the booking/checkout/tracking core scope |

**checkout/[orderId]**: fetches only `order` (`_id`, `status`, `total`, `bookingType`) and
`payment` via `/payments/orders/{orderId}` — a narrower shape than the booking wizard's quote
breakdown, appropriately re-fetched since the wizard's local quote state doesn't survive
navigation. Own loading/error state (`loading`, `error`), no realtime.

**checkout/[orderId]/success**: fetches the specific payment by id, calls
`/payments/{paymentId}/sync` first to reconcile PayMongo status before reading it. No realtime;
one-shot load.

**orders/[id]**: fetches order detail (customer-scoped fields), delivery UI state, and review
eligibility in parallel-ish sequence, then opens a socket to `/tracking` and joins
`order:{id}`. Findings specific to this page are folded into Findings below (dead
fields, socket scoping).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Booking config | GET | `/booking/config` | `BookingConfig` | `BookingController.getConfig` → `BookingService.getConfig` |
| Addresses | GET | `/addresses` | `AddressOption[]` | `AddressesController` (not re-traced; out of module scope) |
| Favorites | GET/POST/DELETE | `/favorites`, `/favorites/{branchId}` | `{branchId}[]` | favorites module (not re-traced) |
| Reorder source order | GET | `/orders/{reorderOrderId}` | `ReorderSourceOrder` | `OrdersController.findOne` → `OrdersService.findOne` |
| Availability | GET | `/booking/availability?addressId=` | inline type in `booking-wizard.tsx:317` | `BookingController.getAvailability` → `BookingService.getAvailability` |
| Shop options | GET | `/booking/shops?addressId=` | `ShopOption[]` | `BookingController.getShops` → `BookingService.getShopOptions` |
| Server quote | POST | `/booking/quote?addressId=` | `MultiServiceQuoteBreakdown` | `BookingController.quote` → `BookingService.quote` |
| Create order | POST | `/booking/orders` | `{ _id, total }` | `BookingController.createOrder` → `BookingService.prepareOrderPayload` + `OrdersService.createFromBooking` |
| Checkout order+payment | GET | `/payments/orders/{orderId}` | `{ order: CheckoutOrder, payment: CheckoutPayment \| null }` | `PaymentsController.getForOrder` → `PaymentsService.getForOrder` |
| Delete unpaid/cancel order | DELETE | `/orders/{orderId}` | — | `OrdersController.cancel` → `OrdersService.cancelByCustomer` |
| Payment intent | POST | `/payments/intent` | inline | `PaymentsController.createIntent` → `PaymentsService.createIntent` |
| Payment sync | POST | `/payments/{paymentId}/sync` | — | `PaymentsController` `:id/sync` → `PaymentsService.syncPayment` |
| Payment receipt | GET | `/payments/{paymentId}` | `{ payment, order }` | `PaymentsController` `:id` → `PaymentsService.getById` |
| Orders list | GET | `/orders?page=&limit=&status=` | `OrdersPageData` | `OrdersController.findAll` → `OrdersService.findAll` |
| Order detail | GET | `/orders/{id}` | `OrderDetail` | `OrdersController.findOne` → `OrdersService.findOne` |
| Delivery UI state | GET | `/orders/{id}/delivery` | `DeliveryUiState` | `OrdersController.getDeliveryStatus` → `DeliveryService.getCustomerDeliveryStatus` |
| Review eligibility | GET | `/reviews/orders/{id}` | inline | reviews module (not re-traced) |
| Cancel/reschedule/subscribe | DELETE/PATCH/POST | `/orders/{id}`, `/orders/{id}/reschedule`, `/subscriptions` | — | `OrdersService.cancelByCustomer`/`rescheduleByCustomer`, subscriptions module |
| Tracking socket | WS | `/tracking` namespace, events `joinOrder`/`joinCustomer`/`orderStatusUpdate`/`orderEvent`/`locationUpdate` | — | `TrackingGateway` |

## Backend trace
`BookingService.getAvailability`/`getShopOptions` resolve partner coverage and nearby branches for
the chosen address, applying operating hours/holidays and capacity/radius filters. `quote` and
`prepareOrderPayload` re-derive pricing server-side from the branch's live rates (not trusting the
client's local preview), snapshot pricing mode/rates into `pricingSnapshot`, and compute
`baseSubtotal`/`pricingModel` for partner payout math — these payout-side fields are never sent to
the customer (see Authorization).

`OrdersService.createFromBooking` persists the order with `status: PENDING` and records a promo
redemption if a coupon was used. `OrdersService.findAll`/`findOne` scope by `customerId` for the
`CUSTOMER` role and run results through `enrichCustomerOrders` → `enrichOrderWithPayment`, which
builds an explicit customer-safe field whitelist (not a raw document spread) and merges in a
payment summary via `buildOrderPaymentSummary` (payments module), stripping `cashCollectedBy`.
`findOne` additionally resolves destination lat/lng and rider name/phone, gated to the phases where
a rider is actually assigned/en route.

`TrackingGateway.handleJoinOrder` verifies a `CUSTOMER` caller owns the order (`resolveCustomerId`
against `order.customerId`) before allowing the socket to join `order:{orderId}`; `joinCustomer`
joins a `customer:{sub}` room scoped to the caller's own id. Location updates are only emitted by a
verified `RIDER` whose `data.riderId` matches their own JWT subject.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Address list (book, step `address`) | `addresses[].label/addressType/line1/city/province/postalCode`, coord presence | GPS-pin warning is client-derived from lat/lng presence, `booking-wizard.tsx:668-676` |
| Partner coverage notice | `partnerCoverage` (from `/booking/availability`) | shown only when `coverageAddressId === form.addressId` |
| Shop cards (step `shop`) | `shopOptions[].{name,city,distanceLabel,logoUrl,operatingHours,holidays,services,branches,withinRadius,withinMaxDeliveryRadius,capacityAvailable}` | "starting price" is client-computed per-service-unit cheapest candidate; distance hint gated by a client-only settings flag (`loadCustomerSettings().showBranchDistanceHints`) |
| Branch picker modal | `branches[].{name,city,distanceLabel,operatingHours,holidays,capacityAvailable,withinMaxDeliveryRadius}` | disables branches at capacity or outside delivery radius, computed client-side from booleans the backend already resolved |
| Service list (step `service`) | `services[].{label,description,pricingUnit,basePricePerX,pricePerKg,minWeightKg}` + `availableServices` | disabled-in-area badge is `availableServices.includes(type)` client check |
| Weight/bag/garment/piece steps | `config.bagSizes`, `selectedShop.garmentCatalog`, `serviceQuotes[idx]` | local quote preview computed entirely client-side via `calculateQuote`/`combineServiceQuotes` (shared with the server calc) |
| Add-ons step | `addons[].{label,price,pricingUnit,isPercentOfService,allowsQuantity,maxQuantity,includedQuantity,imageUrl}` | `EXPRESS_RETURN_ADDON_ID` gating (`isExpressReturnAllowed`) is a hardcoded id/time-cutoff match, not backend-driven |
| Review step | `PromoCodeField` (coupon input/apply/remove), `QuoteBreakdownPanel` (server `quote` fields) | promo apply/remove both trigger a full server quote refresh |
| Confirm step | `activeQuote.{services,addons,couponCode,discount,total,deliveryFee,isEstimate}`, `selectedAddress`, `selectedBranch.name` | delivery-fee explainer only renders when all three of `deliveryDistanceKm/deliveryBaseDistanceKm/deliveryPerKmRate` are present on `services[0]` |
| Checkout order summary | `order.{bookingType,total,status}`, `existingPayment.receiptCode/status` | — |
| Checkout payment method picker | `CUSTOMER_PAYMENT_OPTIONS` (shared const), `walletBalance` | wallet insufficient-balance check is client-side |
| Payment success/receipt | `payment.{status,method,amount,receiptCode,cashTiming,paidAt}`, `orderTotal` | — |
| Order list card | `o.{status,total,bookingType,createdAt,branchId,branchName,partnerCoverage}` | progress % / step label via shared `buildCustomerTimeline`; cancel/reorder eligibility computed client-side from `status` |
| Order detail header | `order.{bookingType,total,pricingMode,finalTotal,estimatedTotal,bagSizeLabel,estimatedWeightKg,scheduledPickupAt}` | "estimated vs finalized" display logic duplicated from the pattern documented in the schema comment |
| Order detail — "Your instructions" | `order.customerNotes` | **was always empty before this audit's fix — see Finding 1** |
| Order detail — assigned branch | `order.branchName`, `order.branchCode` | — |
| Order detail — recurring pickup prompt | `order.{bookingType,bagSizeId,garmentSelections,estimatedWeightKg,estimatedLoadCount,estimatedPieceCount,branchId,addons,pickupAddressId,scheduledPickupAt}` | **`estimatedLoadCount`/`estimatedPieceCount` were always undefined before this audit's fix — see Finding 1**, so subscribing a PER_LOAD/PER_PIECE order dropped its quantity input |
| Order detail — payment/receipt | `order.{paymentMethod,paymentStatus,paymentAmount,paymentReceiptCode,cashTiming,paymentPaidAt}` | print-receipt view duplicates the same fields for `@media print` |
| Order detail — rider contact | `order.riderName`, `order.riderPhone` | phone only ever present when `showRiderContact` gates it server-side (see Backend trace) |
| Order detail — rider map | `location` (socket `locationUpdate`), `order.destinationLat/Lng` | dynamic-imported, `ssr:false` |
| Order detail — timeline | `order.status`, `order.statusHistory` | shared `buildCustomerTimeline` |
| Order detail — handoff QR | route param `id`, `context` | `HandoffQrCard` (not re-traced, calls `/orders/{id}/handoff-qr`) |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Create booking order (`createOrder`) | no (creates a PENDING order) | n/a | yes — `creatingOrderRef` guard, `booking-wizard.tsx:449-451` | yes — `setError`, re-enables `creatingOrderRef` on failure |
| Apply/remove promo code | no | n/a | yes — `promoLoading` disables the button | yes — `setError` from `applyPromoCode`/`removePromoCode` |
| Toggle favorite branch | no | n/a | optimistic update, reverted on failure — no explicit in-flight lock, but idempotent (toggle) so a fast double-click just flips twice | silently reverts on failure, no visible error message (minor — not flagged as a finding, low impact) |
| Pay for order (`handlePay`) | no | n/a | yes — `payingRef` guard, `payment-checkout.tsx:122-124` | yes — `setError` |
| Delete unpaid order (checkout page) | yes | yes — `window.confirm` | yes — `deleting` disables both buttons | yes |
| Cancel/delete order (orders list) | yes | yes — `window.confirm`, message varies by status | yes — `cancellingId` guard | yes |
| Cancel pending-dispatch order (order detail) | yes | yes — `window.confirm` | yes — `cancelling` disables button | yes |
| Reschedule pickup | no | implicit (modal confirm) | handled inside `RescheduleOrderModal` (not re-traced) | assumed yes, not verified in this pass |
| Subscribe to recurring pickup | no | no explicit confirm (opt-in banner with Subscribe/No-thanks) | yes — `subscribing` disables button | yes — `setSubscribeError` |
| Delivery verify/sign | no | n/a | yes — `verifying`/`signing` guards | yes — `setDeliveryError` |

## Authorization
No `[authz]` issues found. All customer-facing booking/checkout/order endpoints scope by the
authenticated customer's id, not by a client-supplied id:
- `BookingController` routes use `req.user.sub` for availability/shops/quote/create — a customer
  cannot pass another customer's context to affect pricing or dispatch (branchId/addressId are
  resolved server-side against real branch/address records, not blindly trusted).
- `OrdersService.findOne`/`findAll`/`cancelByCustomer`/`rescheduleByCustomer` all check
  `order.customerId.toString() !== user.sub` before returning/mutating (`orders.service.ts:355,
  442, 616`). Guessing another customer's order id returns 403/404, not data.
- `PaymentsService.getForOrder`/`getById` both check the order's/payment's owning `userId` against
  the caller (`payments.service.ts:105, 142`).
- `TrackingGateway.handleJoinOrder` (`tracking.gateway.ts:95-100`) verifies a `CUSTOMER` socket
  client owns the order before letting it join the `order:{orderId}` room — a customer cannot
  eavesdrop on another customer's order tracking events by guessing an id. `joinCustomer` scopes to
  the caller's own `customer:{sub}` room.
- `TrackingGateway.handleRiderLocation` rejects a rider trying to emit location as a different
  `riderId` than their own JWT subject (`tracking.gateway.ts:136-139`).

## Findings
1. **Two fields the order-detail UI reads were never sent by the backend to the customer.**
   `OrdersService.enrichOrderWithPayment`'s customer-safe whitelist
   (`apps/api/src/modules/orders/orders.service.ts:164-205`, pre-fix) included
   `estimatedWeightKg` but omitted `estimatedLoadCount`, `estimatedPieceCount`, and
   `customerNotes` — all three of which the frontend reads: `customer-web`'s
   `orders/[id]/page.tsx:49` (`customerNotes`) renders a "Your instructions" panel at line 459-464
   that was silently always empty for every order, even when the customer had typed pickup
   instructions at booking; `orders/[id]/page.tsx:46-47` (`estimatedLoadCount`/`estimatedPieceCount`)
   feed `handleSubscribe` (line 290-323) when setting up a recurring pickup — for a PER_LOAD or
   PER_PIECE priced order, the resulting `/subscriptions` POST always omitted
   `enteredLoadCount`/`enteredPieceCount`, so the recurring-pickup quote silently fell back to
   whatever default the subscriptions quote engine uses instead of the customer's actual order size.
   **Fix:** added `estimatedLoadCount`, `estimatedPieceCount`, `customerNotes` to the customer-safe
   whitelist in `apps/api/src/modules/orders/orders.service.ts:170-173`. These three fields flow
   through both `findAll` (order list) and `findOne` (order detail) via the shared
   `enrichCustomerOrders`/`enrichOrderWithPayment` path — the order list's `OrderSummary` type
   doesn't read them so this is a no-op there, and `findOne`'s customer branch is the only other
   consumer (verified via grep — no other module calls `enrichOrderWithPayment`). `apps/api`
   `tsc --noEmit` passes clean after the change.

2. Toggle-favorite-branch has no explicit in-flight double-submit guard (relies on the toggle being
   naturally idempotent) and swallows failures with a silent revert instead of a visible error
   (`booking-wizard.tsx:162-184`). Low impact — a failed favorite toggle just reverts the heart icon
   with no user-facing message. **Fix:** left unfixed — cosmetic, out of scope relative to the
   higher-value finding above; a toast/inline error here would be a reasonable follow-up but isn't a
   correctness or safety issue.

No `[authz]` findings, no sensitive-data-exposure findings beyond the dead-field bug in Finding 1
(which is under-exposure, not over-exposure — the opposite of the usual PII-leak class this audit
looks for).

## Unused/dead fields
- `ReorderSourceOrder` (used to prefill "book again") is fetched via the same `/orders/{id}`
  customer-safe payload — no dead fields observed there beyond what's covered in Finding 1.
- `BookingConfig`/`ShopOption`/quote breakdown payloads: no fields observed fetched-and-unused in
  this pass: every field traced in Cards/panels above maps to a render or a client-side calculation
  input.

## Loading/error/realtime behavior
Booking wizard: `configLoading` gates the whole wizard; address/shop/availability fetches each have
their own error state (`addressesError`, per-step `error`) and don't wipe already-loaded state on a
transient failure (e.g. a failed availability reload keeps the previously loaded `shopOptions`
stale until the next successful load, which is acceptable since the address selection itself
changed). Checkout and order-detail pages use a shared `loading`/`error` local-state pattern (no
common `useAsyncQuery`-style hook was found for this module — each page rolls its own `useState`
trio), consistent with the pattern also seen in `orders/page.tsx`.

Order-detail page's socket (`orders/[id]/page.tsx:241-274`) joins `order:{id}` on mount and listens
for `orderStatusUpdate`/`orderEvent`/`locationUpdate`; on any status/event message it both applies
an optimistic local patch and schedules a debounced (`500ms`) full reload via `scheduleReload`, so a
burst of events collapses into a single re-fetch rather than one per event. `CustomerTrackingSync`
(mounted at the app-shell level, `customer-tracking-sync.tsx`) independently joins the caller's
`customer:{sub}` room plus every currently-active order room (from `/orders?limit=50`, filtered by
`isActiveOrderStatus`) so the customer receives a badge-bump notification for order updates even
while not on the order-detail page — it re-joins on `visibilitychange` back to visible rather than
polling, and doesn't re-fetch order data itself (only dispatches a `lunara-notifications-bump`
DOM event), so no redundant fetch/socket duplication was found between it and the order-detail
page's own socket.
