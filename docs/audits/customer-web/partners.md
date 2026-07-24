# Audit: Customer-web — Partners

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/partners/page.tsx` (server component, static)
- Component(s): `MarketingContentPage`, `MarketingFeatureCard`, `MarketingInfoCard`, `MarketingSectionIcon`, `MarketingCtaPanel`, `MarketingBackLink`, `MarketingActions`, `ButtonLink`, `MarketingStatRow`

## Sub-pages
None — `/partners/apply` and `/locations` are sibling marketing pages linked
via CTA buttons, not a detail view of this page's own data.

## Data flow
None — no network call at all. All content is the bundled `BENEFITS`/`REQUIREMENTS` constants.

## Backend trace
Not applicable — no backend involved.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Hero stat row | static (`Building2`/`MapPin`/`Truck` icons + hardcoded copy) | "50+ partner laundry shops" is hand-maintained marketing copy, same pattern already noted (not flagged) for the homepage's `STATS` constant in `marketing-home.md` |
| Benefits grid | `BENEFITS[].title/description` (static) | |
| "What we look for" list | `REQUIREMENTS[]` (static) | |
| Apply CTA panel | static copy, links to `/partners/apply` and `/locations` | |

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
