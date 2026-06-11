# API Endpoints

Lunara REST API reference. All routes below are relative to the global prefix **`/api/v1`** (default base: `http://localhost:3001/api/v1`).

## Conventions

| Item | Detail |
|------|--------|
| Auth header | `Authorization: Bearer <accessToken>` |
| Response shape | `{ success: true, data: … }` or `{ success: false, error: { message, code? } }` |
| Roles | `customer`, `partner`, `staff`, `rider`, `admin` |
| Validation | Unknown body fields are rejected (`forbidNonWhitelisted`) |

### Public register

`POST /auth/register` always creates a **customer** account. Role cannot be set via the public API.

### PayMongo webhooks

`POST /payments/webhooks/paymongo` verifies the `Paymongo-Signature` header with `PAYMONGO_WEBHOOK_SECRET`. See [PAYMENTS_PAYMONGO.md](./PAYMENTS_PAYMONGO.md).

### Legacy payment confirm

`POST /payments/:id/confirm` requires header `x-payment-webhook-secret` (env `PAYMENT_WEBHOOK_SECRET`). Mock checkout flows confirm payments server-side and do not call this route.

---

## Health

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | Public | Probes MongoDB + Redis. Returns **200** when all checks pass, **503** when degraded. |

Example response (healthy):

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "lunara-api",
    "timestamp": "2026-05-30T12:00:00.000Z",
    "checks": { "mongo": "ok", "redis": "ok" }
  }
}
```

---

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Register customer (email/phone + password) |
| POST | `/auth/login` | Public | Password or OTP login |
| POST | `/auth/otp/request` | Public | Request SMS OTP |
| POST | `/auth/refresh` | Public | Exchange refresh token |
| POST | `/auth/logout` | JWT | Invalidate session |

---

## Users & customers

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/users/me` | Any | Auth user profile |
| POST | `/users/me/push-token` | Any | Register FCM device token (`token`, `platform`: `ios` \| `android`, optional `deviceId`) |
| DELETE | `/users/me/push-token` | Any | Unregister device token on logout (`token`) |
| GET | `/users` | admin | List users |
| GET | `/customers/me` | customer | Customer profile |
| PATCH | `/customers/me` | customer | Update profile |
| GET | `/customers/me/onboarding` | customer | Onboarding completion status |

---

## Addresses

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/addresses` | customer | List saved addresses |
| POST | `/addresses` | customer | Add address |
| PATCH | `/addresses/:id` | customer | Update address |
| DELETE | `/addresses/:id` | customer | Remove address |

---

## Booking (customer)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/booking/config` | customer | Services, pricing config |
| GET | `/booking/availability?addressId=` | customer | Pickup slots + nearest branches |
| POST | `/booking/quote?addressId=` | customer | Price quote; optional `couponCode` applies active promo |
| POST | `/booking/orders` | customer | Create order from booking wizard (pending payment); optional `couponCode` |
| GET | `/deals` | customer | Eligible promos for signed-in customer (shared + personal signup code; filtered by audience/expiry) |

---

## Branches

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/branches/nearest?addressId=` | customer, admin | Nearest branches for address |
| GET | `/branches` | admin, partner | List branches (flat) |

Admin branch network and CRUD live under **`/admin/branches`** (see Admin).

---

## Orders

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/orders` | customer | Create order (legacy/direct) |
| GET | `/orders` | Any (scoped) | List orders for current user/role |
| GET | `/orders/queue` | partner, staff, admin | Partner processing queue |
| GET | `/orders/:id` | Owner / assigned / admin | Order detail |
| PATCH | `/orders/:id/status` | partner, staff, rider, admin | Update status |
| POST | `/orders/:id/assign-rider` | admin | Assign pickup/delivery rider |
| GET | `/orders/:id/handoff-qr?context=pickup\|delivery` | customer | Customer handoff QR for rider scan |
| GET | `/orders/:id/delivery` | customer | Delivery verify/sign UI state |
| POST | `/orders/:id/delivery/verify` | customer | Verify delivery code |
| POST | `/orders/:id/delivery/sign` | customer | Sign for delivery |

---

## Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/intent` | JWT | Create payment intent for order (`clientOrigin` optional) |
| POST | `/payments/wallet-topup/intent` | JWT | PayMongo wallet top-up (`amount`, `method`, `clientOrigin`) |
| GET | `/payments/orders/:orderId` | JWT | Payment + order summary for checkout |
| GET | `/payments/:id` | JWT | Payment by id (syncs pending PayMongo session) |
| POST | `/payments/:id/sync` | JWT | Poll PayMongo and fulfill if paid |
| POST | `/payments/webhooks/paymongo` | PayMongo signature | PayMongo webhook (`Paymongo-Signature` header) |
| POST | `/payments/:id/confirm` | Webhook secret | Legacy confirm (generic provider callback) |
| GET | `/payments/mock/paymongo/checkout` | Public | Dev mock checkout (no `PAYMONGO_SECRET_KEY`) |
| GET | `/payments/mock/paymongo/complete` | Public | Dev mock complete redirect |
| GET | `/payments/mock/gcash` | Public | Dev GCash confirm redirect |
| GET | `/payments/mock/maya` | Public | Dev Maya confirm redirect |
| GET | `/payments/mock/stripe` | Public | Dev card confirm redirect |

---

## Wallets

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/wallets/me` | customer | Balance |
| GET | `/wallets/me/transactions` | customer | Transaction history |
| POST | `/wallets/topup` | customer | Dev-only instant top-up (blocked when PayMongo is configured) |

---

## Reviews & notifications

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/notifications/me` | customer | In-app notifications |
| PATCH | `/notifications/:id/read` | customer | Mark notification read |
| GET | `/reviews/orders/:orderId` | customer | Review eligibility + existing review |
| POST | `/reviews` | customer | Submit order review |

---

## Support (customer)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/support/lost-items` | customer | Report lost item |
| GET | `/support/tickets` | customer | My tickets |
| GET | `/support/tickets/:id` | customer | Ticket detail + investigation view |

---

## Refunds (customer)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/refunds` | customer | Submit refund request |
| GET | `/refunds` | customer | My refund requests |
| GET | `/refunds/:id` | customer | Refund detail + timeline |

---

## Partner portal

Base: `/partner` — JWT required; role enforced per route.

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/partner/dashboard` | partner, admin | Shop dashboard |
| GET | `/partner/orders/incoming` | partner, staff, admin | Incoming orders |
| POST | `/partner/orders/:orderId/accept` | partner, admin | Accept partner assignment |
| POST | `/partner/orders/:orderId/request-pickup` | partner, admin | Request pickup rider |
| POST | `/partner/orders/:orderId/request-delivery` | partner, staff, admin | Request delivery rider |
| GET | `/partner/orders/progress` | partner, admin | In-progress monitor |
| GET | `/partner/staff` | partner, admin | Staff list + workload (shop branch) |
| POST | `/partner/staff` | partner, admin | Create staff account for shop branch |
| POST | `/partner/orders/:orderId/assign-staff` | partner, admin | Assign staff to order |
| GET | `/partner/inventory` | partner, admin | Shop inventory |
| PATCH | `/partner/inventory/:id` | partner, admin | Update stock quantity |
| GET | `/partner/reports?days=` | partner, admin | Operational reports |
| GET | `/partner/revenue` | partner, admin | Revenue summary |
| GET | `/partner/orders/:orderId/receiving` | partner, staff, admin | Shop receiving state |
| POST | `/partner/orders/:orderId/receiving/receive` | partner, staff, admin | Mark laundry received |
| POST | `/partner/orders/:orderId/receiving/verify-weight` | partner, staff, admin | Verify weight at shop |
| POST | `/partner/orders/:orderId/receiving/confirm-items` | partner, staff, admin | Confirm item count |
| GET | `/partner/processing/config` | partner, staff, admin | Processing step config |
| GET | `/partner/orders/queue?mine=` | partner, staff, admin | Processing queue |
| POST | `/partner/orders/:orderId/processing/accept` | partner, staff, admin | Staff accept job |
| GET | `/partner/orders/:orderId/processing` | partner, staff, admin | Processing view |
| POST | `/partner/orders/:orderId/processing/advance` | partner, staff, admin | Complete processing step |
| POST | `/partner/orders/:orderId/delivery/dispatch` | partner, staff, admin | Notify delivery riders |

---

## Riders

Base: `/riders` — JWT + `rider` role unless noted.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/riders/me` | Rider profile, vehicle, KYC documents, compliance checklist |
| PATCH | `/riders/me` | Update profile (name, phone, home address, vehicle, plate/OR-CR) |
| POST | `/riders/me/documents/:type` | Upload KYC document (`drivers_license`, `or_cr`, `nbi_clearance`, `selfie`) — multipart field `document` |
| GET | `/riders/notifications` | Rider notifications (categories: assignment, reminder, earnings, system) |
| GET | `/riders/tasks` | Active tasks |
| GET | `/riders/earnings` | Earnings dashboard (today/week/month/lifetime + breakdown) |
| GET | `/riders/wallet` | Wallet balances (current, pending hold, withdrawable) + recent ledger |
| GET | `/riders/wallet/withdrawals` | Rider withdrawal request history |
| POST | `/riders/wallet/withdraw` | Submit withdrawal request (`{ amount }`, min ₱100) |
| GET | `/riders/payout-method` | Saved payout method (GCash / Maya / bank) |
| PATCH | `/riders/payout-method` | Update payout method and account details |
| PATCH | `/riders/location` | Update GPS location — body: `{ latitude, longitude, speed?, heading?, timestamp? }` or legacy `{ lat, lng, … }`; rider app sends every **15s** during active pickup/delivery tasks |
| POST | `/riders/online` | Go online (403 if profile/documents incomplete or unapproved) |
| POST | `/riders/offline` | Go offline |
| GET | `/riders/pickup-offers` | Open pickup offers |
| GET | `/riders/pickup-tasks/:orderId` | Pickup task detail |
| POST | `/riders/pickup-offers/:orderId/accept` | Accept pickup |
| POST | `/riders/pickup-tasks/:orderId/arrive` | Mark arrived at customer |
| POST | `/riders/pickup-tasks/:orderId/verify` | Verify customer (4-digit code or `{ qrPayload }`) |
| POST | `/riders/pickup-tasks/:orderId/collect-cash` | Record cash collected on pickup |
| POST | `/riders/pickup-tasks/:orderId/collect` | Collect laundry |
| POST | `/riders/pickup-tasks/:orderId/photo-upload` | Upload pickup photo (multipart) |
| POST | `/riders/pickup-tasks/:orderId/photo` | Set pickup photo URL (legacy) |
| POST | `/riders/pickup-tasks/:orderId/generate-receipt` | Generate pickup receipt |
| GET | `/riders/pickup-tasks/:orderId/order-qr` | Order handover QR payload (rider) |
| POST | `/riders/pickup-tasks/:orderId/drop-at-shop` | Drop at shop (optional `{ qrPayload }` for scan handover) |
| POST | `/riders/pickup-tasks/:orderId/complete` | Complete pickup leg |
| GET | `/riders/delivery-offers` | Open delivery offers |
| GET | `/riders/delivery-tasks/:orderId` | Delivery task detail |
| POST | `/riders/delivery-offers/:orderId/accept` | Accept delivery |
| POST | `/riders/delivery-tasks/:orderId/pickup-from-shop` | Pick up from shop |
| POST | `/riders/delivery-tasks/:orderId/out-for-delivery` | Out for delivery |
| POST | `/riders/delivery-tasks/:orderId/start` | Start delivery |
| POST | `/riders/delivery-tasks/:orderId/customer-received` | Customer received |
| POST | `/riders/delivery-tasks/:orderId/verify-customer-qr` | Verify customer via scanned QR (`{ qrPayload }`) |
| POST | `/riders/delivery-tasks/:orderId/arrive` | Arrived at customer |
| POST | `/riders/delivery-tasks/:orderId/collect-cash` | Record cash collected on delivery |
| POST | `/riders/delivery-tasks/:orderId/photo-upload` | Upload delivery photo (multipart) |
| POST | `/riders/delivery-tasks/:orderId/photo` | Set delivery photo URL (legacy) |
| POST | `/riders/delivery-tasks/:orderId/complete` | Complete delivery |
| POST | `/riders/sos/notify` | Notify dispatch of SOS (body: `{ orderId, lat?, lng? }`) |
| POST | `/riders/sos/location/start` | Start live location sharing with dispatch |
| POST | `/riders/sos/location/stop` | Stop live location sharing |

---

## Admin

Base: `/admin` — JWT + `admin` role.

### Dashboard & monitoring

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dashboard` | Overview stats |
| GET | `/admin/control-tower` | SLA / conflict watchlist |
| GET | `/admin/orders?status=&limit=` | All orders |
| GET | `/admin/riders` | Rider roster with verification status |
| GET | `/admin/riders/documents/pending` | Pending KYC document review queue |
| GET | `/admin/riders/withdrawals` | Rider withdrawal queue (`?status=pending`) |
| POST | `/admin/riders/withdrawals/:id/approve` | Approve payout (debits rider wallet) |
| POST | `/admin/riders/withdrawals/:id/reject` | Reject payout request |
| POST | `/admin/riders/:userId/earnings/credit` | Credit bonus or adjustment (`{ type, amount, note? }`) |
| POST | `/admin/riders/:userId/wallet/hold` | Set admin hold on rider wallet (`{ pendingHold }`) |
| GET | `/admin/riders/:userId/profile` | Rider profile + documents for review |
| PATCH | `/admin/riders/:userId/documents/:type` | Approve/reject rider document (`{ status, rejectionReason? }`) |
| POST | `/admin/riders/announcement` | Broadcast platform announcement to riders (`{ body, title?, userIds? }`) |
| GET | `/admin/shops` | Partner accounts |
| GET | `/admin/revenue` | Platform revenue |
| GET | `/admin/reports?days=` | Analytics report |

### Dispatch & operations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dispatch/dashboard` | Dispatch boards |
| GET | `/admin/dispatch/queue` | Pending dispatch queue |
| GET | `/admin/sos/active` | Active rider SOS incidents |
| PATCH | `/admin/sos/:id/resolve` | Acknowledge / resolve SOS incident |
| GET | `/admin/dispatch/orders/:orderId/suggestions` | Branch suggestions |
| POST | `/admin/dispatch/orders/:orderId/assign` | Assign shop to order |
| GET | `/admin/operations/orders/:orderId` | Order ops detail |
| GET | `/admin/operations/orders/:orderId/suggest-pickup-rider` | Pickup rider suggestions |
| POST | `/admin/operations/orders/:orderId/confirm-pickup-rider` | Confirm pickup rider |
| POST | `/admin/operations/orders/:orderId/assign-rider` | Direct rider assign |
| POST | `/admin/operations/orders/:orderId/dispatch-pickup` | Trigger pickup dispatch |
| GET | `/admin/operations/orders/:orderId/suggest-delivery-rider` | Delivery rider suggestions |
| POST | `/admin/operations/orders/:orderId/confirm-delivery-rider` | Confirm delivery rider |
| POST | `/admin/operations/orders/:orderId/flag-conflict` | Flag ops conflict |
| POST | `/admin/operations/orders/:orderId/resolve-conflict` | Resolve conflict |

### Branches

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/branches` | Branch list |
| GET | `/admin/branches/network` | Hierarchy tree |
| GET | `/admin/branches/:id/profile` | Branch profile |
| POST | `/admin/branches` | Create branch |
| PATCH | `/admin/branches/:id` | Update branch |

### Support tickets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/tickets?status=&type=` | Ticket list |
| GET | `/admin/tickets/:id` | Ticket detail |
| GET | `/admin/tickets/:id/investigation` | Lost-item investigation bundle |
| POST | `/admin/tickets/:id/investigate` | Advance investigation |
| PATCH | `/admin/tickets/:id` | Update status / priority / admin note |

### Refunds

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/refunds?status=` | Refund queue |
| GET | `/admin/refunds/:id` | Refund review bundle |
| POST | `/admin/refunds/:id/review` | Review workflow action |

### Promotions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/promotions` | List promos (includes audience, kind, dates, usage limits) |
| POST | `/admin/promotions` | Create promo (`audience`, `kind`, `startsAt`, `endsAt`, `maxUsesPerCustomer`, `newCustomerWithinDays`) |
| PATCH | `/admin/promotions/:id` | Update promo fields above |

### Laundry services (catalog)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/services` | List all laundry services (active and inactive) |
| PATCH | `/admin/services/:id` | Update label, description, `pricePerKg`, `minWeightKg`, `isActive`, `sortOrder` |

Booking config (`GET /booking/config`) returns active services from this catalog.

### Booking add-ons (catalog)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/addons` | List all booking add-ons (active and inactive) |
| PATCH | `/admin/addons/:id` | Update label, description, price, `imageUrl`, `isActive`, `sortOrder` |

Booking config (`GET /booking/config`) returns active add-ons from this catalog. Seed images are served at `/api/v1/uploads/catalog-addons/`.

---

## WebSocket — `/tracking`

Connect to `{API_ORIGIN}/tracking` with JWT in handshake:

- `auth: { token: "<accessToken>" }`, or
- Header `Authorization: Bearer <accessToken>`

Unauthenticated connections are disconnected.

### Client → server events

| Event | Roles | Payload | Description |
|-------|-------|---------|-------------|
| `joinOrder` | Any authenticated | `{ orderId }` | Join order room for live updates |
| `riderLocation` | rider | `{ orderId, riderId, latitude, longitude, lat, lng, speed?, heading?, timestamp? }` | Emit rider GPS every **15s** during active task (`riderId` must match JWT sub); `timestamp` is device ISO when provided |
| `sosLocation` | rider | `{ orderId, lat, lng, latitude?, longitude?, speed?, heading?, timestamp? }` | Emit SOS live location to dispatch every **3s** during active sharing |
| `joinRider` | rider | `{ userId? }` | Join personal rider room |
| `joinRiders` | rider | — | Join online riders broadcast room |
| `joinAdminOperations` | admin | — | Join admin dispatcher room |
| `joinPartnerOperations` | partner | — | Join partner pipeline room |
| `joinBranch` | partner, staff, admin | `{ branchId }` | Join branch pipeline room |

### Server → client events

| Event | Description |
|-------|-------------|
| `locationUpdate` | `{ orderId, riderId, lat, lng, latitude, longitude, speed?, heading?, timestamp }` — rider GPS for an order room |
| `orderStatusUpdate` | `{ orderId, status }` |
| `orderEvent` | `{ orderId, event, message?, … }` lifecycle events |
| `pickupOffer` / `deliveryOffer` | Rider marketplace offers |
| `pickupAssignment` / `deliveryAssignment` | Rider task assignment |
| `dispatcherAlert` | Admin control-tower alert (ops queue or `type: rider_sos`) |
| `sosLocationUpdate` | Live rider GPS during SOS (`incidentId`, `lat`, `lng`, `latitude`, `longitude`, `speed?`, `heading?`, `timestamp`, `mapsUrl`) |
| `dispatchQueueUpdated` | Admin dispatch dashboard should refresh queue counts |
| `partnerPipelineUpdated` | Partner portal — laundry pipeline changed for partner shop |
| `branchPipelineUpdated` | Partner/staff portal — laundry pipeline changed for branch |

---

## Environment variables (API)

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default `3001`) |
| `MONGODB_URI` | MongoDB connection |
| `REDIS_URL` | Redis connection |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Required in production |
| `PAYMONGO_SECRET_KEY` | PayMongo API secret (`sk_test_` / `sk_live_`) |
| `PAYMONGO_WEBHOOK_SECRET` | PayMongo webhook signing secret |
| `PAYMENT_WEBHOOK_SECRET` | Protects `POST /payments/:id/confirm` |
| `CUSTOMER_WEB_URL` | Customer web URL for payment return redirects |
| `API_URL` | Public API URL for mock payment redirects |

---

*Last updated: 2026-06-11 — reflects implemented routes in `apps/api`.*
