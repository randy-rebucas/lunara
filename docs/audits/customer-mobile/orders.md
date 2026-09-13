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
| Rider action row (only for `RIDER_VISIBLE_STATUSES`) | "Get help" -> `/support`, "Order details" -> `/orders/:id` | **[FIXED]** relabeled from "Contact rider"/"View map" — see Finding #2 |
| Past order card | `_id`, `status` (cancelled/delivered styling), `bookingType`/`items`, `statusHistory` (last matching cancelled/delivered timestamp), "Reorder" (delivered only) -> `/book?reorder=:id` | |
| "Free pickup" promo banner | — | **[FIXED, removed]** — see Finding #1 |

## Mutations
None — entirely read-only/navigational. Pull-to-refresh re-runs `load()`.

## Authorization
Same already-confirmed `/orders` scoping as `docs/audits/customer-web/dashboard.md`. No `[authz]` issues.

## Findings

1. **[FIXED] The "Free pickup" promo banner was entirely fabricated client-side decoration with no backing logic anywhere in the system, despite presenting itself as a real, trackable reward.** `spendTowardFreePickup` (`orders.tsx`, pre-fix) computed `(sum of all non-cancelled order totals) % 150` — a modulo of lifetime spend against a hardcoded ₱150 constant that appeared nowhere else in the codebase, not in any promotions/coupon config, not in the rewards catalog. A real "free pickup" reward exists (`apps/api/src/modules/rewards/rewards.catalog.ts`, `id: 'free-pickup'`) but is redeemed with loyalty points through the Rewards screen — an entirely separate mechanism. This banner's progress bar and "You're only ₱X away" copy implied the customer was accumulating toward something real; tapping it just opened an ordinary `/book` flow with no discount, no free pickup, nothing.
   **Fix (2026-09-13):** removed the banner outright, along with its derived state (`spendTowardFreePickup`/`freePickupProgress`/`freePickupRemaining`) and now-unused styles. Chose removal over inventing a backing promo system or repointing to the points-based reward, since either of those is a real product decision (new backend threshold-promo work, or a different UX for a different mechanic) — the safe, honest default is to stop showing customers a promise the system can't keep, not to guess at what should replace it.

2. **[FIXED] "Contact rider" and "View map" (shown on orders with a rider actively assigned) didn't do what their labels promised.** "Contact rider" navigated to the generic `/support` screen (no rider-chat feature exists anywhere in customer-mobile). "View map" navigated to `/orders/:id` — the same destination as tapping the card itself — and that screen has no map component at all (customer-web has a `RiderLocationMap` component with no mobile equivalent).
   **Fix (2026-09-13):** relabeled to match their actual destinations — "Contact rider" → "Get help" (still `/support`, now accurately described), "View map" → "Order details" (still `/orders/:id`, now accurately described instead of implying a map that doesn't exist). No new functionality invented; building a real rider-chat feature or a live-tracking map remains a real feature-work decision, not something to fabricate during a fix pass.

## Unused/dead fields
None beyond what's covered in the findings above (the promo banner doesn't consume any *field* per se — it's synthesized entirely from already-used order data via a formula that doesn't correspond to anything real).

## Loading/error/realtime behavior
Uses `DataLoadState` correctly (loading/error/retry all wired, unlike `docs/audits/customer-mobile/home.md`'s pre-fix state). Reloads on the same `useOrderRealtimeStore` tick pattern as the home screen, with the same `.catch(() => {})` at the realtime-triggered call site. Pull-to-refresh correctly scoped with its own `refreshing` boolean.
