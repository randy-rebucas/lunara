# Test Case Documentation

Manual test cases for core Lunara flows, organized by feature area. Pairs with [docs/USER_JOURNEYS.md](./USER_JOURNEYS.md) (role-level flows) and the [README End-to-End Test Flow](../README.md#end-to-end-test-flow) (setup & dev logins).

**Setup for all cases:** `docker compose up -d`, `npm run seed --workspace=@lunara/api`, API running, relevant apps running. Dev logins: `customer@lunara.dev`, `partner@lunara.dev`, `staff@lunara.dev`, `rider@lunara.dev`, `admin@lunara.dev` — all `password123`.

Each case: **ID**, **Preconditions**, **Steps**, **Expected result**.

---

## 1. Authentication

### TC-AUTH-01: Customer signup via OTP
- **Preconditions:** Twilio env vars configured on API; valid test phone number
- **Steps:** Go to `/signup` → enter phone → request OTP → enter code received via SMS → complete profile → add address
- **Expected:** Account created, redirected to onboarding then dashboard; address saved

### TC-AUTH-02: Customer signup with email/password
- **Steps:** Go to `/register` → enter email + password → submit
- **Expected:** Account created without OTP step; redirected to add address if none exists, then dashboard

### TC-AUTH-03: Customer login via OTP
- **Steps:** Go to `/login` → enter phone → OTP → verify
- **Expected:** Logged in, redirected to dashboard

### TC-AUTH-04: Rider login
- **Steps:** rider-mobile → `/login` → `rider@lunara.dev` / `password123`
- **Expected:** Logged in to rider Home

### TC-AUTH-05: Partner/staff login
- **Steps:** partner-web `/login` → `partner@lunara.dev` (or `staff@lunara.dev`) / `password123`
- **Expected:** Partner → dashboard. Staff → redirected directly to processing queue

### TC-AUTH-06: Admin login
- **Steps:** admin-web `/login` → `admin@lunara.dev` / `password123`
- **Expected:** Logged in to Overview dashboard

### TC-AUTH-07: Invalid credentials rejected
- **Steps:** Attempt login with wrong password on any portal
- **Expected:** Error shown, no session created

---

## 2. Booking & payment

### TC-BOOK-01: Full booking flow
- **Preconditions:** Customer logged in with at least one saved address
- **Steps:** `/book` → choose service type → select address → schedule pickup → enter/estimate weight → choose add-ons → review estimate → confirm
- **Expected:** Order created with status `pending`; no shop assigned yet (managed network)

### TC-BOOK-02: Pay via PayMongo (GCash/Maya/Card mock)
- **Steps:** From `/checkout/{orderId}` → choose PayMongo → select method → complete mock payment
- **Expected:** Order status → `pending_dispatch`; receipt code shown; redirected to track page

### TC-BOOK-03: Pay via wallet
- **Preconditions:** Wallet balance ≥ order total (top up at `/wallet` if needed, ₱500 increments)
- **Steps:** Checkout → choose wallet → confirm
- **Expected:** Wallet debited, order status → `pending_dispatch`

### TC-BOOK-04: Pay via cash on pickup/delivery
- **Steps:** Checkout → choose cash → confirm
- **Expected:** Order confirmed without immediate payment capture; status → `pending_dispatch` once confirmed

### TC-BOOK-05: Insufficient wallet balance blocked
- **Preconditions:** Wallet balance < order total
- **Steps:** Checkout → choose wallet → confirm
- **Expected:** Payment rejected with insufficient-balance error; order remains unpaid

### TC-BOOK-06: Retry payment for unpaid order
- **Preconditions:** Order exists with unpaid/failed payment
- **Steps:** Navigate to `/checkout/{orderId}` directly
- **Expected:** Checkout reloads with order details; payment can be retried

---

## 3. Admin dispatch

### TC-DISP-01: Shop evaluation matrix shown for pending_dispatch orders
- **Preconditions:** Order paid, status `pending_dispatch`
- **Steps:** Admin → `/dispatch`
- **Expected:** Order appears in queue with evaluation matrix (location, capacity, performance, availability, turnaround) for eligible shops

### TC-DISP-02: Assign shop to order
- **Steps:** From `/dispatch`, select a shop for the order → confirm assignment
- **Expected:** Order gets `branchId`, `partnerId`; status → `shop_assigned`; estimated turnaround set; pickup does not auto-start

### TC-DISP-03: Auto-suggest + confirm pickup rider
- **Preconditions:** Order is `shop_assigned`
- **Steps:** Admin → order ops → suggest pickup rider → review suggestion → confirm
- **Expected:** Status → `rider_assigned_pickup`; rider receives notification (socket + inbox + banner)

### TC-DISP-04: Manual pickup rider assignment
- **Steps:** Admin → order ops → manually select rider → assign (`type: "pickup"`)
- **Expected:** Same result as auto-suggest path

### TC-DISP-05: Assign delivery rider after ready_for_delivery
- **Preconditions:** Order status `ready_for_delivery`
- **Steps:** Admin → suggest/confirm or manually assign delivery rider
- **Expected:** Status → `rider_assigned_delivery`; rider notified

### TC-DISP-06: Control tower SLA watchlist surfaces at-risk orders
- **Preconditions:** An order is approaching/exceeding its estimated turnaround
- **Steps:** Admin → `/control-tower`
- **Expected:** Order appears on SLA watchlist; drilling into `/orders/{id}` shows full detail

### TC-DISP-07: Branches seed lazily
- **Preconditions:** Fresh DB after seed (no branch yet created)
- **Steps:** Trigger first dispatch/branch API call for `partner@lunara.dev`
- **Expected:** Branch record created and visible at `/shops`

---

## 4. Rider pickup workflow

### TC-RIDER-01: Cannot go online without verified KYC
- **Preconditions:** Rider profile incomplete or documents not yet approved
- **Steps:** Tap "Go online"
- **Expected:** `POST /riders/online` returns 403; UI shows verification-required message

### TC-RIDER-02: KYC document upload and admin approval
- **Steps:** Rider → `/documents` → upload license, OR/CR, NBI clearance, selfie. Admin → Riders → rider detail → review and approve
- **Expected:** Documents marked approved; rider can now go online

### TC-RIDER-03: Go online and receive pickup offer
- **Preconditions:** Rider verified
- **Steps:** Go online (joins `riders:online`) → admin assigns/broadcasts pickup → observe Tasks list and notification
- **Expected:** Local banner ("New pickup offer"), Tasks list updates; offer visible to all online riders (`joinRiders`)

### TC-RIDER-04: Complete pickup task
- **Preconditions:** Rider has accepted a pickup task, status `rider_assigned_pickup`
- **Steps:** Arrive → verify customer (last 4 digits of phone) → collect → take photo → generate receipt → drop at shop
- **Expected:** Status progresses through `picked_up` → `in_transit_to_shop`; earnings show +₱80 on completion

### TC-RIDER-05: Pickup verification fails with wrong phone digits
- **Steps:** At verify step, enter incorrect last-4 digits
- **Expected:** Verification rejected; cannot proceed to collect step

### TC-RIDER-06: SOS button during active task
- **Preconditions:** Rider on an active pickup/delivery screen
- **Steps:** Tap SOS
- **Expected:** Dispatch notified; rider's live location shared

---

## 5. Partner / staff processing

### TC-PROC-01: Partner receives laundry from rider
- **Preconditions:** Order status `in_transit_to_shop`, rider has dropped at shop
- **Steps:** Partner portal → receiving → receive → verify weight → confirm items
- **Expected:** Status → `received_at_shop`

### TC-PROC-02: Assign staff to order
- **Steps:** Partner → incoming order → assign staff member
- **Expected:** Order appears in that staff member's queue

### TC-PROC-03: Staff steps through processing stages
- **Preconditions:** Staff logged in, order assigned/in queue
- **Steps:** Advance through weight → tag → sort → wash → dry → fold → iron (optional) → QC → pack, optionally attaching a progress photo URL at each stage
- **Expected:** Each stage updates status/log; final stage sets status → `ready_for_delivery`

### TC-PROC-04: Low stock alert surfaces on dashboard
- **Preconditions:** Inventory item (detergent/bags/tags) below threshold
- **Steps:** Partner → Inventory → adjust stock down → check Dashboard
- **Expected:** Low-stock alert visible on dashboard

### TC-PROC-05: Reports reflect correct order/revenue counts
- **Steps:** Partner → Reports → select 7/14/30-day range
- **Expected:** Order-by-status counts and revenue match underlying orders for that range

---

## 6. Delivery

### TC-DEL-01: Rider completes delivery
- **Preconditions:** Order `rider_assigned_delivery`
- **Steps:** Rider → pick up from shop → out for delivery → arrive → customer verifies (last 4 digits) and signs → photo → complete
- **Expected:** Status → `out_for_delivery` → `delivered`; rider earnings +₱120

### TC-DEL-02: Delivery verification fails with wrong phone digits
- **Steps:** At customer verification step, enter incorrect digits
- **Expected:** Cannot complete delivery; signature step blocked

### TC-DEL-03: Order auto-completes after delivery confirmation
- **Steps:** After `delivered`, observe order status shortly after
- **Expected:** Status → `completed`; customer prompted to review

---

## 7. Tracking & notifications

### TC-TRACK-01: Customer sees live timeline updates without refresh
- **Preconditions:** Customer on `/orders/{id}` for an active order
- **Steps:** Trigger a status change from admin/partner/rider side
- **Expected:** Timeline and status update live via WebSocket, no manual refresh needed

### TC-TRACK-02: Rider GPS shown when en route
- **Preconditions:** Order status `out_for_delivery` or `in_transit_to_shop`
- **Steps:** Customer views track page
- **Expected:** Rider's live location displayed on map

### TC-TRACK-03: Customer notification bell shows dispatch events
- **Steps:** Trigger `awaitingDispatch`, `shopAssigned`, `riderAssigned`, etc. → check bell on customer-web/mobile Home
- **Expected:** Each event appears as a row with correct copy (from `ORDER_EVENT_MESSAGES`) and deep links to the order

### TC-TRACK-04: Rider notification bell shows offers/assignments
- **Steps:** Trigger pickup/delivery offer or assignment → check rider Home bell
- **Expected:** Unread count increments; tapping navigates to `/pickup/[id]` or `/delivery/[id]`

### TC-TRACK-05: Local banner shown while app open (mobile)
- **Preconditions:** Customer or rider mobile app open in foreground
- **Steps:** Trigger a dispatch event
- **Expected:** `expo-notifications` local banner appears immediately, independent of FCM

### TC-TRACK-06: FCM push delivered in background (EAS build only)
- **Preconditions:** EAS development build installed on physical device, Firebase configured, app backgrounded
- **Steps:** Trigger dispatch event from admin
- **Expected:** FCM push received; tapping opens relevant order/task screen
- **Note:** Not testable in Expo Go (SDK 53+)

---

## 8. Refunds

### TC-REFUND-01: Customer submits refund request
- **Preconditions:** Order paid (wallet, PayMongo, or cash-paid)
- **Steps:** `/orders/{orderId}/refund` → fill reason → submit
- **Expected:** Refund request created; visible at `/refunds/{refundId}` with status pending

### TC-REFUND-02: Admin approves refund
- **Steps:** Admin `/refunds` → open request → start review → verify order/payment → approve with amount
- **Expected:** Customer wallet credited; payment & order marked refunded; customer notified (in-app + WebSocket)

### TC-REFUND-03: Admin rejects refund
- **Steps:** Admin `/refunds` → open request → start review → reject with reason
- **Expected:** Request marked rejected with reason; customer sees rejection on `/refunds/{refundId}`; no wallet credit

### TC-REFUND-04: Refund request blocked for unpaid order
- **Preconditions:** Order not yet paid
- **Steps:** Attempt to navigate to refund flow for that order
- **Expected:** Refund option unavailable / request blocked

---

## 9. Lost item / support

### TC-LOST-01: Customer files lost item complaint
- **Preconditions:** Order status `delivered` or `completed`
- **Steps:** `/orders/{orderId}/lost-item` → describe missing items → submit
- **Expected:** Support ticket created; redirected to `/support/{ticketId}`

### TC-LOST-02: Admin investigates with photos and logs
- **Steps:** Admin `/support` → open lost-item ticket → review pickup/delivery/processing photos and laundry processing logs
- **Expected:** All relevant photos and status history visible on the ticket

### TC-LOST-03: Admin compensates and closes ticket
- **Steps:** Determine outcome (found/compensated/no action/denied) → if compensated, credit customer wallet (e.g. ₱200) → close ticket
- **Expected:** Wallet credited if compensated; ticket status → closed; customer sees final status at `/support/{ticketId}`

---

## 10. Reviews

### TC-REVIEW-01: Customer submits review after completion
- **Preconditions:** Order status `completed`
- **Steps:** Notification/prompt on dashboard or track page → `/orders/{id}/review` → select 1–5 stars, add comment → submit
- **Expected:** Review published; visible wherever reviews are surfaced

### TC-REVIEW-02: Review cannot be submitted for incomplete order
- **Preconditions:** Order not yet `completed`
- **Steps:** Attempt to navigate to `/orders/{id}/review`
- **Expected:** Review flow unavailable/blocked

---

## 11. Admin platform management

### TC-ADMIN-01: Overview dashboard metrics accurate
- **Steps:** Login → Overview
- **Expected:** Active orders, riders online, shops, open tickets, MTD revenue match underlying data

### TC-ADMIN-02: Filter orders by status
- **Steps:** Admin → Orders → apply status filter
- **Expected:** List shows only matching orders

### TC-ADMIN-03: Review rider KYC documents
- **Steps:** Admin → Riders → rider detail → review uploaded documents → approve/reject
- **Expected:** Rider verification status updates; rejected rider cannot go online

### TC-ADMIN-04: Create and toggle promotion code
- **Steps:** Admin → Promotions → create code with rules → toggle active/inactive
- **Expected:** Code usable by customers only while active; respects defined rules (e.g. expiry, audience)

### TC-ADMIN-05: Reports reflect correct platform-wide analytics
- **Steps:** Admin → Reports → select 7/14/30-day range
- **Expected:** Numbers match underlying order/revenue data for that range

---

## 12. Cross-cutting / negative cases

### TC-NEG-01: Customer cannot choose a specific shop
- **Steps:** Attempt to find a shop-selection step in `/book`
- **Expected:** No such option exists — managed network always routes through admin assignment

### TC-NEG-02: Rider cannot pick unassigned/unoffered orders
- **Steps:** Rider attempts to act on a task not offered/assigned to them
- **Expected:** API rejects action (403/404); task not actionable in UI

### TC-NEG-03: Partner cannot browse unassigned orders
- **Steps:** Partner attempts to view orders not assigned to their branch
- **Expected:** Order list scoped to partner's own branch only

### TC-NEG-04: Staff cannot accept franchise-level orders
- **Steps:** Staff attempts an action reserved for partner role
- **Expected:** Action blocked per RBAC (`@lunara/utils` role constants)

### TC-NEG-05: Session/role isolation across portals
- **Steps:** Log into one portal (e.g. admin-web), attempt to access another portal's protected routes directly
- **Expected:** Redirected to login or denied — sessions/roles are portal-scoped
