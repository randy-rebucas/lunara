# Audit: Customer-mobile — Orders (tabs)

Date: 2026-07-23

## Entry point
- Screen: `apps/customer-mobile/app/(tabs)/orders.tsx` — order list with filter tabs, ongoing/past sections, own realtime-aware fetch
- Component(s): local `OrderStepper` (compact 6-step progress rail), `Card`, `DataLoadState`

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/index.tsx` | order card tap, "View map" action | `order._id` -> `id` route param | yes (by shape — not re-traced here, out of scope for this pass) |
| `/book` (reorder) | "Reorder" button on a delivered past order | `order._id` -> `reorder` param | yes, matches `/book`'s `useLocalSearchParams<{ reorder?: string }>` |
| `/support` | "Contact rider" action | none | see Finding #2 |

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Orders | GET | `/orders` | `{ items: OrderRow[] }` | `OrdersController.findAll` — same endpoint already traced in `docs/audits/customer-web/dashboard.md` |

## Backend trace
Same already-traced `/orders` endpoint, correctly scoped server-side by `req.user.sub`/role. `load()` here **does** wipe `orders` on a fetch error (`setOrders([])` in the catch, `orders.tsx:179`) — unlike `useHomeDashboard`'s hook (`docs/audits/customer-mobile/home.md`), which deliberately preserves stale data on error. Not flagged as a bug here specifically because, unlike the home screen, this screen's `DataLoadState` is rendered with `loading`/`error` and the order sections are separately gated on `!loading && !error`, so clearing `orders` on error doesn't cause a *worse* outcome than what's already shown (the error message replaces the list entirely either way, matching the intent) — but this is an inconsistency worth noting for anyone touching this code later: two sibling screens fetching the same `/orders` endpoint handle a failed refresh differently.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Filter tabs (All/Ongoing/Completed/Cancelled) | local `activeTab` state | |
| Ongoing order card | `_id`, `status`/`statusHistory` (via `buildCustomerTimeline`, `OrderStepper`), `bookingType`, `estimatedWeightKg`/`items` (via `formatItemsSummary`), `scheduledPickupAt`/`scheduledDeliveryAt` | |
| `OrderStepper` | derives a 6-step compact rail from the full timeline, mapping `laundry_received` -> `received_at_shop` as a fallback alias | |
| Rider action row (only for `RIDER_VISIBLE_STATUSES`) | "Contact rider" -> `/support`, "View map" -> `/orders/:id` | **not fixed** — see Finding #2 |
| Past order card | `_id`, `status` (cancelled/delivered styling), `bookingType`/`items`, `statusHistory` (last matching cancelled/delivered timestamp), "Reorder" (delivered only) -> `/book?reorder=:id` | |
| "Free pickup" promo banner (only on the `all` tab, when past orders exist) | `spendTowardFreePickup`/`freePickupProgress`/`freePickupRemaining` — all purely client-computed | **not fixed** — see Finding #1 |

## Mutations
None — entirely read-only/navigational. Pull-to-refresh re-runs `load()`.

## Authorization
Same already-confirmed `/orders` scoping as `docs/audits/customer-web/dashboard.md`. No `[authz]` issues.

## Findings

1. **The "Free pickup" promo banner is entirely fabricated client-side decoration with no backing logic anywhere in the system, despite presenting itself as a real, trackable reward.** `spendTowardFreePickup` (`orders.tsx:217-220`) computes `(sum of all non-cancelled order totals) % 150` — a modulo of lifetime spend against a hardcoded ₱150 constant that appears nowhere else in the codebase, not in any promotions/coupon config, not in the rewards catalog. A real "free pickup" reward *does* exist (`apps/api/src/modules/rewards/rewards.catalog.ts`, `id: 'free-pickup'`), but it's redeemed with loyalty **points** through the Rewards screen — an entirely separate, correctly-implemented mechanism. This banner's progress bar and "You're only ₱X away" copy imply the customer is accumulating toward something real; tapping it just calls `router.push('/book')` with **no params at all** — confirmed by checking `/book`'s `useLocalSearchParams` that it does accept a `code` param for pre-filling a coupon (used correctly elsewhere, e.g. `DealsCarousel`'s deal-press handler), which this banner doesn't pass. A customer who reaches "₱150 / ₱150" and taps through gets a completely ordinary booking flow with no discount, no free pickup, nothing — the banner cannot ever actually deliver on its promise.
   **Left unfixed** — this needs a product decision: either wire the banner to a real, backend-tracked spend-threshold promo (which doesn't currently exist and would need new backend work — a new coupon/threshold system, not a client tweak), point it at the existing points-based `free-pickup` reward instead (different mechanic, different copy needed), or remove the banner. None of these is a safe code-only fix within an audit pass — implementing fake functionality for real would be inventing product behavior, and removing a customer-facing promotional feature outright is itself a product call.

2. **"Contact rider" and "View map" (shown on orders with a rider actively assigned) don't do what their labels promise.** "Contact rider" navigates to the generic `/support` screen (confirmed it accepts no route params to pre-select this order or open a rider-specific channel — there is no rider-chat feature anywhere in customer-mobile, confirmed via a repo-wide search for chat/conversation screens). "View map" navigates to `/orders/:id` — the same destination as tapping the card itself — and that screen has no map component at all (confirmed via search: the only `MapView`/`react-native-maps` usage in the entire app is an address-picker modal, unrelated to live rider tracking; customer-web has a `RiderLocationMap` component with no mobile equivalent). Both buttons are misleading about the destination/functionality they offer.
   **Left unfixed** — same reasoning as Finding #1: the honest fixes are either building real functionality (a support-ticket deep link with order context pre-filled, and/or a live rider-location map — both real feature work, not audit-scope fixes) or relabeling the buttons to something accurate ("Get help" / "Order details"), which is a product-copy decision, not something to silently rewrite during an audit pass.

## Unused/dead fields
None beyond what's covered in the findings above (the promo banner doesn't consume any *field* per se — it's synthesized entirely from already-used order data via a formula that doesn't correspond to anything real).

## Loading/error/realtime behavior
Uses `DataLoadState` correctly (loading/error/retry all wired, unlike `docs/audits/customer-mobile/home.md`'s pre-fix state). Reloads on the same `useOrderRealtimeStore` tick pattern as the home screen, with the same `.catch(() => {})` at the realtime-triggered call site. Pull-to-refresh correctly scoped with its own `refreshing` boolean.
