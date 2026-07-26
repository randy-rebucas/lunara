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

---

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public, throttled 10/min | Register customer (email/phone + password) |
| POST | `/auth/login` | Public, throttled 10/min | Password or OTP login; sets cookie |
| POST | `/auth/otp/request` | Public, throttled 5/min | Request SMS OTP |
| POST | `/auth/forgot-password` | Public, throttled 5/min | Request password reset |
| POST | `/auth/reset-password` | Public, throttled 10/min | Reset password with token |
| POST | `/auth/refresh` | Public | Exchange refresh token; sets cookie |
| POST | `/auth/logout` | JWT | Invalidate session |

---

## Users, push tokens & customers

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/users/me` | Any | Auth user profile |
| GET | `/users` | admin | List users |
| PATCH | `/users/:id/active` | admin | Enable/disable user |
| PATCH | `/users/bulk-active` | admin | Bulk enable/disable |
| PATCH | `/users/:id/department` | admin | Set department |
| POST | `/users/:id/photo` | admin | Upload user photo |
| POST | `/users/import` | admin | CSV import |
| POST | `/users/me/push-token` | Any | Register FCM device token |
| DELETE | `/users/me/push-token` | Any | Unregister device token |
| GET | `/customers/me` | customer | Customer profile |
| PATCH | `/customers/me` | customer | Update profile |
| POST | `/customers/me/avatar` | customer | Upload avatar |
| GET | `/customers/me/onboarding` | customer | Onboarding completion status |
| GET | `/customers/me/business-summary` | customer | Business account summary |
| GET | `/customers/me/impact` | customer | Sustainability/impact stats |

---

## Addresses & favorites

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/addresses` | customer | List saved addresses |
| POST | `/addresses` | customer | Add address |
| PATCH | `/addresses/:id` | customer | Update address |
| DELETE | `/addresses/:id` | customer | Remove address |
| GET | `/favorites` | customer | List favorite branches |
| POST | `/favorites` | customer | Add favorite |
| DELETE | `/favorites/:branchId` | customer | Remove favorite |

---

## Booking, deals & subscriptions (customer)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/booking/config` | customer | Services, pricing config |
| GET | `/booking/availability` | customer | Pickup slots + nearest branches |
| GET | `/booking/shops` | customer | Eligible shops for booking |
| POST | `/booking/quote` | customer | Price quote; optional `couponCode` |
| POST | `/booking/orders` | customer | Create order from booking wizard |
| GET | `/deals` | customer | Eligible promos for signed-in customer |
| GET | `/subscriptions` | customer | List subscriptions |
| POST | `/subscriptions` | customer | Create subscription |
| PATCH | `/subscriptions/:id` | customer | Update subscription |
| DELETE | `/subscriptions/:id` | customer | Cancel subscription |

---

## Branches

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/public/branches` | Public | Marketing site branch list |
| GET | `/public/branches/:id` | Public | Marketing site branch detail |
| GET | `/public/branding` | Public | Public partner branding |
| GET | `/branches/nearest` | customer, admin | Nearest branches for address |
| GET | `/branches/nearby-shops` | customer, admin | Nearby shops |
| GET | `/branches/:id/pricing` | customer, admin, partner | Branch pricing |
| GET | `/branches` | admin, partner | List branches (flat) |

Admin branch network and CRUD live under **`/admin/branches`** (see Admin).

---

## Orders

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/orders` | Any (scoped) | List orders for current user/role |
| GET | `/orders/queue` | partner, staff, admin | Partner processing queue |
| GET | `/orders/:id` | Any (scoped) | Order detail |
| DELETE | `/orders/:id` | customer | Cancel order |
| PATCH | `/orders/:id/reschedule` | customer | Reschedule pickup |
| PATCH | `/orders/:id/status` | partner, staff, admin, rider | Update status |
| POST | `/orders/:id/assign-rider` | admin | Assign pickup/delivery rider |
| GET | `/orders/:id/handoff-qr` | customer | Customer handoff QR for rider scan |
| GET | `/orders/:id/delivery` | customer | Delivery verify/sign UI state |
| POST | `/orders/:id/delivery/verify` | customer | Verify delivery code |
| POST | `/orders/:id/delivery/sign` | customer | Sign for delivery |
| POST | `/orders/:id/customer-pickup` | partner, staff, admin | In-store customer pickup |
| POST | `/orders/:id/customer-pickup/complete` | partner, staff, admin | Complete in-store pickup |

---

## Payments & wallets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/intent` | JWT | Create payment intent for order |
| POST | `/payments/wallet-topup/intent` | JWT | PayMongo wallet top-up |
| GET | `/payments/orders/:orderId` | JWT | Payment + order summary for checkout |
| GET | `/payments/:id` | JWT | Payment by id (syncs pending PayMongo session) |
| POST | `/payments/:id/sync` | JWT | Poll PayMongo and fulfill if paid |
| POST | `/payments/webhooks/paymongo` | PayMongo signature | PayMongo webhook |
| POST | `/payments/:id/confirm` | Webhook secret | Legacy confirm |
| GET | `/payments/mock/paymongo/checkout` | Public, dev-only | Dev mock checkout |
| GET | `/payments/mock/paymongo/complete` | Public, dev-only | Dev mock complete redirect |
| GET | `/payments/mock/gcash` | Public, dev-only | Dev GCash confirm redirect |
| GET | `/payments/mock/maya` | Public, dev-only | Dev Maya confirm redirect |
| GET | `/payments/mock/stripe` | Public, dev-only | Dev card confirm redirect |
| GET | `/wallets/me` | customer | Balance |
| GET | `/wallets/me/transactions` | customer | Transaction history |
| POST | `/wallets/topup` | customer | Dev-only instant top-up |

---

## Rewards

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/rewards/me` | Any | Rewards balance/status |
| GET | `/rewards/me/transactions` | Any | Rewards transaction history |
| GET | `/rewards/catalog` | Any | Redeemable catalog |
| POST | `/rewards/redeem` | Any | Redeem reward |
| GET | `/rewards/me/referral-code` | Any | Referral code |

---

## Reviews & notifications

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/notifications/me` | customer | In-app notifications |
| PATCH | `/notifications/read-all` | customer | Mark all read |
| PATCH | `/notifications/:id/read` | customer | Mark notification read |
| GET | `/reviews/orders/:orderId` | customer | Review eligibility + existing review |
| POST | `/reviews` | customer | Submit order review |

---

## Support & refunds (customer)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/support/tickets` | customer | Create support ticket |
| POST | `/support/lost-items` | customer | Report lost item |
| POST | `/support/area-requests` | customer | Request new service area |
| GET | `/support/tickets` | customer | My tickets |
| GET | `/support/tickets/:id` | customer | Ticket detail + investigation view |
| POST | `/refunds` | customer | Submit refund request |
| GET | `/refunds` | customer | My refund requests |
| GET | `/refunds/:id` | customer | Refund detail + timeline |

---

## Laundry tags

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/laundry-tags/batches` | admin | Generate tag batch |
| GET | `/laundry-tags` | admin, partner, staff | List tags |
| GET | `/laundry-tags/lookup` | admin, partner, staff, rider, customer | Lookup tag |
| GET | `/laundry-tags/:id` | admin | Tag detail |
| POST | `/laundry-tags/:id/retire` | admin | Retire tag |
| POST | `/laundry-tags/:id/reactivate` | admin | Reactivate tag |

---

## AI Agents

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/ai-agents` | staff, admin, customer | List available AI agents |
| GET | `/ai-agents/:agentId/prompt-library` | staff, admin, customer | Agent prompt library |
| GET | `/ai-agents/:agentId/conversations` | staff, admin, customer | Agent conversation list |
| GET | `/ai-agents/conversations/:conversationId/messages` | staff, admin, customer | Conversation messages |
| POST | `/ai-agents/:agentId/messages` | staff, admin, customer, throttled 20/min | Send message to agent |

---

## Media / uploads

Base: `/uploads` — JWT required; service performs per-file access checks.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/uploads/rider-documents/:filename` | Rider KYC document |
| GET | `/uploads/task-photos/:filename` | Pickup/delivery task photo |
| GET | `/uploads/remittance-proofs/:filename` | Cash remittance proof |
| GET | `/uploads/rider-application-documents/:filename` | Rider application document |
| GET | `/uploads/partner-application-documents/:filename` | Partner application document |

---

## Partner & rider applications (public intake)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/partner-applications` | Public | Submit partner application (document upload) |
| GET | `/partner-applications` | admin, staff | List applications |
| GET | `/partner-applications/:id` | admin, staff | Application detail |
| PATCH | `/partner-applications/:id/status` | admin, staff | Approve/reject |
| POST | `/rider-applications` | Public | Submit rider application (document upload) |
| GET | `/rider-applications` | admin, staff | List applications |
| GET | `/rider-applications/:id` | admin, staff | Application detail |
| PATCH | `/rider-applications/:id/status` | admin, staff | Approve/reject |

---

## Partner portal

Base: `/partner` — JWT required; role enforced per route (`partner`, `staff`, `admin` combinations noted).

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/partner/dashboard` | partner, admin | Shop dashboard |
| GET | `/partner/promotions` | partner, staff, admin | Active promos for shop |
| GET | `/partner/branches` | partner, admin | Shop's branches |
| GET | `/partner/branches/:id/pricing` | partner, admin | Branch pricing |
| PATCH | `/partner/branches/:id/pricing` | partner, admin | Update pricing |
| PATCH | `/partner/branches/:id/pricing-mode` | partner, admin | Set pricing mode |
| PATCH | `/partner/branches/:id/addon-pricing` | partner, admin | Update addon pricing |
| PATCH | `/partner/branches/:id/hidden-catalog` | partner, admin | Hide catalog items |
| POST/PATCH/DELETE | `/partner/branches/:id/custom-services[/:serviceId]` | partner, admin | Manage custom services |
| POST/PATCH/DELETE | `/partner/branches/:id/custom-addons[/:addonId]` | partner, admin | Manage custom addons |
| GET/POST/PATCH/DELETE | `/partner/branches/:id/machines[/:machineId]` | partner, staff (GET), admin | Manage machines |
| GET | `/partner/settings` | partner, staff, admin | Shop settings |
| PATCH | `/partner/settings` | partner, staff, admin | Update settings |
| POST/DELETE | `/partner/settings/logo` | partner, admin | Shop logo |
| GET/PATCH | `/partner/profile` | partner, staff, admin | Own profile |
| POST/DELETE | `/partner/profile/avatar` | partner, staff, admin | Own avatar |
| PATCH | `/partner/staff/:staffId/profile` | partner, admin | Update staff profile |
| POST | `/partner/staff/:staffId/profile/avatar` | partner, admin | Staff avatar |
| GET | `/partner/notifications` | partner, staff, admin | Notifications |
| PATCH | `/partner/notifications/read-all` | partner, staff, admin | Mark all read |
| PATCH | `/partner/notifications/:id/read` | partner, staff, admin | Mark one read |
| GET | `/partner/orders/incoming` | partner, staff, admin | Incoming orders |
| POST | `/partner/orders/:orderId/accept` | partner, admin | Accept partner assignment |
| POST | `/partner/orders/:orderId/request-pickup` | partner, admin | Request pickup rider |
| POST | `/partner/orders/:orderId/request-delivery` | partner, staff, admin | Request delivery rider |
| GET | `/partner/orders/progress` | partner, admin | In-progress monitor |
| GET | `/partner/staff` | partner, admin | Staff list + workload |
| POST | `/partner/staff` | partner, admin | Create staff account |
| PATCH | `/partner/staff/:staffId/branch` | partner, admin | Reassign staff branch |
| POST | `/partner/orders/:orderId/assign-staff` | partner, admin | Assign staff to order |
| GET | `/partner/inventory` | partner, admin | Shop inventory |
| PATCH | `/partner/inventory/:id` | partner, admin | Update stock quantity |
| GET | `/partner/reports` | partner, admin | Operational reports |
| GET | `/partner/revenue` | partner, admin | Revenue summary |
| GET | `/partner/settlements` | partner, admin | Settlement list |
| GET | `/partner/settlements/:settlementId/orders` | partner, admin | Settlement order breakdown |
| GET | `/partner/ledger-balance` | partner | Ledger balance |
| GET | `/partner/orders/:orderId/receiving` | partner, staff, admin | Shop receiving state |
| POST | `/partner/orders/:orderId/receiving/receive` | partner, staff, admin | Mark laundry received |
| POST | `/partner/orders/:orderId/receiving/verify-weight` | partner, staff, admin | Verify weight at shop |
| POST | `/partner/orders/:orderId/receiving/confirm-items` | partner, staff, admin | Confirm item count |
| GET | `/partner/processing/config` | partner, staff, admin | Processing step config |
| GET | `/partner/orders/history` | partner, staff, admin | Order history |
| GET | `/partner/orders/queue` | partner, staff, admin | Processing queue |
| POST | `/partner/orders/:orderId/processing/accept` | partner, staff, admin | Staff accept job |
| GET | `/partner/orders/:orderId/processing` | partner, staff, admin | Processing view |
| POST | `/partner/orders/:orderId/processing/photo-upload` | partner, staff, admin | Upload processing photo |
| POST | `/partner/orders/:orderId/processing/advance` | partner, staff, admin | Complete processing step |
| POST | `/partner/orders/:orderId/processing/move` | partner, staff, admin | Move between stations |
| PATCH | `/partner/orders/:orderId/processing/shelf` | partner, staff, admin | Assign shelf slot |
| GET | `/partner/orders/shelf-lookup` | partner, staff, admin | Shelf lookup |
| POST | `/partner/orders/:orderId/delivery/dispatch` | partner, staff, admin | Notify delivery riders |
| GET | `/partner/services` | partner, staff, admin | Service catalog |
| GET | `/partner/addons` | partner, staff, admin | Addon catalog |
| GET | `/partner/customers` | partner, admin | Shop's customers |

---

## Partner & admin messaging

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/partner/messages` | partner, staff, admin | Conversation list |
| GET | `/partner/messages/:id/messages` | partner, staff, admin | Messages in conversation |
| POST | `/partner/messages/:id/send` | partner, staff, admin | Send message |
| POST | `/partner/messages/:id/upload` | partner, staff, admin | Upload attachment |
| PATCH | `/partner/messages/:id/read` | partner, staff, admin | Mark read |
| GET | `/admin/messages` | admin | Conversation list |
| GET | `/admin/messages/:id` | admin | Conversation detail |
| GET | `/admin/messages/:id/messages` | admin | Messages in conversation |
| POST | `/admin/messages/:id/send` | admin | Send message |
| POST | `/admin/messages/:id/upload` | admin | Upload attachment |
| PATCH | `/admin/messages/:id/read` | admin | Mark read |

---

## Riders

Base: `/riders` — JWT + `rider` role unless noted.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/riders/me` | Rider profile, vehicle, KYC documents, compliance checklist |
| PATCH | `/riders/me` | Update profile (name, phone, home address, vehicle, plate/OR-CR) |
| POST | `/riders/me/documents/:type` | Upload KYC document — multipart field `document` |
| GET | `/riders/notifications` | Rider notifications |
| PATCH | `/riders/notifications/:id/read` | Mark notification read |
| GET | `/riders/tasks` | Active tasks |
| GET | `/riders/active-assignment` | Current active assignment |
| GET | `/riders/tasks/history` | Completed task history |
| GET | `/riders/tasks/cancelled` | Cancelled tasks |
| GET | `/riders/earnings` | Earnings dashboard |
| GET | `/riders/performance` | Performance metrics |
| GET | `/riders/wallet` | Wallet balances + recent ledger |
| GET | `/riders/wallet/withdrawals` | Rider withdrawal request history |
| POST | `/riders/wallet/withdraw` | Submit withdrawal request |
| GET | `/riders/cash-summary` | Cash on hand summary |
| POST | `/riders/remit-cash` | Remit collected cash (image upload) |
| GET | `/riders/payout-method` | Saved payout method |
| PATCH | `/riders/payout-method` | Update payout method |
| PATCH | `/riders/location` | Update GPS location — sent every ~15s during active tasks |
| POST | `/riders/online` | Go online (403 if profile/documents incomplete) |
| POST | `/riders/offline` | Go offline |
| POST | `/riders/break/start` | Start break |
| POST | `/riders/break/end` | End break |
| GET | `/riders/incentive-campaigns` | Active incentive campaigns |
| GET | `/riders/pickup-offers` | Open pickup offers |
| GET | `/riders/pickup-tasks/:orderId` | Pickup task detail |
| POST | `/riders/pickup-offers/:orderId/accept` | Accept pickup |
| POST | `/riders/pickup-offers/:orderId/reject` | Reject pickup offer |
| POST | `/riders/pickup-tasks/:orderId/reject` | Reject pickup task |
| POST | `/riders/pickup-tasks/:orderId/arrive` | Mark arrived at customer |
| POST | `/riders/pickup-tasks/:orderId/verify` | Verify customer (code or QR) |
| POST | `/riders/pickup-tasks/:orderId/collect-cash` | Record cash collected on pickup |
| POST | `/riders/pickup-tasks/:orderId/collect` | Collect laundry |
| POST | `/riders/pickup-tasks/:orderId/assign-tag` | Assign laundry tag |
| POST | `/riders/pickup-tasks/:orderId/photo-upload` | Upload pickup photo (multipart) |
| POST | `/riders/pickup-tasks/:orderId/photo` | Set pickup photo URL (legacy) |
| POST | `/riders/pickup-tasks/:orderId/generate-receipt` | Generate pickup receipt |
| POST | `/riders/pickup-tasks/:orderId/drop-at-shop` | Drop at shop |
| GET | `/riders/pickup-tasks/:orderId/order-qr` | Order handover QR payload |
| POST | `/riders/pickup-tasks/:orderId/complete` | Complete pickup leg |
| GET | `/riders/delivery-offers` | Open delivery offers |
| GET | `/riders/delivery-tasks/:orderId` | Delivery task detail |
| POST | `/riders/delivery-offers/:orderId/accept` | Accept delivery |
| POST | `/riders/delivery-tasks/:orderId/reject` | Reject delivery task |
| POST | `/riders/delivery-tasks/:orderId/pickup-from-shop` | Pick up from shop |
| POST | `/riders/delivery-tasks/:orderId/out-for-delivery` | Out for delivery |
| POST | `/riders/delivery-tasks/:orderId/start` | Start delivery |
| POST | `/riders/delivery-tasks/:orderId/customer-received` | Customer received |
| POST | `/riders/delivery-tasks/:orderId/verify-customer-qr` | Verify customer via scanned QR |
| POST | `/riders/delivery-tasks/:orderId/arrive` | Arrived at customer |
| POST | `/riders/delivery-tasks/:orderId/photo-upload` | Upload delivery photo (multipart) |
| POST | `/riders/delivery-tasks/:orderId/photo` | Set delivery photo URL (legacy) |
| POST | `/riders/delivery-tasks/:orderId/collect-cash` | Record cash collected on delivery |
| POST | `/riders/delivery-tasks/:orderId/complete` | Complete delivery |
| POST | `/riders/sos/notify` | Notify dispatch of SOS |
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
| GET | `/admin/live-tracking` | Live rider tracking map data |
| GET | `/admin/orders` | All orders |
| GET | `/admin/quality-alerts` | Quality/SLA alerts |
| GET | `/admin/revenue` | Platform revenue |
| GET | `/admin/reports` | Analytics report |

### Riders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/riders` | Rider roster with verification status |
| POST | `/admin/riders` | Create rider account |
| GET | `/admin/riders/documents/pending` | Pending KYC document review queue |
| GET | `/admin/riders/withdrawals` | Rider withdrawal queue |
| POST | `/admin/riders/withdrawals/:id/approve` | Approve payout |
| POST | `/admin/riders/withdrawals/:id/reject` | Reject payout request |
| GET | `/admin/riders/:userId/cash-remittances` | Cash remittance history |
| POST | `/admin/riders/:userId/cash-remittances/verify` | Verify remittance |
| POST | `/admin/riders/:userId/wallet/hold` | Set admin hold on rider wallet |
| POST | `/admin/riders/:userId/earnings/credit` | Credit bonus or adjustment |
| GET | `/admin/riders/:userId/profile` | Rider profile + documents for review |
| PATCH | `/admin/riders/:userId/employment` | Update employment status |
| PATCH | `/admin/riders/:userId/documents/:type` | Approve/reject rider document |
| POST | `/admin/riders/announcement` | Broadcast announcement to riders |

### Shops & partners

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/shops` | Partner accounts |
| GET | `/admin/shops/:id/detail` | Shop detail |
| PATCH | `/admin/shops/:id` | Update shop |
| PATCH | `/admin/shops/:id/profile` | Update shop profile |
| POST | `/admin/partners` | Create partner |
| POST | `/admin/partners/onboard` | Onboard partner |
| GET | `/admin/partners/:partnerId/settlements` | Partner settlements |
| GET | `/admin/partners/:partnerId/unsettled-orders` | Unsettled orders |
| POST | `/admin/partners/:partnerId/settlements` | Create settlement |
| GET | `/admin/partners` | List partners |
| GET | `/admin/partners/:id` | Partner detail |
| PATCH | `/admin/partners/:id/branding` | Update branding |
| PATCH | `/admin/partners/:id/active` | Enable/disable partner |
| POST | `/admin/partners/:id/branding/assets/:field` | Upload branding asset |

### Setup & branches

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/setup/status` | Initial setup status |
| POST | `/admin/setup/init` | Run initial setup |
| POST | `/admin/setup/branch` | Create first branch |
| GET | `/admin/branches/parents` | Parent branch options |
| GET | `/admin/branches` | Branch list |
| GET | `/admin/branches/network` | Hierarchy tree |
| GET | `/admin/branches/:id/profile` | Branch profile |
| POST | `/admin/branches` | Create branch |
| PATCH | `/admin/branches/:id` | Update branch |
| PATCH | `/admin/branches/:id/main-shop` | Set main shop |
| PATCH | `/admin/branches/:id/pricing` | Update pricing |
| PATCH | `/admin/branches/:id/addon-pricing` | Update addon pricing |
| PATCH | `/admin/branches/:id/assigned-rider` | Assign default rider |
| POST/DELETE | `/admin/branches/:id/logo` | Branch logo |
| GET/PATCH | `/admin/branches/:id/custom-services[/:serviceId]` | Manage custom services |
| GET/PATCH | `/admin/branches/:id/custom-addons[/:addonId]` | Manage custom addons |

### Dispatch & operations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dispatch/dashboard` | Dispatch boards |
| GET | `/admin/dispatch/queue` | Pending dispatch queue |
| GET | `/admin/dispatch/orders/:orderId/suggestions` | Branch suggestions |
| POST | `/admin/dispatch/orders/:orderId/assign` | Assign shop to order |
| GET | `/admin/sos/active` | Active rider SOS incidents |
| PATCH | `/admin/sos/:id/resolve` | Acknowledge / resolve SOS incident |
| GET | `/admin/operations/orders/:orderId` | Order ops detail |
| GET | `/admin/operations/orders/:orderId/suggest-pickup-rider` | Pickup rider suggestions |
| POST | `/admin/operations/orders/:orderId/confirm-pickup-rider` | Confirm pickup rider |
| POST | `/admin/operations/orders/:orderId/assign-rider` | Direct rider assign |
| POST | `/admin/operations/orders/:orderId/reassign-rider` | Reassign rider |
| POST | `/admin/operations/orders/:orderId/dispatch-pickup` | Trigger pickup dispatch |
| GET | `/admin/operations/orders/:orderId/suggest-delivery-rider` | Delivery rider suggestions |
| POST | `/admin/operations/orders/:orderId/confirm-delivery-rider` | Confirm delivery rider |
| POST | `/admin/operations/orders/:orderId/flag-conflict` | Flag ops conflict |
| POST | `/admin/operations/orders/:orderId/resolve-conflict` | Resolve conflict |

### Support, refunds & tickets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/tickets` | Ticket list |
| GET | `/admin/tickets/:id` | Ticket detail |
| GET | `/admin/tickets/:id/investigation` | Lost-item investigation bundle |
| POST | `/admin/tickets/:id/investigate` | Advance investigation |
| PATCH | `/admin/tickets/:id` | Update status / priority / admin note |
| GET | `/admin/refunds` | Refund queue |
| GET | `/admin/refunds/:id` | Refund review bundle |
| POST | `/admin/refunds/:id/review` | Review workflow action |

### Catalog, promotions & service areas

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/promotions` | List promos |
| POST | `/admin/promotions` | Create promo |
| PATCH | `/admin/promotions/:id` | Update promo |
| GET | `/admin/services` | List laundry services |
| PATCH | `/admin/services/:id` | Update service |
| GET | `/admin/addons` | List booking add-ons |
| PATCH | `/admin/addons/:id` | Update add-on |
| POST | `/admin/addons/:id/image` | Upload add-on image |
| GET | `/admin/service-areas` | List service areas |
| POST | `/admin/service-areas` | Create service area |
| PATCH | `/admin/service-areas/:id` | Update service area |
| DELETE | `/admin/service-areas/:id` | Remove service area |

### Broadcast

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/broadcast` | Send platform broadcast |
| GET | `/admin/broadcast/audience-counts` | Preview audience size |
| GET | `/admin/broadcast/history` | Broadcast history |

### Incentive campaigns

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/incentive-campaigns` | List campaigns |
| POST | `/admin/incentive-campaigns` | Create campaign |
| PATCH | `/admin/incentive-campaigns/:id` | Update campaign |

### Ledger & audit

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/ledger/trial-balance` | Trial balance |
| GET | `/admin/ledger/reconciliation` | Reconciliation summary |
| GET | `/admin/ledger/accounting-overview` | Accounting overview |
| GET | `/admin/ledger/reconciliation/transactions` | Reconciliation transactions |
| GET | `/admin/audit-logs` | Audit log entries |
| GET | `/admin/audit-logs/actions` | Distinct action types |
| GET | `/admin/audit-logs/methods` | Distinct HTTP methods |

### Settings & maintenance

| Method | Path | Description |
|--------|------|-------------|
| GET/PATCH | `/admin/settings/delivery-fee` | Delivery fee config |
| GET/PATCH | `/admin/settings/automation` | Automation rules |
| GET/PATCH | `/admin/settings/rider-fees` | Rider fee config |
| GET/PATCH | `/admin/settings/app-version` | Minimum app version |
| GET | `/admin/maintenance/status` | Maintenance status |
| POST | `/admin/maintenance/seed` | Seed database |
| POST | `/admin/maintenance/reset` | Reset database |
| POST | `/admin/maintenance/run-script` | Run maintenance script |
| GET | `/admin/maintenance/backup` | Download backup |
| POST | `/admin/maintenance/restore` | Restore from backup (file upload) |

### Banners

| Method | Path | Description |
|--------|------|-------------|
| GET | `/banners` | Public/customer banner list (JWT, any role) |
| GET | `/admin/banners` | List banners |
| POST | `/admin/banners` | Create banner (image upload) |
| PATCH | `/admin/banners/:id` | Update banner |
| POST | `/admin/banners/:id/image` | Upload banner image |
| DELETE | `/admin/banners/:id` | Delete banner |

---

## App version

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/app-version` | Public | Current/minimum app version |

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
| `riderLocation` | rider | `{ orderId, riderId, latitude, longitude, lat, lng, speed?, heading?, timestamp? }` | Emit rider GPS every **15s** during active task (`riderId` must match JWT sub) |
| `sosLocation` | rider | `{ orderId, lat, lng, latitude?, longitude?, speed?, heading?, timestamp? }` | Emit SOS live location to dispatch every **3s** |
| `joinRider` | rider | `{ userId? }` | Join personal rider room |
| `joinRiders` | rider | — | Join online riders broadcast room |
| `joinAdminOperations` | admin | — | Join admin dispatcher room |
| `joinPartnerOperations` | partner | — | Join partner pipeline room |
| `joinBranch` | partner, staff, admin | `{ branchId }` | Join branch pipeline room |

### Server → client events

| Event | Description |
|-------|-------------|
| `locationUpdate` | `{ orderId, riderId, lat, lng, latitude, longitude, speed?, heading?, timestamp }` |
| `orderStatusUpdate` | `{ orderId, status }` |
| `orderEvent` | `{ orderId, event, message?, … }` lifecycle events |
| `pickupOffer` / `deliveryOffer` | Rider marketplace offers |
| `pickupAssignment` / `deliveryAssignment` | Rider task assignment |
| `dispatcherAlert` | Admin control-tower alert (ops queue or `type: rider_sos`) |
| `sosLocationUpdate` | Live rider GPS during SOS |
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

*Last updated: 2026-07-26 — reflects implemented routes in `apps/api`, including AI Agents, banners, ledger, audit logs, laundry tags, incentive campaigns, and messaging modules.*
</content>
