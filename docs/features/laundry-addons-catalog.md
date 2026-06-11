# Feature: Laundry booking add-ons catalog

> **Status:** shipped  
> **Date:** 2026-06-11

## Summary

Booking add-ons (fabric softener, stain treatment, etc.) are stored in MongoDB with seeded SVG images. Admins manage pricing, images, and availability from admin-web; customer booking reads active add-ons from the API catalog.

## Affected apps

| App | Wired? | Notes |
|-----|--------|-------|
| `api` | yes | `laundry_addons` collection, catalog service, admin routes, static image hosting |
| `admin-web` | yes | `/addons` board — edit pricing, image URL, toggle active |
| `customer-web` | yes | Add-ons step shows images from catalog |
| `customer-mobile` | yes | Same add-on images in booking flow |
| `partner-web` | N/A | |
| `rider-mobile` | N/A | |

## Shared packages

- [x] `@lunara/utils` — `BookingAddonOption.imageUrl`, `calculateQuote()` accepts optional addon catalog override

## API changes

- **Routes:** `GET /admin/addons`, `PATCH /admin/addons/:id` — admin only
- **Booking:** `GET /booking/config` add-ons list from `laundry_addons` (active only)
- **Static:** `/api/v1/uploads/catalog-addons/*.svg` — public catalog images
- **Seed:** `npm run seed:addons` upserts 4 default add-ons and writes SVG assets

## Client changes

### admin-web
- Nav **Add-ons** → `/addons`
- Table with image preview, slug, price, sort order, active toggle, edit form (including image URL)

### customer-web / customer-mobile
- Add-ons step displays thumbnail + label + price from config

## How to verify locally

1. `npm run seed:addons --workspace=@lunara/api`
2. Start API and admin-web; open **Add-ons** as admin
3. Start customer-web; book laundry → **Add-ons** step shows 4 items with icons
4. Deactivate an add-on in admin; confirm it disappears from customer booking config

## Out of scope / follow-ups

- Admin file upload for add-on images (image URL field only; seed writes SVGs to disk)
- Per-service add-on availability rules
