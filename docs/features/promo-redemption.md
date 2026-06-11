# Feature: Promo code redemption

> **Status:** shipped  
> **Date:** 2026-06-11

## Summary

Customers can apply admin-managed promo codes during booking. The API validates active promotions, enforces minimum order amounts, computes percent or fixed discounts on quotes, and persists the applied code and discount on the order before payment.

## Affected apps

| App | Wired? | Notes |
|-----|--------|-------|
| `api` | yes | Quote + order creation apply promos; orders store `couponCode` |
| `admin-web` | N/A | Existing promotions CRUD unchanged |
| `partner-web` | N/A | |
| `customer-web` | yes | Promo field on review step; `/book?code=` deep link |
| `customer-mobile` | yes | Promo field on review step; deal carousel passes code |
| `rider-mobile` | N/A | |

## Shared packages

- [x] `@lunara/types` — `Order.couponCode`
- [x] `@lunara/validation` — `bookingQuoteSchema`, `createBookingOrderSchema`
- [x] `@lunara/utils` — `promotions.ts` (validate, compute, apply); share URLs include `?code=`
- [ ] `@lunara/hooks` — N/A

## API changes

- **Routes:** `POST /booking/quote?addressId=` — optional `couponCode` in body; returns discount fields on quote
- **Routes:** `POST /booking/orders` — optional `couponCode`; server re-validates and stores on order
- **Schema:** `orders.couponCode` (uppercase)
- **Module:** `PromotionsService` validates promos against `promotions` collection

## Client changes

### customer-web
- `PromoCodeField` on booking review step
- `BookingWizard` accepts `initialCouponCode` from `/book?code=WELCOME10`
- Quote breakdown shows applied promo title and code

### customer-mobile
- Promo apply/remove on review step
- Deal carousel navigates to `/book` with `code` param
- Estimate shows discount line when applied

## How to verify locally

1. Start infrastructure: `docker compose up -d`
2. Seed: `npm run seed --workspace=@lunara/api`
3. Run API, `customer-web`, and/or `customer-mobile`
4. Manual test:
   - Sign in as customer (`+639171234567` / OTP from API logs in dev)
   - Open dashboard deals or use code `WELCOME10` (10% off, min ₱200 subtotal)
   - Book wash & fold with ~5 kg (₱400 subtotal) → apply code → discount ₱40
   - Complete order → checkout total matches discounted quote
   - Try invalid/expired code → error message
   - Try `FREEDEL50` below ₱500 subtotal → minimum order error

## Out of scope / follow-ups

- Per-customer or one-time-use promo limits (e.g. “first order only”)
- `discountTarget` (subtotal vs delivery-only) field on promotions
- Partner-facing promo reporting
