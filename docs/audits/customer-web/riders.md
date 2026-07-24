# Audit: Customer-web — Riders

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/riders/page.tsx` (server component, static)
- Component(s): `MarketingContentPage`, `MarketingFeatureCard`, `MarketingInfoCard`, `MarketingSectionIcon`, `MarketingCtaPanel`, `MarketingBackLink`, `MarketingActions`, `ButtonLink`, `MarketingStatRow`

## Sub-pages
None — `/riders/apply` and `/faq` are sibling marketing pages linked via CTA buttons, not a detail view of this page's own data.

## Data flow
None — no network call at all. All content is the bundled `PERKS`/`STEPS` constants.

## Backend trace
Not applicable — no backend involved.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Hero stat row | static (`Bike`/`MapPin`/`Wallet` icons + hardcoded copy) | |
| Perks grid | `PERKS[].title/description` (static) | |
| "How onboarding works" list | `STEPS[]` (static) | |
| Join CTA panel | static copy, links to `/riders/apply` and `/faq` | |

## Mutations
None.

## Authorization
No role-scoped access — fully public, unauthenticated static page. Not applicable.

## Findings
No issues found. Entirely static marketing content, no data flow to audit.

## Unused/dead fields
Not applicable — no API payload to diff against.

## Loading/error/realtime behavior
Not applicable — no fetch, so no loading/error/empty states. No polling or realtime subscription.
