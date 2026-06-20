# White-Labeling: Partner-Branded Customer Apps + Auto-Dispatch

## Context

Lunara currently runs one shared customer-web and customer-mobile app, with admin manually dispatching every paid booking to a shop via a cross-partner evaluation matrix (`/dispatch`). The goal: let a partner run their own branded customer-facing web app (custom domain) and their own branded mobile app (separate App Store/Play Store listing), where every booking placed through that branded app is automatically and exclusively routed to that partner's own branch(es) — never entering the admin's shared dispatch queue.

Decisions locked in with the user:
1. **Tenant identification**: customer-web resolves branding by Host/subdomain/custom-domain at request time; customer-mobile is built as a **separate EAS/Expo build per partner** (own bundle ID, app name, icon, splash, store listing).
2. **Auto-dispatch**: bookings from a partner's branded app always go straight to that partner's own branch(es) only — reusing the existing distance/capacity/performance ranking logic, just filtered to that partner's branches — skipping admin `/dispatch` entirely.
3. **Capacity fallback**: if all of that partner's branches are full, **block checkout with a "fully booked" message** — no silent queueing, no falling back to the shared admin dispatch queue.
4. **Branding scope**: full theming (multiple colors + fonts) + custom domain + mobile store listing assets, not just a single accent color.

## Data Model

Add a new `Partner` entity (brand lives at the partner/brand level, not duplicated per branch, since one partner can own multiple branches sharing one brand):

- **New** `apps/api/src/modules/partners/schemas/partner.schema.ts`
  - `ownerUserId` (ref to existing `User{role: PARTNER}` — reuses current auth model, no new login flow)
  - `legalName`, `slug` (unique)
  - `brandConfig`: `{ domain, customDomainVerified, appDisplayName, colors: {primary, secondary, accent, background, foreground, muted, border, destructive}, fonts: {sans, heading?}, logoUrl, iconUrl, splashUrl, faviconUrl, mobileBundleId?: {ios, android}, status: draft|pending_review|live }`
  - `isActive`
- Join key stays `Branch.partnerUserId` (== `Partner.ownerUserId`) — no migration/backfill needed, no new FK on `Branch`.
- **New** shared type `packages/types/src/partner.ts` exporting `PartnerBrandConfig`, consumed by API DTOs, admin-web forms, and customer-web theme resolver.
- No change to `apps/api/src/modules/branches/schemas/branch.schema.ts`.
- No change to `JwtPayload` (`packages/types/src/auth.ts`) — tenant context is resolved per-request via header, not baked into the session, so the same user/login behaves identically across apps.

## API Changes

- **New** `apps/api/src/modules/partners/partners.controller.ts`: `GET /api/v1/public/branding?domain=...` (no auth) → returns `{ partnerId, branchIds[], brandConfig }`, or `{ isDefault: true, brandConfig: LUNARA_DEFAULT_BRAND }` when no match (this is what keeps the default `lunara.app` experience byte-identical to today).
- **New** `apps/api/src/modules/partners/partners.admin.controller.ts`: CRUD for `Partner` + `PATCH /branding` + asset upload, for Phase 4's admin UI.
- **Auto-dispatch bypass** (core behavior change):
  1. `apps/api/src/modules/booking/booking.controller.ts` reads an `x-lunara-partner-id` header (set server-side by customer-web middleware, or by customer-mobile's API client) and forwards it into `bookingService.prepareOrderPayload(userId, dto, partnerContextId)`.
  2. **New** `branches.service.ts` method `buildDispatchEvaluationsForPartner(address, bookingType, weightKg, partnerUserId)` — reuses existing `buildDispatchEvaluations`/ranking logic (~branches.service.ts:304-358) filtered to `{ partnerUserId, isActive: true, branchType: { $ne: 'hq' } }`.
  3. `booking.service.ts` `prepareOrderPayload()`: when `partnerContextId` present, call the partner-scoped evaluation, pick the top-ranked branch, and populate `branchId`/`branchCode`/`branchName`/`partnerId` on the payload. **If no eligible branch has capacity, throw immediately so checkout fails with a "fully booked" error** (per decision #3 — no queueing, no fallback to admin queue).
  4. `orders.service.ts` `createFromBooking()`: when the payload already carries a resolved `branchId`, set `status: SHOP_ASSIGNED` / `dispatchStatus: dispatched` directly at creation instead of `PENDING`.
  5. Extract the assignment side-effects currently inline in `adminDispatchOrder` (~branches.service.ts:466-543: `dispatchedAt`, `statusHistory` push, websocket `shopAssigned` emit, `emitPartnerPipelineUpdated`) into a shared helper `applyShopAssignment(order, branch, dispatchedBy)` so both the admin path and the new auto-dispatch path stay in sync.
  6. **Must locate during Phase 1**: the payment-confirmation hook that currently flips `PENDING` → `PENDING_DISPATCH` (likely in a payments module, not yet located) — for partner-tagged orders this status must never be set, since `getDispatchQueue()` already filters on `PENDING_DISPATCH`, so simply skipping that transition keeps the order out of admin's queue with no extra filtering needed.

## customer-web Tenant Resolution & Theming

- **New** `apps/customer-web/src/middleware.ts`: reads `Host` header, looks up `GET /api/v1/public/branding`, and on match sets `x-lunara-partner-id` + brand-config headers forwarded into the request; on no match, passes through untouched (zero change for default domain).
- `apps/customer-web/src/app/layout.tsx`: reads resolved brand config server-side (`headers()`) and injects `:root` CSS custom properties (`--lunara-primary`, etc.) for the request.
- Tenant header is attached **server-side only** on outgoing booking API calls (never trust a client-supplied partner id), preventing spoofing of another partner's dispatch.

## Theming `packages/ui` / `packages/config`

Must stay inert for admin-web, partner-web, rider-mobile (decision: only customer-facing apps re-theme):

- `packages/ui/src/globals.css`: change hardcoded hex to `var(--lunara-primary, #4f46e5)` style fallbacks — unmodified consumers get identical fallback values.
- `packages/config/tailwind.config.ts`: route color tokens through the same `var(--lunara-*, <default hex>)` pattern.
- `packages/config/src/index.ts`: add `resolveTheme(brandConfig?)` helper that merges overrides onto defaults; only customer-web uses it.
- `packages/ui/src/brand-mark.tsx`: accept optional `logoSrc`/`title`/`subtitle` overrides (largely already supported) for customer-web to pass partner branding through without touching the component's default behavior.

## customer-mobile Per-Partner Builds

- **New convention dir** `partner-brands/<slug>/{icon.png, splash.png, adaptive-icon.png, manifest.json}` (kept outside `packages/brand`, which stays the default Lunara asset set).
- `apps/customer-mobile/app.config.js`: read `LUNARA_PARTNER_SLUG` env var; when set, load icon/splash from `partner-brands/<slug>/` and override `expo.name`/`slug`/`ios.bundleIdentifier`/`android.package`/`extra.eas.projectId` from that partner's `manifest.json`. Unset → current default behavior, unchanged.
- `apps/customer-mobile/eas.json`: add per-partner build profiles (e.g. `production-partnerx`) extending `production` with `env: { LUNARA_PARTNER_SLUG }`.
- Runtime: bake `partnerId` into `extra` via `expo-constants`; the app's API client reads it once at startup and attaches `x-lunara-partner-id` on every booking request — same header contract as customer-web, so the backend code in section "API Changes" serves both uniformly.

## Sequencing

1. **Phase 1 — Backend data model + auto-dispatch logic** (no UI). Files: `partners/schemas/partner.schema.ts`, `partners.module.ts`/`partners.service.ts`, `branches.service.ts` (`buildDispatchEvaluationsForPartner`, `applyShopAssignment`), `booking.service.ts`, `orders.service.ts`, `booking.controller.ts`. Locate and patch the payment→`PENDING_DISPATCH` hook. Verify: with no `x-lunara-partner-id` header, behavior is byte-identical to today (order still lands in admin's `/dispatch` queue as before).
2. **Phase 2 — customer-web theming + domain resolution**. Files: `partners.controller.ts` (public branding endpoint), `customer-web/src/middleware.ts`, `customer-web/src/app/layout.tsx`, `packages/ui/src/globals.css`, `packages/config/tailwind.config.ts`/`src/index.ts`, `packages/ui/src/brand-mark.tsx`. Verify: default domain renders unchanged; a test subdomain renders overridden brand and a test booking auto-dispatches to that partner's branch only.
3. **Phase 3 — customer-mobile per-partner build pipeline**. Files: `partner-brands/<slug>/` convention, `customer-mobile/app.config.js`, `customer-mobile/eas.json`, runtime `partnerId` constant + API client header. Verify: default build unchanged; one pilot partner build produces a distinct binary that auto-dispatches end-to-end.
4. **Phase 4 — admin-web branding management UI**. Files: `partners.admin.controller.ts` (CRUD + asset upload + domain verification), new admin-web pages for partner list / brand-config form / asset upload / domain verification status / EAS manifest generation helper.

## Risks / Open Questions to revisit during implementation

- **Custom domain DNS/SSL**: subdomains of `lunara.app` are simple (wildcard cert); fully custom domains need partner-side DNS changes and SSL provisioning with multi-day propagation — set expectations accordingly.
- **Mobile store review overhead**: every partner mobile app is a separate App Store/Play Console submission; any shared bugfix must be re-submitted per partner. Consider capping partner mobile app count for v1.
- **Developer account ownership**: clarify whether each partner submits under their own Apple/Google developer account or Lunara's, before Phase 3 begins — affects who holds EAS/store credentials.
- **Fonts**: recommend restricting v1 to a pre-approved font palette (e.g. via `next/font/google`) rather than arbitrary uploaded font files, to avoid licensing/performance issues — confirm before Phase 2 UI work.
- **Asset storage**: confirm existing upload/CDN provider pattern in the API before scoping Phase 4's logo/icon/splash upload endpoints.

## Verification

- Phase 1: run existing booking/dispatch test flows (TC-BOOK-01 through TC-BOOK-06, TC-DISP-01/02 from `docs/TEST_CASES.md`) with no partner header — confirm unchanged behavior. Add a new manual case: booking with `x-lunara-partner-id` set → order goes straight to `shop_assigned` on that partner's branch, never appears in `/dispatch`.
- Phase 2: visually diff customer-web at the default domain before/after; load a test partner subdomain and confirm colors/logo/fonts swap and a booking auto-routes correctly.
- Phase 3: build the default EAS profile and one partner profile side by side; confirm distinct bundle ID/name/icon and confirm the partner build's bookings carry the correct header end-to-end.
- Phase 4: admin creates/edits a partner's branding via UI and confirms it round-trips into the public branding endpoint used by Phase 2/3.
