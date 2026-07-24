# Audit: Customer-web — Privacy

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/privacy/page.tsx` (server component, static)
- Component(s): `PublicShell`

## Sub-pages
None — links to `mailto:` and `/support` (an authenticated-app route, not a detail view of this page's own data).

## Data flow
None — static legal copy only, `LAST_UPDATED` is a hardcoded string constant.

## Backend trace
Not applicable — no backend involved.

## Cards / panels
Not applicable — this is prose content (`PublicShell` wrapping headings/paragraphs/lists), not widget/card-based.

## Mutations
None.

## Authorization
No role-scoped access — fully public, unauthenticated static page. Not applicable.

## Findings
No issues found. Entirely static legal content, no data flow to audit.

## Unused/dead fields
Not applicable — no API payload to diff against.

## Loading/error/realtime behavior
Not applicable — no fetch, so no loading/error/empty states. No polling or realtime subscription.
