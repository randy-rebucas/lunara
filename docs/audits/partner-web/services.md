# Audit: Partner-web — Services & pricing

Date: 2026-07-23 (re-audited 2026-08-12 — garment pricing overrides; 2026-08-31 — tabs, machine load, per-service add-on assignment, included-quantity)

**2026-08-31 addition:** the page was restructured into tabs (Services / Add-ons /
Dry cleaning garments / Machine load — garments hidden entirely once the Dry
Cleaning service itself is turned off) and the add/create forms moved into a
`RightDrawer` slide-over instead of inline forms. Functionally new since the last
pass: a per-service, per-branch `kgPerLoad` setting (Machine load tab, saved via
the existing pricing PATCH), an "Add-ons for {service}" modal letting a partner
choose which add-ons apply to which service (`applicableServiceTypes`, saved
instantly for custom add-ons via a dedicated PATCH, or via the batched "Save
pricing" for standard add-ons), and an `includedQuantity` per add-on ("units
bundled free before billing kicks in"). Traced fresh below; no functional
regressions found in the existing Findings #1-7, all still fixed as documented.

## Entry point
- Page: `apps/partner-web/src/app/services/page.tsx`
- Component(s): inline in the page file, no separate board component

## Sub-pages
None — no outbound navigation into a dynamic detail route.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List shops | GET | `/partner/branches` | `BranchOption[]` | `PartnerController.listOwnBranches` -> `BranchesService.listBranchesForPartner` |
| Load pricing | GET | `/partner/branches/:id/pricing` | `ShopPricing` | `PartnerController.getOwnBranchPricing` -> `BranchesService.getShopPricing` |
| Save service pricing | PATCH | `/partner/branches/:id/pricing` | — | `PartnerController.updateOwnBranchPricing` -> `BranchesService.updateServicePricing` |
| Save add-on pricing | PATCH | `/partner/branches/:id/addon-pricing` | — | `BranchesService.updateAddonPricing` |
| Save hidden catalog | PATCH | `/partner/branches/:id/hidden-catalog` | — | `BranchesService.updateHiddenCatalog` |
| Create custom service | POST | `/partner/branches/:id/custom-services` | — | `BranchesService.createCustomService` |
| Delete custom service | DELETE | `/partner/branches/:id/custom-services/:serviceId` | — | `BranchesService.deleteCustomService` |
| Create custom add-on | POST | `/partner/branches/:id/custom-addons` | — | `BranchesService.createCustomAddon` |
| Update custom add-on (assign to a service) | PATCH | `/partner/branches/:id/custom-addons/:addonId` | — | `PartnerController.updateOwnCustomAddon` -> `BranchesService.updateCustomAddon` |
| Delete custom add-on | DELETE | `/partner/branches/:id/custom-addons/:addonId` | — | `BranchesService.deleteCustomAddon` |

**2026-08-12 addition:** the "Save hidden catalog" PATCH now also carries `garmentPricing:
{garmentId, price}[]` — per-garment price overrides for dry cleaning, saved alongside
`hiddenGarmentItemIds` through the same `updateHiddenCatalog` handler.

## Backend trace
Every route on this page goes through `getOwnBranchOrThrow(id, req.user.sub)`
before touching the branch (except when the caller is `ADMIN`), so a partner
can never read/edit another shop's catalog by guessing a branch id.
`updateServicePricing`/`updateAddonPricing` validate that a rate exists for
the *target* pricing unit before allowing the switch (`rateKeyByUnit` lookup,
`BadRequestException` otherwise) and write via an atomic `findByIdAndUpdate`
`$set` rather than load-then-save — a comment on this exact code explicitly
notes it's because this page's Save button fires all three PATCH requests in
parallel via `Promise.all`, and load/save would race on Mongoose's version
key. `getShopPricing`/`serializeShopPricing`/`serializeShopAddonPricing` are
shared with two other consumers: the customer-facing `GET
/branches/:id/pricing` (shop pricing preview before booking) and
`findNearbyShopsWithPricing` (nearby-shops listing) — both of which correctly
want hidden services/add-ons filtered out, since a customer shouldn't be
offered something the shop has turned off. This page needs the *opposite* —
see Finding #1.

**2026-08-12:** `serializeShopGarmentCatalog` now routes through
`resolveBranchGarmentCatalog` (branches.service.ts:245), which swaps each
`GARMENT_CATALOG` item's price for the branch's own `garmentPricing` override
before the hidden-id filter runs — so the garment catalog this page (and the
customer-facing quote path, via `booking.service.ts`'s `priceOneService`) sees
already reflects the partner's own price, not just the global reference price.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Shop selector | `branches[].name/city` (only rendered when `branches.length > 1`) | auto-selects the first branch on load |
| Services table | `s.label`, per-row pricing-unit `<select>` (`serviceUnits[s.type]`), the matching rate input (`servicePrices`/`serviceLoadPrices`/`servicePiecePrices[s.type]` depending on selected unit — each is its own independent local-state bucket, correctly read/written per unit, not a shared single field), a live "Customer pays" preview (`base * MARKUP_MULTIPLIER`), and an Offer/Hidden checkbox (`hiddenServiceTypes`) | custom services (`s.isCustom`) render as a simpler read-only-priced row with a Delete button instead |
| Add-ons table | Same shape as Services, keyed by `slug` instead of `type` | |
| Add custom service / add-on forms | Local draft state (`newService`/`newAddon`), Add button disabled until required fields are filled | |
| Dry cleaning garments panel | `pricing.garmentCatalog[].id/category/label/price` (price already override-applied server-side), local `hiddenGarmentItemIds`/`garmentPrices`/`collapsedGarmentCategories` | Added 2026-08-12: per-garment ₱ price input next to the offer/hide checkbox, editable even while hidden (consistent with services/add-ons keeping rate inputs live while hidden). Category collapse state defaults to all-collapsed on every load — pure UI state, not persisted. Tab hidden entirely once Dry Cleaning is toggled off (`hiddenServiceTypes.includes(DRY_CLEANING)`), with an effect that bounces `activeTab` back to "services" if it was already on "garments" when that happens — correct, no dead/blank tab state. |
| Machine load tab (new) | `kgPerLoad` (local string state, seeded from `pricing.kgPerLoad`) | one plain number input, saved through the existing service-pricing PATCH's optional `kgPerLoad` field — no new endpoint |
| "Add-ons for {service}" modal (new) | per add-on: `offered` (from `applicableServiceTypes` — custom add-ons' own field, or the standard add-on's local `addonServiceTypes` draft), `includedQuantity` draft input (shown only when the addon's unit is one of `flat_bag`/`fixed`/`per_piece`/`per_pair`/`per_item` — a per-kg/per-load add-on has no natural "included units" concept, correctly excluded) | Custom add-ons save immediately via their own PATCH (`toggleAddonForService`); standard add-ons stage into `addonServiceTypes`/`addonIncludedQty` and only persist when "Done" triggers the same batched `save()` as the main "Save pricing" button — copy in the modal ("Custom add-ons save instantly...") accurately describes this split |
| Save pricing button | n/a (submits all local draft state) | |

`MARKUP_MULTIPLIER` was a locally hardcoded `1.3` — see Finding #2.

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save pricing (3 parallel PATCHes: services, add-ons, hidden catalog) | no | n/a | yes (`disabled={saving}`) | yes (`saveError`); on partial failure `Promise.all` rejects before `reloadPricing()`, but nothing is lost — local edits stay in place for retry, and any request that did succeed is idempotently re-sent on the next attempt |
| Add custom service / add-on | no | n/a | yes (`disabled={addingService/addingAddon || ...required fields empty}`) | yes (`rowError`) |
| Delete custom service / add-on | yes — permanently removes a partner-defined service/add-on and its pricing | **no (before fix)** | no busy-state guard, but the backend delete is idempotent (`deleteCount === 0` -> a harmless `NotFoundException` on a duplicate click, not a second deletion of something else) | yes (`rowError`) |
| Assign/unassign a custom add-on to a service (modal checkbox) | no | n/a | no explicit busy-state guard on the checkbox itself, but each toggle is its own independent PATCH keyed by `addonSlug`/`customAddonId` — a rapid double-toggle at worst races two idempotent writes of the same final `applicableServiceTypes` array, not a corrupting one | yes (`rowError`) |

## Authorization
Every `/partner/branches/:id/*` route here is `@Roles(UserRole.PARTNER, UserRole.ADMIN)` and, for non-admin callers, additionally gated by `getOwnBranchOrThrow` — matching the frontend's `useRequirePartner()`. No request param can widen scope past the caller's own branch(es). No `[authz]` issues.

## Findings

1. **[FIXED] Hiding a service or add-on made it permanently un-hideable from this page — the "Offer/Hidden" checkbox was a one-way switch.** `serializeShopPricing`/`serializeShopAddonPricing` (pre-fix) unconditionally filtered out any service/add-on in the branch's `hiddenServiceTypes`/`hiddenAddonSlugs` set (`branches.service.ts:222,261`, pre-fix) — correct for the two other consumers of this same private method (the customer-facing shop-pricing preview and the nearby-shops listing, both of which should never show a hidden item to a customer), but this page's own "Offer" checkbox UI (`page.tsx:578-586,755-763`) is built entirely around toggling `hiddenServiceTypes`/`hiddenAddonSlugs` membership for a row that's *already visible in the table* — since a hidden item never appeared in `pricing.services`/`pricing.addons` at all, there was no row and no checkbox to click to bring it back. A partner who hid a service by mistake (or wanted to temporarily disable one) had no way to re-enable it from this page — the only way back would be a support/database intervention.
   **Fix:** added an `includeHidden` parameter (default `false`, preserving existing behavior everywhere else) to `getShopPricing`/`serializeShopPricing`/`serializeShopAddonPricing`, and updated `PartnerController.getOwnBranchPricing` — the only route this page calls — to pass `true` (`apps/api/src/modules/branches/branches.service.ts`, `apps/api/src/modules/partner/partner.controller.ts:111`). The customer-facing `BranchesController.getShopPricing` route and `findNearbyShopsWithPricing` both still call with the default `false`, unaffected. `updateServicePricing`/`updateAddonPricing`'s own PATCH response bodies were left at the default filtered behavior since this page discards them anyway (it calls `reloadPricing()` — a fresh `GET`, now correctly unfiltered — rather than using the PATCH response directly); noted here rather than changed, since nothing currently consumes those response bodies and changing them wasn't needed to fix the actual bug.
   - Typechecked `apps/api` clean. Regression-checked: grepped every call site of `serializeShopPricing`/`serializeShopAddonPricing`/`getShopPricing` — only the one route this page hits was changed to `includeHidden: true`.

2. **[FIXED] Hardcoded markup multiplier duplicated in two places, diverged from the shared constant.** `MARKUP_MULTIPLIER = 1.3` (`page.tsx:56`, pre-fix) was a local copy of `SHOP_PRICE_MARKUP_MULTIPLIER`, the actual constant `applyShopMarkup` (`packages/utils/src/booking.ts:10,265-267`) uses to compute the `customerPricePerKg`/`customerPrice` fields this same page's backend already returns — currently in sync (both `1.3`), but nothing enforces that, and `@lunara/utils` was already a dependency of this app. The same hardcoded duplicate also existed in `admin-web`'s `shop-pricing-panel.tsx:35` (a sibling pricing-editor component covering the same feature from the admin side) — a second, independent copy of the identical magic number.
   **Fix:** both `page.tsx` and `admin-web/src/components/datacenter/shop-pricing-panel.tsx` now import `SHOP_PRICE_MARKUP_MULTIPLIER` from `@lunara/utils` instead of hardcoding `1.3`. Typechecked both `apps/partner-web` and `apps/admin-web` clean.

3. **[FIXED] Deleting a custom service/add-on had no confirmation.** `deleteService`/`deleteAddon` (pre-fix, `page.tsx:293-303,329-338`) called the DELETE endpoint immediately on click, with only a plain "Delete" button and no confirmation step, unlike the destructive-action confirmation pattern used elsewhere in this codebase (e.g. the ticket wallet-credit and maintenance-restore fixes in the admin-web audits).
   **Fix:** added a `window.confirm` prompt before each delete call — `apps/partner-web/src/app/services/page.tsx`.

4. **[FIXED — 2026-08-12] N+1 query in `serializeShopPricing`.** `branches.service.ts` (pre-fix)
   called `resolveBranchServicePrice(branch, service.type)` for every active service, which
   re-queries `catalogService.findActiveByType(bookingType)` from Mongo even though the enclosing
   `listActiveServices()` call had already loaded that exact document (with `pricePerKg`) into
   memory. For a shop offering N services this was N redundant round trips on every load of this
   page *and* every `findNearbyShopsWithPricing` call (the customer shop-listing path shares this
   method).
   **Fix:** inlined the override-or-catalog-price fallback from the in-memory `service` object
   instead of calling `resolveBranchServicePrice` (branches.service.ts, inside `serializeShopPricing`).
   `resolveBranchServicePrice` itself is untouched; its other caller (`resolvePriceableService`,
   which doesn't have the service object in scope) is unaffected. Typechecked `apps/api` clean.

5. **[FIXED — 2026-08-12] Double N+1 in `serializeShopAddonPricing`.** Same pattern as #4, but
   doubled: for the common `FLAT_BAG`/default pricing unit, both `resolveBranchAddonPrice` and
   `resolveAddonRateForUnit` independently fall back to
   `catalogService.findActiveAddonBySlug(addonSlug)` — two redundant queries per non-custom add-on,
   for data the enclosing `listActiveAddons()` call already held as `addon.price`. Shared by the
   same `findNearbyShopsWithPricing` path as #4.
   **Fix:** inlined both fallbacks using the in-memory `addon` object and the branch's own
   `addonPricing` override. `resolveBranchAddonPrice`/`resolveAddonRateForUnit` themselves are
   untouched; `booking.service.ts`'s separate call to `resolveAddonRateForUnit` (where the addon
   object isn't already in scope) is unaffected. Typechecked `apps/api` clean.

6. **[FIXED — 2026-08-12] Frontend "unchecked by default" hack silently re-hid garments for
   already-configured shops.** A same-session change to `page.tsx` had defaulted
   `hiddenGarmentItemIds` to *every* catalog id whenever the server returned an empty array, to
   make new/never-configured shops start with dry cleaning off. But the schema explicitly
   documents empty as "offers every garment" (`branch.schema.ts:285-286`) — for any shop that has
   genuinely configured itself to offer everything, or simply hasn't touched this panel and is
   relying on that documented default, the UI would render every garment unchecked, and clicking
   "Save pricing" would persist that as real hidden-everything state — silently disabling dry
   cleaning for a live shop.
   **Fix:** reverted the frontend default-flip (now `setHiddenGarmentItemIds(pricing.hiddenGarmentItemIds)`,
   trusting the server value as-is) and moved "new shops start with garments off" to the one place
   that can actually distinguish genuinely-new from already-configured:
   `BranchManagementService.createBranch` now sets
   `hiddenGarmentItemIds: GARMENT_CATALOG.map((g) => g.id)` at creation time, so only freshly
   created shops start unconfigured, while existing shops' saved state is preserved as-is.
   Category-collapse-by-default was left in place — it's pure UI state with no backend
   persistence, so it carries none of this risk. Typechecked `apps/api` and `apps/partner-web` clean.

7. **[FIXED — 2026-08-12] `garmentPricing`/`addonPricing` accepted ids/slugs not validated against
   the live catalog.** `UpdateBranchHiddenCatalogDto.garmentPricing` only validated each entry's
   shape (`{garmentId: string, price: number>=0}`), not that `garmentId` is an actual
   `GARMENT_CATALOG` id; `updateHiddenCatalog` wrote the array through unchecked. Same gap for
   `addonPricing.addonSlug` (open string) in `updateAddonPricing`. An unknown id/slug sat inert
   (never matched by `resolveBranchGarmentCatalog`'s/`serializeShopAddonPricing`'s lookups) — no
   functional bug, but unbounded write-what-you-want storage growth from a buggy/malicious client.
   `servicePricing.serviceType` was already closed via `IsEnum(BookingType)`, so untouched.
   **Fix:** `updateHiddenCatalog` now rejects any `garmentPricing` entry whose `garmentId` isn't in
   `GARMENT_CATALOG` (`BadRequestException`); `updateAddonPricing` now rejects any `addonSlug` that
   isn't either an active global addon (`catalogService.listActiveAddons()`) or one of this
   branch's own custom addons (`CUSTOM_ADDON_ID_PREFIX`-prefixed slug from `customAddonModel`) —
   both in `apps/api/src/modules/branches/branches.service.ts`. Typechecked `apps/api` clean.

No new findings from the 2026-08-31 pass — `kgPerLoad`, the add-on/service assignment
modal, and `includedQuantity` are all validated server-side (`@Min`/`@IsEnum` on the
relevant DTOs — `update-branch-pricing.dto.ts`, `update-branch-addon-pricing.dto.ts`)
and branch-ownership-checked the same way as every other route on this page
(`getOwnBranchOrThrow` before any non-admin write, including the new
`updateOwnCustomAddon` PATCH).

## Unused/dead fields
None — every field `ShopPricing`/`ShopServicePrice`/`ShopAddonPrice`/`ShopGarmentItem` declares
is read and rendered somewhere on this page.

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook for both the branch list and the
pricing fetch (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md` — this page benefits from that fix
too). No polling or realtime subscription — pricing changes are infrequent
and admin-initiated only via this same page, so a manual reload after Save
is sufficient.
