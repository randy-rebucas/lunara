# Audit: Admin-web — Partner branding (white-label)

Date: 2026-07-23 (re-audited same day; Finding 6 — nested `colors`/`fonts` validation gap — found and fixed)

## Entry point
- Page: `apps/admin-web/src/app/partners/branding/page.tsx` (`PartnerBrandingListPage`)

## Sub-pages
Both are real dynamic/creation routes linked from the list, not thin modals.

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `partners/branding/[id]/page.tsx` | row link, `page.tsx:88` | `p._id` -> `id` route param | yes — `adminFetch<PartnerRecord>('/admin/partners/${params.id}')` |
| `partners/branding/new/page.tsx` | "New brand" button/empty-state link, `page.tsx:55,79` | none (creates by `ownerEmail` lookup, not an existing id) | n/a — create flow, redirects to `/partners/branding/${partner._id}` on success (`new/page.tsx:36`) |

`[id]/page.tsx` fetches the full `PartnerRecord` (including `brandConfig`) fresh —
the list page never had more than a `PartnerBrandSummary` slice, so there's no
redundant re-fetch. It previously reimplemented loading/error state by hand
instead of the shared hook — see Findings.

Note: this `Partner` entity (a white-label brand config: `legalName`, `slug`,
`brandConfig`, linked via `ownerUserId`) is a **separate collection** from the
"Shop" `User` accounts audited in `docs/audits/admin-web/partners.md` — a brand
config is *owned by* a shop account (`Partner.ownerUserId` -> shop `_id`), not the
same record. See Finding 3 for the gap this creates.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Brand list | GET | `/admin/partners` | `PartnerBrandSummary[]` | `PartnersAdminController.list` -> `PartnersService.listAll` |
| Brand detail | GET | `/admin/partners/:id` | `PartnerRecord` | `PartnersAdminController.getOne` -> `PartnersService.findById` |
| Create brand | POST | `/admin/partners` | `PartnerBrandRecord` (`{_id}`) | `PartnersAdminController.create` -> `PartnersService.createByOwnerEmail` |
| Update branding fields | PATCH | `/admin/partners/:id/branding` | `PartnerRecord` | `PartnersAdminController.updateBranding` -> `PartnersService.updateBrandConfig` |
| Toggle active | PATCH | `/admin/partners/:id/active` | `PartnerRecord` | `PartnersAdminController.setActive` -> `PartnersService.setActive` |
| Upload brand asset | POST (multipart) | `/admin/partners/:id/branding/assets/:field` | `PartnerRecord` | `PartnersAdminController.uploadAsset` -> Cloudinary upload + `PartnersService.setAssetUrl` |

## Backend trace
Straightforward CRUD over a single `Partner` document — no aggregation. Assets
upload to Cloudinary (`lunara/partner-brands/`) and the previous asset is deleted
after the new URL is saved (`partners-admin.controller.ts:85-86`), matching the
Cloudinary-based storage the rest of the app now uses. `updateBrandConfig` does a
shallow `Object.assign` merge onto the loaded document for `colors`/`fonts`/top-level
fields, so concurrent partial-field saves (e.g. two color fields blurred in quick
succession) don't clobber unrelated fields — each request reads fresh from the DB
before merging its own partial update. The public, unauthenticated
`GET /public/branding?domain=` (`partners.controller.ts`) is what customer-web
calls to resolve a domain to its brand config, and it only returns a match when
`isActive: true` (`findByDomain`) — this is what makes deactivation user-facing and
immediate, not just an admin-side flag.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| List rows | `legalName`, `brandConfig.appDisplayName`, `brandConfig.domain` (or "no domain"), `slug`, `brandConfig.status` (via `STATUS_BADGE`/`STATUS_LABEL`), `isActive` | `STATUS_BADGE`/`STATUS_LABEL` (`page.tsx:21-31`) are hardcoded maps keyed by the 3-value `status` union — same "must stay in sync by hand" class of finding as `PLAN_BADGE` in the partners board, low risk since this status set is small and stable. |
| Detail > App identity | `domain`, `appDisplayName`, `status` | Per-field autosave on blur, no explicit "Save" button — see Findings for the resulting confirm-dialog gap on deactivate; the autosave pattern itself is a deliberate, working alternative to the rest of the app's explicit-Save convention, not a bug. |
| Detail > Colors | `colors.{primary,secondary,accent,background,foreground,muted,border,destructive}` | Two inputs per color (swatch + hex text) both bound to the same field and both autosave on blur — fine, since the merge is per-field and idempotent. |
| Detail > Fonts | `fonts.sans`, `fonts.heading` | Straightforward. |
| Detail > Assets | `logoUrl`, `iconUrl`, `splashUrl`, `faviconUrl` | Rendered via plain `<img src>` directly from the stored Cloudinary `secure_url` — correct for this app's current Cloudinary-based storage (unlike `AuthenticatedImage`, which exists for other, access-gated media); no fix needed. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Deactivate brand (`toggleActive`, `isActive: true -> false`) | yes — the partner's live custom domain immediately stops resolving to their branding and falls back to default Lunara branding for every visitor | no (pre-fix) | yes, `disabled={saving}` | yes |
| Activate brand (`toggleActive`, reverse) | no | n/a (correctly not required) | yes | yes |
| Edit branding field (`saveBranding`, per-field autosave) | no | n/a | fields aren't disabled while saving, but each request is a targeted server-side merge (see Backend trace) so overlapping saves are safe, not a race | yes |
| Upload brand asset (`uploadAsset`) | no (replaces, not deletes-without-replacement) | n/a | file input isn't disabled mid-upload; low-risk since a second upload just supersedes the first | yes |
| Create brand (`new/page.tsx` submit) | no | n/a | yes, `disabled={busy}` | yes |

## Authorization
`PartnersAdminController` is class-level `@Roles(UserRole.ADMIN)`
(`partners-admin.controller.ts:32`) — matches the frontend (admin-only). The one
public endpoint this module's data feeds, `GET /public/branding` in
`PartnersController`, is intentionally unauthenticated (customer-web needs it to
resolve branding before a customer logs in) and only ever returns a partner's
already-public `brandConfig`, never anything from the linked `User`/shop account
— no `[authz]` findings.

## Findings

1. **Deactivating a brand had no confirmation, despite an immediate live-site effect.**
   `toggleActive()` in `[id]/page.tsx` called `PATCH .../active` directly from the
   button's `onClick` with no guard (`branding/[id]/page.tsx:98-112`, pre-fix).
   Because `GET /public/branding?domain=` only matches `isActive: true` partners
   (`partners.service.ts:46-48`), deactivating flips every visitor on that
   partner's custom domain to the generic default Lunara branding *immediately* —
   the same class of finding as the un-confirmed service-area delete found
   earlier, and directly comparable to the shop-level suspend flow in
   `partners-board.tsx`, which already has a confirm dialog for its own
   (less immediately visible) deactivation.
   **Fix:** added a `window.confirm` naming the partner and stating the exact
   consequence, gated to only fire when going active -> inactive (reactivating
   still requires no confirmation) — `branding/[id]/page.tsx:87-94`.

2. **`status` wasn't enum-validated at the API boundary.**
   `UpdatePartnerBrandConfigDto.status` (`dto/partner.dto.ts`, pre-fix) was
   `@IsString()` only; the frontend's `<select>` only ever sends one of the three
   valid values, but a direct API call could send any string, which would only be
   caught by Mongoose's schema-level `enum` at `.save()` time — a less specific
   error than a clean 400 at the request-validation layer.
   **Fix:** changed to `@IsIn(['draft', 'pending_review', 'live'])`
   (`dto/partner.dto.ts`).

3. **Duplicate custom domain would surface as an unhandled error.**
   `brandConfig.domain` is `unique: true, sparse: true` at the schema level
   (`partner.schema.ts:53`), but `updateBrandConfig` (`partners.service.ts`,
   pre-fix) had no handling for the resulting Mongo E11000 duplicate-key error —
   an admin setting a domain already claimed by another partner would get an
   opaque failure instead of "that domain is already in use."
   **Fix:** wrapped `partner.save()` in a try/catch that rethrows E11000 as a
   `BadRequestException` with a clear message (`partners.service.ts`), the same
   pattern already used for duplicate-key handling in
   `LaundryTagsService.generateBatch` (cross-module consistency: this is the
   second module found reusing that error-shape check — no other domain-unique
   field elsewhere in this codebase needed the same fix, verified by checking for
   other `unique: true` string fields with user-facing update endpoints).

4. **No deep link from a shop's account to its brand config.** `partners-board.tsx`'s
   Settings tab links to the flat `/partners/branding` list (no id), even though
   `Partner.ownerUserId` links directly to the shop's `_id` — an admin has to find
   the right brand by name in the flat list rather than jumping straight there.
   Left unfixed: closing this gap needs either a `GET /admin/partners?ownerUserId=`
   lookup endpoint or a redirect-by-owner route, which is a product/UX scope
   decision (and touches `partners-board.tsx`, already audited/fixed separately)
   rather than a one-line fix — noted here for whoever picks up either module next.

5. **Detail page reimplemented loading/error state instead of using the shared hook.**
   `[id]/page.tsx` (pre-fix) used raw `useState`/`useEffect`/try-catch for
   `partner`/`loading`/`error` instead of `useAdminQuery` (`useAsyncQuery`),
   the hook every other audited admin-web module uses — meaning it didn't get the
   hook's "keep previous data visible on a failed reload" behavior for free, and
   was a style outlier.
   **Fix:** switched to `useAdminQuery`, using its `setData` to apply mutation
   responses locally (no extra round-trip) exactly like `PartnerDetailsDrawer`'s
   `loadDetail` pattern in `partners-board.tsx` — `branding/[id]/page.tsx:63-64`.
   Regression-checked: this only touches local state in this one file, no other
   consumer of the removed manual pattern exists.

6. **Nested `colors`/`fonts` validation was decorative, not enforced.**
   `UpdatePartnerBrandConfigDto.colors`/`.fonts` (`dto/partner.dto.ts`, pre-fix)
   were typed as `PartnerBrandColorsDto`/`PartnerBrandFontsDto` with only
   `@IsOptional()` — no `@ValidateNested()` + `@Type(() => ...)`. Without those,
   `class-validator` never recurses into the nested object, so the `@IsString()`
   decorators on each individual color/font field (`primary`, `secondary`, `sans`,
   etc.) never actually ran; a PATCH could send `{colors: {primary: 123}}` and it
   would pass validation untouched. It also meant the app's global
   `forbidNonWhitelisted: true` (`main.ts:29-33`) couldn't strip unknown keys
   *inside* `colors`/`fonts` (whitelisting only recurses into a nested object once
   `class-transformer` knows to instantiate it as a class via `@Type()`) — so an
   arbitrary extra key nested inside `colors` would have silently passed through
   to `Object.assign(partner.brandConfig.colors, colors)` instead of being
   rejected like every other unrecognized top-level field on this DTO already is.
   **Fix:** added `@ValidateNested()` + `@Type(() => PartnerBrandColorsDto)` /
   `@Type(() => PartnerBrandFontsDto)` to both properties (`dto/partner.dto.ts`).
   Regression-checked: grepped the rest of `apps/api/src` for other DTOs with an
   `@IsOptional()` nested-class property lacking `@ValidateNested()`/`@Type()` —
   none found; this was the only instance of the pattern.

## Unused/dead fields
- `PartnerBrandConfig.customDomainVerified` and `mobileBundleId` (declared on the
  backend schema, `partner.schema.ts:56-57,80-81`) are not part of the frontend's
  `PartnerBrandConfig` interface at all and never surfaced in the detail page —
  no UI exists yet to view or set custom-domain verification status or mobile
  bundle ids. Left as-is: these look like fields for features not yet built
  (domain verification flow, mobile app store builds), not a bug to fix here.

## Loading/error/realtime behavior
List and detail pages each use `useAdminQuery` independently (detail page fixed
to do so in this pass) — standard shared-hook behavior: spinner while `null`, a
failed reload keeps previously-loaded data on screen, errors surface via
`alert-error`. No realtime socket on either page — appropriate, this is
low-frequency admin configuration data with no other actor pushing changes.
