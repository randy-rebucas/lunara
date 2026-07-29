# Delivery Pricing & Long-Distance Approval

How the pickup + delivery fee is calculated, and what happens when a customer's address is far
from the shop handling their order. Two related but separate mechanics:

1. **Delivery fee formula** — distance-tiered pricing, replacing the old flat ₱70.
2. **Manual delivery approval** — a platform-wide distance ceiling that holds far-out orders for
   admin sign-off instead of blocking them outright.

---

## 1. Delivery fee formula

```
Delivery Fee = Base Fee + (Chargeable Distance × Per-km Rate)

Chargeable Distance = max(0, ceil(distance_km − Base Distance))
```

Defaults (all admin-tunable — see [Admin settings](#admin-settings) below):

| Setting | Default |
|---|---|
| Base fee | ₱70 |
| Base distance | 3 km |
| Per-km rate | ₱8 |

Distance is the haversine straight-line distance between the customer's pickup address and the
assigned shop's coordinates, rounded up to the next whole km before billing (so 3.2 km beyond the
base allowance bills as 4 km).

### Example table (defaults)

| Distance | Delivery Fee |
|---|---:|
| 0–3 km | ₱70 |
| 4 km | ₱78 |
| 5 km | ₱86 |
| 8 km | ₱110 |
| 11 km | ₱134 |
| 14 km | ₱158 |
| 15 km | ₱166 |

One fee covers both legs — pickup and return delivery are not billed separately.

### Where it's computed

- Formula: `calculateDeliveryFee()` in [`packages/utils/src/booking.ts`](../packages/utils/src/booking.ts) — pure function, takes `(distanceKm, baseFee, baseDistanceKm, perKmRate)`.
- Live settings lookup: `SettingsService.getDeliveryFeeForAddress(address, distanceKm)` in [`apps/api/src/modules/settings/settings.service.ts`](../apps/api/src/modules/settings/settings.service.ts) — reads the tunable values from `PlatformSettings` and applies the formula. Called with `distanceKm` omitted, it returns the flat base fee only (used for early, pre-shop-selection previews where no distance is known yet).
- Called from `BookingService.buildQuote()` in [`apps/api/src/modules/booking/booking.service.ts`](../apps/api/src/modules/booking/booking.service.ts), using the pickup↔shop distance already computed there for the service-radius check.

### What didn't change

The legacy flat-fee constant (`BOOKING_FLAT_DELIVERY_FEE`, still ₱70) remains as the fallback used
by client-side quote previews (`calculateQuote()`) shown before an address/shop is picked, when no
real distance exists yet. The actual charged fee is always the server-computed tiered amount, set
once a shop is resolved.

---

## 2. Manual delivery approval

Every partner branch has its own `serviceRadiusKm` — orders outside it were always rejected at
checkout ("Selected shop does not deliver to this address"). That's still true beyond a platform
ceiling, but there's now a middle tier:

| Distance from customer to assigned shop | Result |
|---|---|
| ≤ shop's own `serviceRadiusKm` | Normal checkout — auto-dispatches as usual |
| > shop's radius, ≤ platform `maxDeliveryRadiusKm` (default **15 km**) | Order is accepted, but held for **admin approval** before dispatch |
| > platform `maxDeliveryRadiusKm` | Checkout blocked — "exceeds the Xkm delivery limit" |

### Why

Some addresses sit just outside a shop's configured radius but are still reasonably deliverable —
rejecting them loses the order. Auto-dispatching them without a human check risks assigning a rider
a trip the shop didn't really sign up for. The approval step is the compromise: the order isn't
lost, but it doesn't move until someone at Lunara looks at it.

### Order flow when a delivery is flagged

1. **Checkout** ([`booking.service.ts`](../apps/api/src/modules/booking/booking.service.ts)) — computes distance, compares against both radii, sets `requiresDeliveryApproval` on the quote/order payload alongside `deliveryDistanceKm`.
2. **Payment confirmed** ([`payments.service.ts`](../apps/api/src/modules/payments/payments.service.ts) `confirmOrder`) — if `requiresDeliveryApproval` is true, the order is **not** auto-dispatched to the shop. It stays in `PENDING`, a note is added to `statusHistory`, and an admin dispatcher alert fires (`emitAdminDispatcherAlert`).
3. **Admin reviews** — via the Orders board in admin-web, or `GET /admin/dispatch/delivery-approvals` (lists all orders currently awaiting approval).
4. **Admin approves** — `POST /admin/dispatch/orders/:orderId/approve-delivery` (`AdminService.approveDeliveryDistance`). This clears the flag, stamps `deliveryApprovedAt`/`deliveryApprovedBy`, and finalizes the shop assignment (same path a normal order takes), which then proceeds through dispatch as usual.

There's no reject path — the only way out of the approval-pending state today is to approve it.
Cancelling the order (existing cancel flow) is the escape hatch if a distance turns out to be
undeliverable.

### Data model

New fields on `Order` ([`order.schema.ts`](../apps/api/src/modules/orders/schemas/order.schema.ts)):

| Field | Meaning |
|---|---|
| `deliveryDistanceKm` | Pickup-to-shop distance computed at checkout |
| `requiresDeliveryApproval` | `true` while dispatch is held pending admin sign-off |
| `deliveryApprovedAt` | Timestamp of admin approval |
| `deliveryApprovedBy` | Admin user id who approved it |

### Admin settings

`/settings` → Operations tab → **Order pricing** card exposes all four tunables:

| Field | Backing setting | Default |
|---|---|---|
| Base delivery fee | `deliveryFee` | ₱70 |
| Base distance | `deliveryBaseDistanceKm` | 3 km |
| Per-km rate | `deliveryPerKmRate` | ₱8/km |
| Max delivery radius | `maxDeliveryRadiusKm` | 15 km |

Backed by `PlatformSettings` (singleton doc, `platform_settings` collection) via
`GET/PATCH /admin/settings/delivery-fee`.

### Admin-web UI

In the Orders board ([`orders-board.tsx`](../apps/admin-web/src/components/datacenter/orders-board.tsx)):

- Flagged orders show a **"Needs approval"** badge (row list and detail rail), with the computed distance in the tooltip.
- Selecting a flagged order shows a **"Delivery approval"** section in the detail rail with an **"Approve delivery & dispatch"** button.

There's currently no dedicated "pending approval" queue/tab — an admin finds flagged orders via the
badge while browsing, or by hitting `GET /admin/dispatch/delivery-approvals` directly. A dedicated
tab (mirroring the existing dispatch queue) is a reasonable follow-up if approval volume grows.

---

## Explicitly out of scope

Not part of this change — flagged here so it isn't assumed to already exist:

- **Dynamic surcharges** (rain, holidays, express requests, oversized loads). Express-return exists
  today only as a flat, always-priced add-on (`EXPRESS_RETURN_ADDON_ID`), unrelated to distance or
  weather. No rain/holiday pricing logic exists anywhere in the codebase.
- **Reject / re-route** action for approval-pending orders — only approve exists; cancel is the
  fallback.
