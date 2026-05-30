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

`userId`, `vehicleType`, `isOnline`, `currentLocation` (GeoJSON), `earnings`.

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
