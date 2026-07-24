# Audit: Customer-web — Book (booking wizard)

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/book/page.tsx` (`'use client'`) — thin wrapper, delegates entirely to:
- Component(s): `components/booking/booking-wizard.tsx` (`BookingWizard`, 1534 lines — treated as its own deep module per audit scope, not a thin page), plus `pickup-schedule-picker.tsx`, `promo-code-field.tsx`, `quote-breakdown.tsx`

## Sub-pages
None as detail routes. On order creation, `createOrder()` navigates to `/checkout/[orderId]` (a separate module, not yet audited) with the newly created order's real `_id`. `?code=` and `?reorder=` query params drive initial state (coupon prefill, "book again" prefill from a past order) rather than being sub-page navigation.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Booking config | GET | `/booking/config` | `BookingConfig` | `BookingController.getConfig` -> `BookingService.getConfig` |
| Addresses | GET | `/addresses` | `AddressOption[]` | `AddressesController.findAll` (already traced in `docs/audits/customer-web/profile.md`) |
| Reorder source | GET | `/orders/:reorderOrderId` | `ReorderSourceOrder` | `OrdersController.findOne` |
| Availability (per address) | GET | `/booking/availability?addressId=` | area/services/slots/holidays/coverage | `BookingController.getAvailability` -> `BookingService.getAvailability` |
| Nearby shops (per address) | GET | `/booking/shops?addressId=` | `ShopOption[]` | `BookingController.getShops` -> `BookingService.getShopOptions` |
| Live quote | POST | `/booking/quote?addressId=` | `QuoteBreakdown` | `BookingController.quote` -> `BookingService.quote` |
| Create order | POST | `/booking/orders` | `{ _id: string; total: number }` | `BookingController.createOrder` -> `BookingService.prepareOrderPayload` (+ order creation) |

## Backend trace
The critical mutation-safety property for a checkout flow — **price is never trusted from the client** — holds throughout: `CreateBookingOrderDto`/`BookingQuoteDto` carry only selection inputs (`bookingType`, `branchId`, `bagSizeId`, entered weight/load/piece counts, `addonIds`, `couponCode`, `scheduledPickupAt`) and no `total`/`price` field at all. `prepareOrderPayload` (`booking.service.ts:319-417`) always re-derives the quote server-side via `buildQuote`, re-validates the pickup slot is still bookable against the *resolved* branch's actual operating hours/holidays (not just whatever the client displayed), and computes partner payout splits (`serviceBaseSubtotal`, `baseAddonsSum` reversing `SHOP_PRICE_MARKUP_MULTIPLIER`) from the branch's own `commissionRate`/`servicePricing`, not anything the frontend sent.

`validateAddressForUser` (`booking.service.ts:71-115`) scopes the address lookup to `userId` via `addressesService.findAll(userId)` — a customer cannot probe availability/quote/order-create for an address id that isn't theirs; it 404s. All four `BookingController` routes this page hits are `@Roles(UserRole.CUSTOMER)`-gated.

`getShopOptions`/`getAvailability` correctly gate coverage on `nearestWithinRadius`/curated-area matching before returning shop lists — confirmed via the address-scoping trace above, no additional cross-tenant surface introduced by the shop/quote endpoints since they take the already-validated address as their only identity input.

## Cards / panels (by step)
| Step | Fields consumed | Notes |
|---|---|---|
| Address | `addresses[]` (`_id`, `label`, `line1/city/province/postalCode`); `dispatchNote`, `activePartnerCoverage` once resolved | **[FIXED]** — see Finding #1 for the silently-swallowed fetch error |
| Shop | `shopOptions[]` (`branchId`, `name`, `city`, `distanceLabel`, `withinRadius`, `capacityAvailable`, `operatingHours`/`holidays` via `getTodayScheduleSummary`, per-service pricing for the "from ₱X" label); "Let Lunara pick" auto-dispatch option | cheapest-service computation correctly handles mixed per-service pricing units within one shop (per-kg/per-load/per-piece/flat-bag), not assuming one shop-wide unit — confirmed correct, matches the comment explaining why |
| Service | `services[]` derived from `selectedShop.services` or the flat `config.services` catalog; `availableServices` (area gate) | shop-specific label/description override the catalog's when present |
| Schedule | `slots[]`, `holidays[]`, `areaLabel` (delegated to `PickupSchedulePicker`, not separately re-traced) | |
| Weight (4 variants by `shopPricingMode`) | `form.enteredWeightKg`/`enteredLoadCount`/`enteredPieceCount`, `localQuote.serviceSubtotal` for the running estimate | per-load variant auto-derives load count from weight via `estimateMachineLoads` but still lets the customer's entered value stand even past the slider's visual cap (comment explains this is intentional) |
| Add-ons | `addons[]` (shop-specific or catalog fallback), per-addon pricing unit suffix; conditional piece-count input only shown when a selected addon is priced per-piece | |
| Review | `activeQuote` (server-refreshed via `refreshServerQuote` on entering this step), `PromoCodeField` | promo apply/remove both re-fetch the server quote rather than compute the discount client-side — correct, since discount eligibility/amount must be server-authoritative |
| Confirm | `activeQuote` full breakdown, `selectedShop`/`selectedAddress`/`selectedSlot` summary rows | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Apply/remove promo code | no | n/a | yes (`disabled={loading \|\| !value.trim()}` / `disabled={loading}`) | yes (`error`) |
| Advance step (`goNext`) | no | n/a | yes (`stepping`-gated, button shows "Saving…") | yes (`error`, with step-specific messages) |
| Create order (`createOrder`) | no (creates a PENDING order, not a charge) | n/a — appropriate, since this only creates an order awaiting checkout/payment, not a charge | yes — **stronger than most pages in this series**: uses a synchronous `creatingOrderRef` ref-guard (`if (creatingOrderRef.current) return;`) in addition to the `loading`-disabled button, closing the double-click race a state-only guard can miss between the click and the first re-render | yes (`error`); ref is reset in the `catch` so a failed attempt can be retried |

## Authorization
Every endpoint this flow touches is `@Roles(UserRole.CUSTOMER)`-gated and additionally scopes the address/order lookups to `req.user.sub` (see Backend trace). No `[authz]` issues found.

## Findings

1. **[FIXED] The initial addresses fetch silently swallowed any error** (`booking-wizard.tsx`, the mount `useEffect`'s second `api.get('/addresses')` had `.catch(() => {})`), so a network blip or transient API failure showed the same "No addresses saved. Add an address" message as a customer who genuinely has zero saved addresses — actively misleading, since the fix for the former (retry) is different from the fix for the latter (go add one), and the wrong message could send a customer with saved addresses off to `/onboarding/address` unnecessarily on every retry, when their actual issue was a failed fetch.
   **Fix:** added `addressesError` state, populated from the catch; the address step now renders that error message instead of the "no addresses" empty state whenever the fetch genuinely failed, using the same red-text `WizardError`-style presentation already used elsewhere on this page for consistency.

2. **[FIXED] The shop step's "from ₱X" distance label (`shop.distanceLabel`) was always shown, ignoring the "Partner distance hints" toggle in Settings** — found while auditing `docs/audits/customer-web/settings.md`, whose `showBranchDistanceHints` setting had no consumer anywhere in the codebase (a fully dead toggle: a customer could switch it off, see "Saved", and see zero effect).
   **Fix:** `booking-wizard.tsx` now reads `loadCustomerSettings().showBranchDistanceHints` (synced live via the same `lunara-customer-settings` window event `orders/page.tsx` already uses for `emphasizeOrderUpdates`) and only appends `· {shop.distanceLabel}` to the shop card when the setting is on. See `docs/audits/customer-web/settings.md` for the full finding.

No other issues found. Notably strong points confirmed during this trace, worth calling out rather than treating as neutral: price is fully server-derived with no client-trusted total at any step (including the final order-creation call); the double-submit guard on order creation uses a synchronous ref rather than relying solely on React state, closing a race that state-only guards elsewhere in this series don't fully close; and the "book again" reorder flow correctly re-validates that the prefilled address and branch are still valid/available before letting the customer skip past those steps, rather than blindly trusting stale data from the source order.

## Unused/dead fields
None found in the traced payloads — `/booking/config`, `/booking/availability`, `/booking/shops`, and `QuoteBreakdown` fields are all consumed by some step or another (pricing-mode-conditional rendering means not every field is used on every render, but each has a real consumer).

## Loading/error/realtime behavior
Each async operation (config, addresses, availability, shops, quote, order creation) manages its own loading/error state independently rather than through a shared hook — appropriate given the wizard's step-based, non-list-like data shape. `configLoading` blocks the whole wizard until the catalog loads; per-step loading (`shopsLoading`, `stepping`, `promoLoading`, `loading`) is scoped narrowly to what's actually in flight. No polling or realtime subscription — availability/shop data is fetched once per address selection and not kept fresh via any interval, which is appropriate for a booking session's timeframe.
