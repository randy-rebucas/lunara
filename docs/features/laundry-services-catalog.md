# Feature: Laundry services catalog

> **Status:** shipped  
> **Date:** 2026-06-11

## Summary

Laundry booking services (pricing, labels, availability) are stored in MongoDB and seeded with defaults. Admins manage them from admin-web; customer booking quotes and config read active services from the API catalog instead of hardcoded utils.

## Affected apps

| App | Wired? | Notes |
|-----|--------|-------|
| `api` | yes | `CatalogModule`, booking integration, admin routes |
| `admin-web` | yes | `/services` board — edit pricing, toggle active |
| `partner-web` | N/A | |
| `customer-web` | yes | Via `GET /booking/config` (unchanged client contract) |
| `customer-mobile` | yes | Same booking config endpoint |
| `rider-mobile` | N/A | |

## Shared packages

- [x] `@lunara/utils` — `calculateQuote()` accepts optional `serviceOverride` for DB-backed pricing
- [ ] `@lunara/types` — `BookingType` enum unchanged; service rows use existing types

## API changes

- **Routes:** `GET /admin/services`, `PATCH /admin/services/:id` — admin only
- **Booking:** `GET /booking/config` services list sourced from `laundry_services` collection (active only)
- **Seed:** `npm run seed:services` upserts 9 default types (3 active: Wash & Fold, Wash Dry & Fold, Dry Cleaning)

## Client changes

### admin-web
- Nav link **Services** → `/services`
- Table: type, label, price/kg, min weight, sort order, active toggle, inline edit form

### customer-web / customer-mobile
- No UI changes; booking wizard still uses `/booking/config` services array

## How to verify locally

1. Start infrastructure: `docker compose up -d`
2. Seed: `npm run seed:services --workspace=@lunara/api` (or full `npm run seed --workspace=@lunara/api`)
3. Run API and admin-web
4. Sign in as `admin@lunara.dev` / `password123`
5. Open **Services** — confirm 9 rows, 3 active
6. Edit a price or deactivate a service; confirm customer booking config reflects changes after refresh

## Out of scope / follow-ups

- `SERVICE_AREAS` in `@lunara/utils` still lists hardcoded `BookingType[]` per area — newly activated service types may not appear in Metro Manila until area config is updated
- Admin cannot create new booking types (enum-fixed); use seed script to restore defaults
