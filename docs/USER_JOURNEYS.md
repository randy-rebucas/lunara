# User Journeys

Role-by-role journeys through the Lunara platform. Each journey lists the steps, the app/screen involved, and the order/entity status transitions where relevant. See [README.md](../README.md#end-to-end-test-flow) for dev logins and quick local setup, and [docs/API_ENDPOINTS.md](./API_ENDPOINTS.md) for endpoint details.

## Roles

| Role | Portal | Can | Cannot |
|------|--------|-----|--------|
| Customer | customer-web (3000), customer-mobile (8081) | Book service; choose service type, schedule, address, payment | Choose laundry shop |
| Admin dispatcher | admin-web (3002) | Review orders; assign shop & rider; monitor SLA & progress; resolve conflicts | Process laundry; accept rider jobs |
| Laundry partner | partner-web (3003) | Accept assigned orders; process laundry; request pickup/delivery | Browse or compete for unassigned orders |
| Shop staff | partner-web | Processing queue; advance steps; photos | Accept franchise orders (partner only) |
| Rider | rider-mobile (8082) | Accept offered tasks; pickup; deliver to shop/customer; proof photos | Pick orders outside offers/assignment |

---

## 1. Customer journey — book, pay, track, review

**Entry:** customer-web (http://localhost:3000) or customer-mobile (port 8081)

1. **Sign up** — `/signup`, phone number → OTP (Twilio) → verify
   - Alt: **Register with email/password** at `/register` (skips OTP)
2. **Onboarding** — complete profile, add address (first-time only)
3. **Home/Dashboard** — `/dashboard` or `(tabs)` — book laundry, see deals, notification preview
4. **Book laundry** — `/book` — service type → address → schedule → weight → add-ons → estimate → confirm
   - No shop is chosen by the customer (managed network — admin assigns later)
5. **Pay** — `/checkout/{orderId}` — PayMongo (GCash/Maya/card), cash on pickup/delivery, or wallet
   - If paying by wallet and balance is low: **top up** at `/wallet` (preset amounts ₱500/₱1000/₱2000)
   - Order status → `pending_dispatch`
6. **Track order** — `/orders/{id}` — timeline view, live WebSocket updates, rider GPS once en route
   - Notifications bell shows dispatch/status events with deep links (customer-mobile also gets local banners + FCM if EAS build)
7. **Pickup verification** — rider arrives, customer (or contact) confirms via last 4 digits of phone
8. **Delivery verification** — rider arrives with completed order, customer confirms (last 4 digits) and signs on-screen
9. **Review** — once `completed`, prompt on dashboard/track page → `/orders/{id}/review` — 1–5 stars + comment → published
10. **Optional: Refund** — `/orders/{orderId}/refund` → track at `/refunds/{refundId}`
11. **Optional: Lost item complaint** — `/orders/{orderId}/lost-item` → creates support ticket, track at `/support/{ticketId}`

**Status path:** `pending` → `pending_dispatch` → `shop_assigned` → `rider_assigned_pickup` → `picked_up` → `in_transit_to_shop` → `received_at_shop` → (processing stages) → `ready_for_delivery` → `rider_assigned_delivery` → `out_for_delivery` → `delivered` → `completed`

---

## 2. Admin dispatcher journey — assign and monitor

**Entry:** admin-web (http://localhost:3002), login `admin@lunara.dev` / `password123`

1. **Overview dashboard** — active orders, riders online, shops, open tickets, MTD revenue
2. **New orders queue** — `/dispatch` — shows `pending_dispatch` orders with a shop evaluation matrix (location, capacity, performance, availability, turnaround)
3. **Assign shop** — order gets `branchId`, `partnerId`, status → `shop_assigned`, estimated turnaround set (pickup doesn't auto-start)
4. **Assign pickup rider** — manual assign, or auto-suggest → admin confirms → status → `rider_assigned_pickup` + rider notified
5. **Monitor control tower** — `/control-tower` — SLA watchlist, conflicts, drill into `/orders/{id}`
6. **Assign delivery rider** — once shop marks `ready_for_delivery`, suggest/assign delivery rider → `rider_assigned_delivery`
7. **Monitor shops** — `/shops` — branch capacity (branches seed on first dispatch/branch call)
8. **Monitor riders** — online status, verification, earnings, active tasks; **review KYC documents** for pending riders
9. **Refund review** — `/refunds` — open request → start review → verify order/payment → approve/reject → process (credits wallet)
10. **Support / lost item investigation** — `/support` — open ticket → review pickup/delivery/processing photos and laundry logs → determine outcome (found/compensated/no action/denied) → compensate via wallet credit → close ticket
11. **Promotions** — create codes, toggle active/inactive
12. **Reports** — 7/14/30-day platform analytics

---

## 3. Laundry partner journey — accept and oversee shop operations

**Entry:** partner-web (http://localhost:3003), login `partner@lunara.dev` / `password123`

1. **Dashboard** — incoming count, processing count, revenue today/week, low-stock alerts
2. **Incoming orders** — open order assigned by admin → accept
3. **Request pickup** (optional) — broadcast to marketplace if not already rider-assigned
4. **Assign staff** — assign order to a staff member, or view workload on Staff page
5. **Receiving** — once rider drops off: receive laundry → verify weight → confirm items → status → `received_at_shop`
6. **Monitor progress** — track in-shop pipeline and ready-for-delivery orders
7. **Inventory** — adjust detergent, bags, tags stock; low stock surfaces on dashboard
8. **Reports** — 7/14/30-day operational summary (orders by status, revenue)
9. **Revenue** — today, month-to-date, 7-day chart

---

## 4. Shop staff journey — process laundry

**Entry:** partner-web (http://localhost:3003), login `staff@lunara.dev` / `password123` (redirects to processing queue)

1. **View queue** — accept a job, or process if partner already assigned
2. **Step through stages** — received → sorting → washing → drying → folding → ironing (optional) → quality check → ready for delivery, each with optional progress photo URL
3. **Ready for delivery** — final stage triggers admin dispatcher to assign a delivery rider

---

## 5. Rider journey — pickup and delivery

**Entry:** rider-mobile (Expo, port 8082), login `rider@lunara.dev` / `password123`

1. **Login**
2. **Complete profile + KYC documents** — driver's license, OR/CR, NBI clearance, selfie — required before going online (`POST /riders/online` returns 403 until admin-approved)
3. **Go online** — joins `riders:online` room, becomes eligible for offers
4. **Pickup task** — accept offer/assignment → navigate → arrive → verify customer (last 4 of phone) → collect → photo → generate receipt → drop at shop (payout is admin-configurable via platform settings; fallback ₱35)
5. **Delivery task** (after partner marks ready) — accept → navigate → pick up from shop → out for delivery → arrive → customer verifies/signs → photo → complete (payout is admin-configurable via platform settings; fallback ₱35)
6. **Earnings** — view today/total on Home and Earnings screen
7. **Notifications** — bell + local banners for new offers/assignments (FCM if EAS dev build); tap to open `/pickup/[id]` or `/delivery/[id]`
8. **SOS** — emergency button on active pickup/delivery screens — notifies dispatch + shares live location
9. **Task history** — review completed pickups/deliveries

**Offers vs. assignments:** offers broadcast to all online riders (`joinRiders`); assignments target a specific rider's room (`joinRider`). Rider must be online to receive offers.

---

## Cross-role flow: managed laundry network

```
Customer books & pays
        │
        ▼
pending_dispatch ──────► Admin evaluates shops (location, capacity, performance, turnaround)
        │
        ▼
shop_assigned ─────────► Partner accepts, optionally requests pickup
        │
        ▼
Admin assigns pickup rider (manual or auto-suggest + confirm)
        │
        ▼
rider_assigned_pickup ─► Rider: arrive → verify → collect → photo → receipt → drop at shop
        │
        ▼
received_at_shop ──────► Partner: receive → verify weight → confirm items
        │
        ▼
Processing stages (received → sorting → washing → drying → folding → ironing → quality check)
        │
        ▼
ready_for_delivery ────► Admin assigns delivery rider
        │
        ▼
rider_assigned_delivery ► Rider: pick up from shop → out for delivery → arrive → customer verify/sign → photo → complete
        │
        ▼
delivered → completed ─► Customer leaves a review; admin closes the loop
```
