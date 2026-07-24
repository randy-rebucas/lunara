# Audit: Customer-web — Marketing home

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/page.tsx` (server component — SEO metadata + JSON-LD only)
- Component(s): `components/marketing/home-page.tsx` (`HomePage`, client component — the actual fetch/render logic)

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `(marketing)/service-areas/[id]/page.tsx` | "Founding partners" strip links, `home-page.tsx:274`; "Service areas" section cards, `home-page.tsx:555` | `branch.id` -> `id` route param | yes — see Backend trace for the fallback-chain nuance that makes this hold even in the degraded case |

Also noting a separate, unrelated route found during a full-app gap sweep:
`(marketing)/marketing/page.tsx` is a 3-line `LegacyMarketingPage` that does
nothing but `redirect('/')` — i.e. back to this same home page. Grepped the
whole `customer-web` app for any link to `/marketing` and found none, so it's
an orphaned leftover (the same pattern as rider-mobile's `history.tsx` redirect
shim) rather than a live entry point. Harmless — a working redirect to a known
page — so left in place rather than deleted, since its external reachability
(an old bookmark, an external link) wasn't fully ruled out.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Live service areas | GET | `{apiBase}/public/branches` | `ServiceArea[]` (via `toServiceArea` mapping) | `PublicBranchesController.list` -> `BranchesService.listPublicBranches` |
| Onboarding status (authenticated visitors only) | — (via `fetchOnboardingStatus(api)`, shared `@lunara/hooks` helper, not traced further — shared auth infra) | — | — | — |
| (sub-page) Single branch detail | GET | `{apiBase}/public/branches/:id` | `ServiceArea` | `PublicBranchesController.getOne` -> `BranchesService.getPublicBranchById` |

## Backend trace
Both public-branch endpoints are intentionally unauthenticated
(`PublicBranchesController`, class comment: "No auth — consumed by the
public marketing site"). `listPublicBranches` selects only
`name city province serviceRadiusKm logoUrl machines` — no owner/staff at
all for the list view. `getPublicBranchById` additionally fetches the
branch's owner (`UserProfile` — `displayName`/`avatarUrl` only, no
phone/email) and active staff (same reduced shape) and sibling branches
under the same partner — explicitly commented "Marketing-safe detail." This
is the right shape for a public page: confirmed no phone/email/address PII
leaks through either endpoint.

**Fallback chain (deliberate, not a bug):** `HomePage` renders from a
hardcoded `SERVICE_AREAS` static array (id/name/city/area/radiusKm for 3
seed branches) on first paint, then replaces it with the live fetch result
in a `useEffect` — good for fast first paint and SEO crawlers, with the
static array purely a fallback. `fetchActiveServiceAreas`/
`fetchServiceAreaById` both independently fall back to searching that same
static array on any fetch failure. Traced the id-space concern this creates:
the static array's ids are hand-picked slugs (`'lunara-makati'`, etc.), not
Mongo ObjectIds — if the homepage falls back to static data, its
service-area links use those slug ids; the detail sub-page's own fetch
(`getPublicBranchById`) would reject a non-ObjectId id with `NotFoundException`,
but `fetchServiceAreaById` catches that and falls through to searching the
*same* static array by id — so slug-id links always resolve correctly via
the matching fallback, confirmed not a broken-link bug. The only unhandled
edge case is the reverse mismatch (live homepage data, but the detail page's
own live fetch transiently fails) — low-probability, graceful "not found"
rather than a crash, not flagged as a bug.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Hero | static copy, `TRUST_CHIPS` (static) | |
| Founding partners strip | `serviceAreas.slice(0, 4)` — `.id`, `.name` | |
| Features / How it works / App showcase / Partner growth / Pricing / FAQ / Join strip | `FEATURES`/`HOW_IT_WORKS`/`PARTNER_BENEFITS`/`PRICING_TIERS`/`HOME_FAQS` — all static content, no live data | |
| Reviews + stats | `CUSTOMER_REVIEWS` (static), `STATS` (static — hardcoded "1,000+ Orders completed", "50+ Partner laundry shops", etc.) | these numbers are hand-maintained marketing copy, not sourced from any live count endpoint — a normal pattern for marketing stats, not flagged as a data-flow bug, but will silently go stale as the real business grows unless someone remembers to update the constant |
| Service areas section | `serviceAreas.slice(0, 3)` — `.id`, `.name`, `.city`, `.area`, `.radiusKm`; `EXPANDING_AREAS` (static "coming soon" city list) | |
| Download app banner | static, plus a real QR code encoding the Play Store URL | iOS badge is deliberately disabled ("Coming soon") — matches there being no live iOS listing |

## Mutations
None — this page is entirely read-only marketing content, aside from the
client-only Google Play QR modal toggle (no network call).

## Authorization
No role-scoped access — both `/public/branches` endpoints are deliberately unauthenticated by design, and confirmed to return only marketing-safe fields (no PII beyond a display name/avatar already meant for public "meet the team" presentation). The authenticated-visitor redirect (`fetchOnboardingStatus`/`router.replace`) only fires for users who are *already* signed in, sending them to their onboarding step instead of showing marketing content — not a data-exposure concern, just a UX routing decision. No `[authz]` issues.

## Findings
No issues found. Both the public data endpoints and the static-data fallback
chain are deliberately and correctly designed for a marketing page that
needs to render fast, work for SEO crawlers, and degrade gracefully if the
API is slow or briefly unavailable.

## Unused/dead fields
None found — every field `ServiceArea` can carry (`machines`, `owner`,
`staff`, `branches`) is optional and only used by the detail sub-page, which
reads all of them; the homepage itself only needs `id`/`name`/`city`/`area`/
`radiusKm`, all of which are used.

## Loading/error/realtime behavior
The live service-areas fetch has no loading state of its own — the static
array is shown immediately and silently swapped for live data once it
resolves (no flash-of-loading, reasonable for a marketing page). A failed
fetch is caught and falls back to the static array rather than surfacing an
error — appropriate here, since showing something plausible beats showing
an error banner on a marketing page. No polling or realtime subscription.
