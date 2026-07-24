# Audit: Customer-web — FAQ

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/faq/page.tsx` (server component, no `'use client'` anywhere in the tree)
- Component(s): `components/marketing/faq-list.tsx` (`FaqList`, `FaqCategoryNav`)

## Sub-pages
None — no outbound navigation into a dynamic detail route. Every link inside
an FAQ answer (`item.links[]`) points to a static sibling route within this
same marketing route group (`/signup`, `/locations`, `/login`, `/privacy`,
`/partners`, `/riders`) — all confirmed to exist as real pages, not a detail
view of this page's own data.

## Data flow
None — this page has no network call at all, server or client. All content
comes from the bundled `FAQ_CATEGORIES` constant
(`components/marketing/faq-data.ts`).

## Backend trace
Not applicable — no backend involved.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Hero stat row | static (`HelpCircle`/`Clock`/`Mail` icons + `appConfig.supportEmail`) | |
| Category nav pills | `FAQ_CATEGORIES[].id/label` | anchor links (`#category-id`) to the matching section below, not a route change |
| FAQ categories + items | `FAQ_CATEGORIES[].label/description`, `.items[].question/answer/links` | each item renders as a native `<details>` disclosure; `links` (optional) render as extra in-answer CTA links |
| "Still need help?" CTA | `appConfig.supportEmail` (mailto link + pre-filled subject) | |

## Mutations
None.

## Authorization
No role-scoped access — a fully public, unauthenticated static page. Not applicable.

## Findings
No issues found. `HOME_FAQS` (the homepage's FAQ teaser, audited in
`docs/audits/customer-web/marketing-home.md`) is correctly *derived* from
this same `FAQ_CATEGORIES` array via a filtered `id` allowlist
(`home-page-data.ts:394-405`) rather than being a separately hand-maintained
duplicate — confirmed all 5 allowlisted ids (`book-pickup`,
`pickup-lead-time`, `track-order`, `service-areas`, `weight-estimate`)
exist in `FAQ_CATEGORIES`, so there's no silent drift or typo dropping an
item from the homepage teaser. Single source of truth, no duplication risk.

## Unused/dead fields
Not applicable — no API payload to diff against.

## Loading/error/realtime behavior
Not applicable — no fetch, so no loading/error/empty states to handle. No
polling or realtime subscription.
