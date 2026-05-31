# Database Schema (MongoDB)

## users

| Field | Type | Notes |
|-------|------|-------|
| email | string | sparse unique |
| phone | string | sparse unique |
| passwordHash | string | optional (OTP-only users) |
| role | enum | customer, rider, partner, staff, admin |
| isActive | boolean | |
| lastLoginAt | date | |

## customers

Extends user profile: `firstName`, `lastName`, `avatarUrl`, `loyaltyPoints`, `userId` (ref users).

## partners

Shop profile: `name`, `address`, `ownerId`, `staffIds[]`, `operatingHours`, `rating`.

## riders

`userId`, profile/KYC fields, `vehicleType`, `isOnline`, `currentLocation` (GeoJSON), location telemetry (`lastLocationSpeed`, `lastLocationHeading`, `lastLocationRecordedAt`), earnings counters (`totalEarnings`, `todayEarnings`, `recentEarnings[]`), wallet fields (`walletBalance`, `pendingHold`, `payoutMethod`, GCash/Maya/bank account details).

## rider_wallet_transactions

Ledger for rider wallet: `riderUserId`, `type` (`credit`|`debit`|`hold`|`release`), `amount`, `reference` (unique per rider), `description`.

## rider_withdrawals

Payout requests: `riderUserId`, `amount`, `method` (`gcash`|`maya`|`bank`), payout snapshot fields, `status` (`pending`|`approved`|`rejected`|`paid`), `adminNote`, `processedBy`, `processedAt`.

## orders

See `apps/api/src/modules/orders/schemas/order.schema.ts`. Indexed: `customerId`, `status`, `partnerId`, `createdAt`.

## order_items

Embedded in orders or separate collection for complex pricing.

## payments

`orderId`, `method` (gcash|maya|stripe|wallet|cash), `status`, `amount`, `externalId`.

## wallets / transactions

Per-user wallet with ledger-style transactions.

## addresses

`userId`, address fields, `isDefault`, optional `latitude`/`longitude`.

## notifications

`userId`, `title`, `body`, `channel`, `read`, `data`.

## reviews

`orderId`, `customerId`, `partnerId`, `rating`, `comment`.

## coupons / loyalty_points / inventory / attendance / audit_logs / settings

As specified in `prompt.md` — implement per domain module in Phase 2+.

## Indexes (recommended)

```js
db.orders.createIndex({ customerId: 1, createdAt: -1 });
db.orders.createIndex({ status: 1, partnerId: 1 });
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ phone: 1 }, { unique: true, sparse: true });
```
