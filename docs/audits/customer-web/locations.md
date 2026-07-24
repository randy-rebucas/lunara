# Audit: Customer-web — Locations

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/locations/page.tsx` (server component — fetches directly, no client-side hook)
- Component(s): `MarketingShell`, `MarketingHeroGlow`, `MarketingStatRow`, `MarketingSectionIcon`, `MarketingCtaPanel`, `MarketingBackLink`, `MarketingActions`, `ButtonLink`

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `(marketing)/service-areas/[id]/page.tsx` | branch card link, `locations/page.tsx:74` | `branch.id` -> `id` route param | yes — same `ServiceArea.id` already traced in `docs/audits/customer-web/marketing-home.md`, same fallback-chain guarantee applies (this page and the homepage share the exact same `fetchActiveServiceAreas`/`toServiceArea` helpers) |

Already-audited detail page, not re-traced here — see `marketing-home.md` for the full backend trace, PII check, and id-fallback analysis of `/public/branches/:id`, which applies identically since both entry points link into the same sub-page with the same id shape.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Active branches | GET | `{apiBase}/public/branches` (via `fetchActiveServiceAreas`, server-side `fetch` with `next: { revalidate: 60 }`) | `ServiceArea[]` | `PublicBranchesController.list` -> `BranchesService.listPublicBranches` |

## Backend trace
Same unauthenticated `/public/branches` endpoint already traced in
`docs/audits/customer-web/marketing-home.md` — selects only
`name city province serviceRadiusKm logoUrl machines`, no owner/staff/PII at
the list level. Nothing new to trace here; this page is a second consumer of
the identical shared helper (`fetchActiveServiceAreas`), just called
server-side (Next.js `fetch` with a 60s ISR-style revalidate) instead of
client-side in a `useEffect` the way the homepage does it — a reasonable
difference since this page has no "fast first paint before hydration"
requirement the homepage has (no hero animation gated on client JS), and it
gets the same graceful static-array fallback on any fetch failure or empty
result.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Hero stat row | `serviceAreas.length`, `cityCount` (derived: `new Set(serviceAreas.map(b => b.city)).size`), `avgRadius` (derived: mean of `.radiusKm`, rounded) | all three stats are computed client-... actually server-computed at request time from the same fetch, not separately fetched — no drift risk |
| Branch cards | `.id`, `.name`, `.province`, `.area`, `.radiusKm`, `.logoUrl` (via `resolveMediaUrl`) | `.city` is fetched but not directly rendered here — it's folded into `.area` (`${city}, ${province}` per `toServiceArea`), so not dead, just pre-composed |
| "Expanding soon" panel | `EXPANDING_AREAS` (static) | |
| Coverage CTA panel | static copy, both buttons link to `/signup` | |

## Mutations
None — read-only marketing page.

## Authorization
No role-scoped access — `/public/branches` is deliberately unauthenticated and already confirmed (in `marketing-home.md`) to return only marketing-safe fields at the list level. No `[authz]` issues.

## Findings
No issues found. This page is a thin, correctly-scoped second consumer of
the same shared service-area data/fallback logic already audited for the
homepage — same id-space guarantee into the same detail sub-page, same
PII-safe endpoint, no divergence introduced.

## Unused/dead fields
`machines`/`owner`/`staff`/`branches` on `ServiceArea` are present on the
type but unused by this page (as with the homepage) — expected, since
they're detail-only fields the list endpoint doesn't even populate for
`owner`/`staff`. Not a finding.

## Loading/error/realtime behavior
No client-side loading state — this is a server component, so the page
doesn't render until the fetch (or its fallback) resolves; Next.js's
`revalidate: 60` gives background revalidation without a full client
loading spinner. A failed fetch silently falls back to the static
`SERVICE_AREAS` array rather than showing an error, matching the same
deliberate degrade-gracefully behavior already confirmed for the homepage.
No polling or realtime subscription.
