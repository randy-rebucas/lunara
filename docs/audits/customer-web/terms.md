# Audit: Customer-web — Terms

Date: 2026-08-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/terms/page.tsx` (server component, static)
- Component(s): `PublicShell`

## Sub-pages
None — links to `mailto:`, `/support` (an authenticated-app route, not a detail view of this page's own data), and `/privacy` (its own separate audited page, see `docs/audits/customer-web/privacy.md`).

## Data flow
None — static legal copy only, `LAST_UPDATED` is a hardcoded string constant (`'June 8, 2026'`).

## Backend trace
Not applicable — no backend involved.

## Cards / panels
Not applicable — this is prose content (`PublicShell` wrapping headings/paragraphs/lists), not widget/card-based.

## Mutations
None.

## Authorization
No role-scoped access — fully public, unauthenticated static page. Not applicable.

## Findings
No issues found. Entirely static legal content, no data flow to audit. Cross-links to `/privacy` and `/support` both resolve to real routes (`apps/customer-web/src/app/(marketing)/privacy/page.tsx` and `apps/customer-web/src/app/(authenticated)/support/`).

## Unused/dead fields
Not applicable — no API payload to diff against.

## Loading/error/realtime behavior
Not applicable — no fetch, so no loading/error/empty states. No polling or realtime subscription.

## UI/UX notes
- Uses the shared `PublicShell` component (same as `/privacy`), so heading hierarchy, badge, and prose typography are consistent with the rest of the legal-page pair — no bespoke styling reinvented here.
- Content structure (h2 sections, ul/li lists) gives good visual hierarchy and scanability for a long legal document; no changes needed.
- Links (`mailto:`, `/support`, `/privacy`) use plain default link styling inherited from prose (`<a>`/`<Link>` with no explicit class) rather than the site's `link-primary` utility used elsewhere in marketing pages (e.g. `faq/page.tsx`, `privacy/page.tsx` — both have the same unstyled-link pattern via `PublicShell`'s prose wrapper). This is consistent between terms and privacy, so not a one-off inconsistency, but both differ slightly from the rest of the marketing surface. Cosmetic only, left as-is since `PublicShell`'s prose styling is shared and intentional for legal content.
- No images/icons on this page, so no alt-text or contrast concerns beyond the shared shell (already covered by the `MarketingShell`/`PublicShell` audit surface via other pages in this group).
- Responsive: prose content and `marketing-container` wrapper (inherited from `PublicShell`) already handle narrow viewports correctly, matching `/privacy`.
