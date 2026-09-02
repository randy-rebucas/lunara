# Audit: partner-brands — white-label brand config (customer-mobile)

Date: 2026-09-03

This module isn't a page — it's a build-time config pipeline: `partner-brands/<slug>/` files
feed `apps/customer-mobile/app.config.js`, which produces a branded Expo build. Adapted the
template below accordingly (no cards/mutations/HTTP endpoints in the usual sense).

## Entry point
- Config: `apps/customer-mobile/app.config.js` (evaluated by Expo/EAS at `expo config` /
  `eas build` time, not at app runtime)
- Consumers of its output: `apps/customer-mobile/src/theme/index.ts` (colors/fonts/name/tagline),
  `apps/customer-mobile/src/store/auth.ts` (`getPartnerId()` → `x-lunara-partner-id` header),
  `apps/customer-mobile/src/lib/brand-icon.ts` (generated icon file)
- Scaffolding tool: `.claude/skills/scaffold-partner-brand/generate.mjs` +
  `.claude/skills/scaffold-partner-brand/setup-eas.mjs`

## Sub-pages
None — no outbound navigation. The closest analog is the separate, unrelated admin-web flow at
`apps/admin-web/src/app/partners/branding/[id]/page.tsx`, which writes web brand assets
(logo/icon/splash/favicon) to Mongo + Cloudinary via `apps/api/src/modules/partners/
partners-admin.controller.ts` (`POST /admin/partners`, `PATCH /admin/partners/:id/branding`,
`POST /admin/partners/:id/branding/assets/:field`). It's correctly out of scope for this repo
folder per `partner-brands/README.md` and the scaffold skill's own SKILL.md — the two systems
share nothing but the human copying the same logo into both.

Also checked `apps/partner-mobile/app.config.js`, which mentions `partner-brands/` only in a
comment ("v1 is single-brand only — no partner-brands/ white-label wiring here") — it doesn't
actually read the folder. Not a real consumer.

## Data flow
| Consumer | Reads | Trigger |
|---|---|---|
| `app.config.js` | `partner-brands/<slug>/manifest.json`, `icon.png`, `splash.png`, `adaptive-icon.png`, `fonts/Regular.{ttf,otf}`, `fonts/Bold.{ttf,otf}` | `LUNARA_PARTNER_SLUG` env var, evaluated on every `expo config`/`eas build`/`eas env:create` invocation |
| `theme/index.ts` | `Constants.expoConfig.extra.partnerTheme` (= `manifest.theme`) | app boot |
| `store/auth.ts` `getPartnerId()` | `Constants.expoConfig.extra.partnerId` | every API request, injected as `x-lunara-partner-id` header |
| `apps/api` `BookingController`/`BookingService` | `x-lunara-partner-id` request header | every booking-flow request (`GET /booking/shops`, `POST /booking/quote`, `POST /booking/orders`) |

## Backend trace
`x-lunara-partner-id` is read in `apps/api/src/modules/booking/booking.controller.ts:53,69,85`,
validated only as `Types.ObjectId.isValid(...)` (format check, not existence/ownership), then
passed as `partnerContextId` into `BookingService.buildQuote`/`getShopOptions`/
`prepareOrderPayload`. When set, `resolvePartnerBranch` (`booking.service.ts:696`) scopes branch
selection to that partner's own branches via `buildDispatchEvaluationsForPartner` and — per
`booking.service.ts:691-694` — deliberately blocks checkout rather than falling back to
network-wide dispatch if none of that partner's branches can take the order. A malformed/absent
header degrades gracefully to normal "Let Lunara dispatch" behavior (`booking.controller.ts:83-84`
comment; confirmed in code).

## Cards / panels
N/A — not a rendered page. Closest equivalent, one row per manifest field and where it's
actually consumed:

| Manifest field | Consumed by | Notes |
|---|---|---|
| `partnerId` | `store/auth.ts:13` → `x-lunara-partner-id` header on every API call | Must equal the `Partner.ownerUserId` (confirmed against `apps/api/.../partners.controller.ts:41`, which returns `partnerId: partner.ownerUserId.toString()` from `GET /public/branding`) — the docs' cross-reference is accurate |
| `appName`, `slug` | `app.config.js:79-80` → native app name/slug | — |
| `iosBundleId`, `androidPackage` | `app.config.js:118,126` | — |
| `easProjectId` | `app.config.js:85` | — |
| `splashBackgroundColor` | `app.config.js:101,121` (splash + Android adaptive-icon background) | — |
| `theme.appDisplayName` | `app.config.js:67` (native permission-prompt string rewrite) and `theme/index.ts:8` (`brandName`, rendered in 6 components) | live |
| `theme.colors.*` | `theme/index.ts:24` → `colors` object, used throughout the app | live |
| `theme.tagline` | `theme/index.ts:11` → exported `brandTagline` | **dead** — see Findings #1 |
| `theme.fonts.sans` | `theme/index.ts` `resolveTheme(...).fonts` | **dead** — see Findings #2 |
| `fonts/Regular.{ttf,otf}`, `fonts/Bold.{ttf,otf}` (folder, not a manifest field) | `app.config.js:104-113` → actual on-device typeface | live; this is the real font mechanism, unrelated to `theme.fonts.sans` |

## Mutations
No UI mutations (not a page). The closest analog is the scaffold tooling itself, which does write
to shared repo state:

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| `generate.mjs` scaffold new `partner-brands/<slug>/` | No — refuses to overwrite an existing dir unless `--force` | N/A (agent-run, one-shot CLI) | N/A | Yes — `fail()` prints to stderr and exits 1 on any bad input |
| `generate.mjs --force` overwrite | Yes — silently replaces an existing partner's manifest/images | No explicit confirmation prompt in the script itself; SKILL.md tells the calling agent to check with the user first, but the script has no guard of its own | N/A | N/A |
| `setup-eas.mjs` patch `eas.json` | No — skips if `preview-<slug>`/`production-<slug>` already exist (idempotent) | N/A | N/A | Yes |
| `setup-eas.mjs` → `eas project:init` / `eas env:create` | No (creates new resources; doesn't delete) | N/A | N/A — could theoretically be run twice concurrently, but this is an interactively-run one-shot tool, not a UI action under double-click risk | Yes — `execFileSync` throws and the script exits non-zero (confirmed: this is exactly the `ENOENT`/`expo config` failure hit and fixed in this session) |

## Authorization
No role-guarded UI here, but the `x-lunara-partner-id` header is a trust boundary worth stating
explicitly: **any authenticated customer can set this header to any syntactically-valid
ObjectId**, not just their own build's baked-in value — the client fully controls the header, and
`apps/api` only checks `Types.ObjectId.isValid()` (`booking.controller.ts:53-57,69-73,85-89`), not
that the id corresponds to a real, active `Partner.ownerUserId`. This is `[authz]`-adjacent but,
per the code and design, not a new bug: `partnerId` is not a secret (it's returned unauthenticated
by `GET /public/branding` for that partner's domain) and worst case is a customer routing their
own booking to a specific (real) partner's branch pool rather than "Let Lunara dispatch" — the
system already fails closed (`resolvePartnerBranch` blocks checkout, doesn't leak data) if that
partner can't serve them. No confidential data crosses this boundary. Documented here rather than
in Findings since it's intentional design, not a defect — flagging only because it wasn't written
down anywhere before this audit.

## Findings

1. `theme.tagline` is scaffolded and threaded through the config pipeline but never rendered.
   `apps/customer-mobile/src/theme/index.ts:11` exports `brandTagline`, but no component in
   `apps/customer-mobile/src` imports it (confirmed via repo-wide grep). A partner setting a
   tagline in `manifest.json` gets no visible effect anywhere in the app.
   **Fix:** Left unfixed — deciding whether to (a) add a tagline display somewhere in the UI or
   (b) remove the dead field/export is a product/design decision (where would a tagline even
   show — splash screen? login screen?), not a mechanical fix within this module's scope.

2. `theme.fonts.sans` is scaffolded (`generate.mjs:166`, defaulting to `'Inter, system-ui,
   sans-serif'` — a CSS font-stack string) but never read anywhere in customer-mobile. The actual
   on-device typeface comes from a completely separate mechanism: `fonts/Regular.{ttf,otf}` /
   `fonts/Bold.{ttf,otf}` files in the same partner folder, wired through `app.config.js:104-113`.
   Every scaffolded partner ends up with a `theme.fonts.sans` value in their manifest that looks
   configurable but does nothing on mobile — likely leftover from `packages/config`'s shared
   `theme` shape, which may serve web contexts where a CSS font-stack string is meaningful (not
   traced further — out of this module's scope, which is mobile/`partner-brands/` only).
   **Fix:** Left unfixed — same reasoning as #1: removing the field from `generate.mjs`/
   `ASSETS.md` risks a real use in a web context not covered by this audit; keeping it silently
   confuses whoever fills in `manifest.json` by hand. Needs a decision on whether `theme.fonts`
   in this specific folder should exist at all, or whether the docs should just say "ignored on
   mobile, font is controlled by the fonts/ folder instead."

3. `generate.mjs --force` silently overwrites an existing partner's entire scaffold (manifest +
   all images) with no confirmation of its own — it relies entirely on the calling agent
   remembering to ask the user first (per SKILL.md prose), with nothing enforced in the script.
   Concrete failure: a slug typo combined with `--force` (e.g. re-running against `jelave` instead
   of a new slug) replaces a live partner's real, already-designed 1MB+ images (confirmed present
   in `partner-brands/jelave/*.png`, not placeholders) with solid-color placeholders and a blank
   manifest, silently, with no backup.
   **Fix:** Not applied — this is a one-shot CLI tool run by an agent under human supervision
   (SKILL.md's step 3 already tells the agent to "check with the user before forcing"), not an
   automated pipeline, so the existing prose guard was judged adequate; adding a
   `--force`-requires-typed-confirmation prompt would conflict with the tool's non-interactive,
   scriptable design (it's also invoked with `--dry-run` first per the current SKILL.md flow).
   Flagging so the next person touching this script is aware of the gap rather than assuming the
   script itself is safe.

## Unused/dead fields
- `theme.tagline` — see Finding #1 (also sensitive-adjacent only in the sense that it's
  partner-supplied marketing copy, not PII; no security concern, purely a wasted field).
- `theme.fonts.sans` — see Finding #2.

Neither field is sensitive data — both are dead-weight/UX gaps, not exposure risks.

## Loading/error/realtime behavior
Not applicable in the runtime sense (no fetch/loading spinner — this is baked into the binary at
build time). The two failure modes that matter instead:
- **Build-time**: `app.config.js:24-28` throws a hard, immediately visible error if
  `LUNARA_PARTNER_SLUG` is set but the manifest is missing — correct fail-fast behavior, confirmed
  directly in this session (`Error reading Expo config ... manifest.json was not found` when
  `eas env:create` was run before `generate.mjs` for `lunara-development-territory`).
- **Runtime**: a malformed/stale `partnerId` baked into an old build never crashes the app or
  checkout — `booking.controller.ts` explicitly validates and falls back to `undefined` rather
  than throwing (comment at line 83-84 confirms this is deliberate, not accidental leniency).
