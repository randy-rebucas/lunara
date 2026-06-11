# Feature: New-user and expiring promotions

> **Status:** shipped  
> **Date:** 2026-06-11

## Summary

Promotions now support audience targeting (all vs new customers), campaign start/end dates, per-customer usage limits, and automatic personal signup codes granted at registration. Customers see eligible deals on the dashboard/home; expired or ineligible promos are hidden or rejected at checkout.

## Affected apps

| App | Wired? | Notes |
|-----|--------|-------|
| `api` | yes | Audience validation, signup grants, redemption tracking |
| `admin-web` | yes | Create promos with dates, audience, kind, usage limits |
| `customer-web` | yes | Personal deal badge, expiry labels |
| `customer-mobile` | yes | Personal deal badge, expiry labels |
| `partner-web` | N/A | |
| `rider-mobile` | N/A | |

## Shared packages

- [x] `@lunara/types` — `PromotionAudience`, `PromotionKind`, extended `Deal`, `CustomerPromo`
- [x] `@lunara/utils` — `validatePromotionForCustomer`, `formatDealExpiry`, `generateSignupPromoCode`

## API changes

- **Schema:** `promotions` gains `audience`, `kind`, `maxUsesPerCustomer`, `newCustomerWithinDays`
- **Collections:** `customer_promos`, `promotion_redemptions`
- **Auth:** `register` and OTP first-time login call `grantSignupPromo`
- **GET `/deals`:** Customer-scoped list (shared + personal unredeemed code)
- **POST `/booking/quote`**, **POST `/booking/orders`:** Enforce audience, expiry, and usage limits via `userId`
- **Admin POST/PATCH `/admin/promotions`:** New optional fields

## Seed promos

| Code | Kind | Audience | Notes |
|------|------|----------|-------|
| `WELCOME10` | standard | new_customers | 10% off, 1 use, 30-day signup window |
| `SIGNUP15` | signup_template | — | Grants personal `LUN…` codes (15% off, 14-day expiry) |
| `FREEDEL50` | standard | all | ₱50 off, min ₱500 |
| `FLASH50` | standard | all | Expires ~30 days after seed |

## How to verify locally

1. `docker compose up -d` and `npm run seed --workspace=@lunara/api` (or `npm run seed:promotions --workspace=@lunara/api` to refresh only the promo catalog)
2. Register a **new** customer (OTP or register flow)
3. Dashboard/home → personal `LUN…` deal with “Just for you” and expiry date
4. Book with personal code → discount applied; order stores `couponCode`
5. Apply `WELCOME10` once → succeeds; second order with same code → rejected
6. Wait or set `endsAt` in past on `FLASH50` in admin → deal hidden from `/deals`
7. Admin → Promotions → create promo with `endsAt` and `new_customers` audience

## Out of scope

- Auto-apply at checkout without entering code
- Admin view of individual `customer_promos`
- Global redemption cap across all customers
