# Feature Summaries

Per-feature documentation for changes that touch the API and one or more client apps. Use this index when reviewing what was wired and how to test it.

## When to add an entry

Add a summary when you:

- Add or change API endpoints used by clients
- Ship new user-facing flows on any app
- Change shared types, validation, or RBAC that affects multiple surfaces

Skip for typo fixes, refactors with no behavior change, or internal-only tooling.

## How to document

1. Copy [`_TEMPLATE.md`](./_TEMPLATE.md) to `<feature-slug>.md` (kebab-case, e.g. `lost-item-complaints.md`)
2. Fill in affected apps, API routes, and local verification steps
3. Add a row to the table below
4. Update [`../API_ENDPOINTS.md`](../API_ENDPOINTS.md) for route changes

See [`../FEATURE_WIRING.md`](../FEATURE_WIRING.md) for the full wiring workflow.

## Index

| Feature | Date | Apps | Doc |
|---------|------|------|-----|
| Promo code redemption | 2026-06-11 | api, customer-web, customer-mobile | [promo-redemption.md](./promo-redemption.md) |
| New-user & expiring promos | 2026-06-11 | api, admin-web, customer-web, customer-mobile | [promo-audience-expiry.md](./promo-audience-expiry.md) |
| Laundry services catalog | 2026-06-11 | api, admin-web, customer-web, customer-mobile | [laundry-services-catalog.md](./laundry-services-catalog.md) |
| Laundry add-ons catalog | 2026-06-11 | api, admin-web, customer-web, customer-mobile | [laundry-addons-catalog.md](./laundry-addons-catalog.md) |
