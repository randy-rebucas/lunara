# Feature: [Short title]

> **Status:** draft | in progress | shipped  
> **Date:** YYYY-MM-DD  
> **Author / PR:** [optional link]

## Summary

One to three sentences: what this feature does and why it exists.

## Affected apps

| App | Wired? | Notes |
|-----|--------|-------|
| `api` | yes / no | |
| `admin-web` | yes / no / N/A | |
| `partner-web` | yes / no / N/A | |
| `customer-web` | yes / no / N/A | |
| `customer-mobile` | yes / no / N/A | |
| `rider-mobile` | yes / no / N/A | |

## Shared packages

- [ ] `@lunara/types` — …
- [ ] `@lunara/validation` — …
- [ ] `@lunara/utils` — …
- [ ] `@lunara/hooks` — …
- [ ] Other — …

## API changes

- **Routes:** `METHOD /path` — role(s), brief behavior
- **Events / realtime:** (if any)
- **Migrations / seed:** (if any)

## Client changes

### admin-web
- …

### partner-web
- …

### customer-web
- …

### customer-mobile
- …

### rider-mobile
- …

## How to verify locally

1. Start infrastructure: `docker compose up -d`
2. Seed: `npm run seed --workspace=@lunara/api`
3. Run API and relevant apps
4. Step-by-step manual test:
   - …

## Out of scope / follow-ups

- …
