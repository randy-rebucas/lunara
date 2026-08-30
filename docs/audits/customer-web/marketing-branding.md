# Audit: Customer-web — Marketing Pages (public, unauthenticated) + Branding

Date: 2026-08-30

## Entry point
- Pages (all under `apps/customer-web/src/app/(marketing)/`):
  - `page.tsx` (home)
  - `about/page.tsx`
  - `blog/page.tsx`
  - `blog/[slug]/page.tsx`
  - `faq/page.tsx`
  - `how-it-works/page.tsx`
  - `locations/page.tsx`
  - `service-areas/[id]/page.tsx`
  - `privacy/page.tsx`, `terms/page.tsx`
- All server components (Next.js 15 App Router, `async function Page()` where data is fetched).
- Shared shell/components: `components/marketing/marketing-shell.tsx`, `marketing-design.tsx`,
  `marketing-content-page.tsx`, `home-page-data.ts`, `blog-data.ts`, `faq-data.ts`.
- Branding: `packages/brand` (icon asset only) + `@lunara/config`'s `appConfig` (name, support
  email, etc.), consumed in `app/layout.tsx`, `app/manifest.ts`, `lib/seo.tsx`.

Note: `locations.md`, `marketing-home.md`, `faq.md`, `privacy.md`, and `terms.md` (dated
2026-07-23) already cover the home page, locations list, FAQ, and legal pages individually. This
doc is a fresh combined pass across the whole marketing surface, re-verifying those and adding
the pages that had no prior doc: `about`, `blog`, `blog/[slug]`, `how-it-works`,
`service-areas/[id]`, plus the `@lunara/brand` package.

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `blog/[slug]/page.tsx` | blog card `<Link href={`/blog/${post.slug}`}>`, `blog/page.tsx:62` | `post.slug` -> `slug` route param | yes — `fetchBlogPostBySlug(apiBase, slug)` hits `GET /blog/:slug` |
| `service-areas/[id]/page.tsx` | branch/sibling `<Link href={`/service-areas/${primary.id}`}>` in `locations/page.tsx:101,120` and sibling branches in `service-areas/[id]/page.tsx:183` | `branch.id` -> `id` route param | yes — `fetchServiceAreaById(apiBase, id)` hits `GET /public/branches/:id` |

Both sub-pages are thin detail views of the same data source as their parent list, so they stay
in this doc rather than getting separate ones.

**`blog/[slug]`**: fetches the full post (`content`, full metadata) that the list page never
loaded — correct, no redundant re-fetch. No client component / realtime behavior; `notFound()` is
called when the slug doesn't resolve or the post isn't published (404, not silently empty).

**`service-areas/[id]`**: fetches machines, owner, staff, and sibling branches that
`locations/page.tsx` never loaded (the list only has name/city/radius/logo) — no redundant
re-fetch. `notFound()` on missing/inactive branch. No realtime behavior.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Blog list | GET | `/blog` | `BlogPost[]` (`blog-data.ts`) | `BlogController.listPublished` -> `BlogService.listPublished` |
| Blog detail | GET | `/blog/:slug` | `BlogPost` | `BlogController.getBySlug` -> `BlogService.getPublishedBySlug` |
| Service areas list | GET | `/public/branches` | `ServiceArea[]` (`home-page-data.ts`) | `PublicBranchesController.list` -> `BranchesService.listPublicBranches` |
| Service area detail | GET | `/public/branches/:id` | `ServiceArea` | `PublicBranchesController.getOne` -> `BranchesService.getPublicBranchById` |
| Featured reviews (home page) | GET | `/public/reviews/featured` | `CustomerReview[]` | (reviews module — out of this module's scope, only referenced from `home-page-data.ts`) |
| FAQ | static | n/a | `FaqItem[]` from `faq-data.ts` | none — hardcoded content, no backend call |
| About, How it works | static | n/a | hardcoded arrays (`VALUES`, `HOW_IT_WORKS`, `PRICING_TIERS`) | none |
| Privacy, Terms | static | n/a | hardcoded JSX | none — confirmed no fetch, no dynamic content |

## Backend trace
- **Blog** (`apps/api/src/modules/blog/blog.service.ts`): `listPublished()` queries
  `{ isPublished: true }` sorted by `publishedAt desc`, with an explicit `.select('title slug
  excerpt coverImageUrl authorName publishedAt')` — correctly excludes `content` (full body,
  unneeded for a list) and internal fields. `getPublishedBySlug()` queried `{ slug, isPublished:
  true }` with **no `.select()`** before this audit's fix (see Findings #1).
- **Branches** (`apps/api/src/modules/branches/branches.service.ts`): `listPublicBranches()` and
  `getPublicBranchById()` are explicitly commented "Marketing-safe … no internal fields" and both
  use `.select('name city province serviceRadiusKm logoUrl machines partnerUserId …')` plus a
  `toPublicBranch()` mapper that only forwards `id/name/city/province/radiusKm/logoUrl/machines`.
  `partnerUserId` (an internal id) is looked up server-side to resolve `partnerName`/`owner` but
  is **not** included in the response payload itself — only the resolved owner's `displayName`/
  `avatarUrl` are returned, and only if present. No margins, commission rates, internal notes, or
  raw partner ids leak. `operationalBranchFilter()` scopes both queries to active/live branches
  only, so unlaunched or deactivated branches aren't exposed publicly.
- Detail path does 3 parallel queries (owner profile, active staff, sibling branches) plus one
  more for staff profiles — reasonable for a low-traffic marketing detail page; not flagged as a
  perf issue.

## Cards / panels
| Page | Card/widget | Fields consumed | Notes |
|---|---|---|---|
| `blog/page.tsx` | Stat row | `posts.length` | client-derived pluralization |
| `blog/page.tsx` | Post card (per post) | `title`, `excerpt`, `coverImageUrl`, `slug`, `publishedAt`, `authorName` | `formatDate()` client-side; `_id` used only as React `key` |
| `blog/[slug]/page.tsx` | Post body | `title`, `authorName`, `publishedAt`, `coverImageUrl`, `content` (rendered via `ReactMarkdown`) | `isPublished`/`createdAt`/`updatedAt` never rendered (see Unused/dead fields) |
| `locations/page.tsx` | Stat row | `serviceAreas.length`, city count, avg `radiusKm` | all three derived client-side from the list response |
| `locations/page.tsx` | Partner card | `partnerName`, `logoUrl`, `province`, `area`, per-branch `name`/`area`/`radiusKm`/`id` | grouping by `partnerId` done client-side in `groupServiceAreasByPartner()` |
| `locations/page.tsx` | Expanding areas | hardcoded `EXPANDING_AREAS` array | static, not backend-driven — acceptable for a "coming soon" list |
| `service-areas/[id]/page.tsx` | Hero | `name`, `province`, `city`, `area`, `radiusKm`, `logoUrl`, `staff.length`, `branches.length` | |
| `service-areas/[id]/page.tsx` | Machines | `machines[].label`, `machines[].machineType` | |
| `service-areas/[id]/page.tsx` | Team | `staff[].displayName`, `staff[].avatarUrl` | only rendered if a member has a name/avatar (already filtered server-side) |
| `service-areas/[id]/page.tsx` | Other branches | `branches[].id/name/city/province` | |
| `service-areas/[id]/page.tsx` | Sidebar owner card | `owner.displayName`, `owner.avatarUrl` | |
| `about/page.tsx`, `how-it-works/page.tsx`, `faq/page.tsx` | all content | hardcoded arrays (`VALUES`, `HOW_IT_WORKS`, `PRICING_TIERS`, `FAQ_CATEGORIES`) | no backend calls; pricing tiers (`₱280`, `₱120`, `₱350`) are static copy, not live pricing — a product-content risk if backend prices ever diverge, not a code bug |

## Mutations
None — this module has no create/update/delete/toggle actions. No contact form, newsletter
signup, or lead-capture form exists under `(marketing)/` (grepped `components/marketing` for
`newsletter`/`contact form`/`subscribe`/`onSubmit` — no matches). All calls-to-action are
`<Link>`s to `/signup` or `/login`, which belong to the auth module already audited in
`auth-onboarding-profile.md`.

## Authorization
No role-scoped access on this module — every page and its endpoints are intentionally public and
unauthenticated (`/blog`, `/blog/:slug`, `/public/branches`, `/public/branches/:id`, plus the
static content pages). Verified:
- `BlogController`/`PublicBranchesController` carry no `@UseGuards`/`@Roles` — confirmed
  intentional (admin CRUD lives on separate `admin/blog` and authenticated `branches` controllers
  with `JwtAuthGuard`/`RolesGuard`, not reachable from this module).
- Public endpoints only ever return already-filtered/published/active records
  (`isPublished: true`, `operationalBranchFilter()`), so there's no way for an unauthenticated
  caller to widen the query to reach draft posts or inactive branches via a request param — `id`/
  `slug` are the only inputs and both are used as exact-match filters, not merged into a broader
  query.
No `[authz]` findings.

## Findings

1. **Blog detail endpoint returned the raw Mongoose document instead of a field-limited
   projection**, unlike its sibling `listPublished()` which explicitly `.select()`s a safe field
   set. `apps/api/src/modules/blog/blog.service.ts` — `getPublishedBySlug()` (pre-fix, ~line 113).
   Impact: every blog post page response leaked `isPublished`, `createdAt`, `updatedAt`, and the
   raw `_id`/`__v` alongside the intended fields. Not PII or admin-only secrets (blog posts have
   no such fields), but it's the same raw-serializer pattern already found and fixed 4x elsewhere
   in this app (refunds, support tickets, etc.) — flagging and closing it here for consistency
   even though the concrete exposure is low-severity.
   **Fix:** added `.select('title slug excerpt content coverImageUrl authorName publishedAt')` to
   `getPublishedBySlug()`, matching the field set the frontend `BlogPost` type actually expects
   (`blog-data.ts:1-10`). No other consumer of `getPublishedBySlug()` exists (grepped) — no
   regression risk elsewhere.

No other issues found. Branch/service-area endpoints were already properly scoped with explicit
`.select()` + a `toPublicBranch()` mapper before this audit; no changes needed there.

## Unused/dead fields
- Blog: `isPublished`, `createdAt`, `updatedAt`, `_id`/`__v` were returned by the pre-fix
  `getPublishedBySlug()` but never read by `blog/[slug]/page.tsx` (folded into Finding #1 above
  and now fixed — no longer returned).
- Service areas: none — `toPublicBranch()` + the two service-level mappers return exactly the
  field set `ServiceArea`/`PublicBranchApiShape` consume; verified field-by-field.

## Loading/error/realtime behavior
All dynamic fetches (`fetchBlogPosts`, `fetchBlogPostBySlug`, `fetchActiveServiceAreas`,
`fetchServiceAreaById`) are plain `async`/`await` calls inside server components — there is no
client-side loading spinner state because the page doesn't render until the fetch resolves
(standard Next.js server-component data fetching, not the `useAsyncQuery` pattern used by
authenticated pages elsewhere in this app).
- **Error handling**: every fetch helper wraps its call in try/catch and fails soft — `fetchBlogPosts`
  returns `[]`, `fetchActiveServiceAreas`/`fetchServiceAreaById` fall back to the static
  `SERVICE_AREAS` list (`home-page-data.ts:237-266`), and `fetchFeaturedReviews` returns `[]`. A
  backend outage degrades these pages to stale/static content rather than crashing or showing a
  raw error — appropriate for public marketing pages.
- **Empty state**: `blog/page.tsx:51-56` explicitly renders "No posts yet — check back soon." when
  `posts.length === 0`.
- **Not-found state**: both sub-pages call Next's `notFound()` (404) when the slug/id doesn't
  resolve, rather than rendering a blank/broken page.
- **Realtime**: none. Data is revalidated via Next's `next: { revalidate: 60 }` (ISR, 60s) on all
  four fetch helpers — no sockets or polling, appropriate for low-change marketing content.
- Not shared with any authenticated-page hook, so no cross-module blast radius from this behavior.
