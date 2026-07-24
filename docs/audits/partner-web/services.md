# Audit: Partner-web — Services & pricing

Date: 2026-07-23

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
| Delete custom add-on | DELETE | `/partner/branches/:id/custom-addons/:addonId` | — | `BranchesService.deleteCustomAddon` |

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

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Shop selector | `branches[].name/city` (only rendered when `branches.length > 1`) | auto-selects the first branch on load |
| Services table | `s.label`, per-row pricing-unit `<select>` (`serviceUnits[s.type]`), the matching rate input (`servicePrices`/`serviceLoadPrices`/`servicePiecePrices[s.type]` depending on selected unit — each is its own independent local-state bucket, correctly read/written per unit, not a shared single field), a live "Customer pays" preview (`base * MARKUP_MULTIPLIER`), and an Offer/Hidden checkbox (`hiddenServiceTypes`) | custom services (`s.isCustom`) render as a simpler read-only-priced row with a Delete button instead |
| Add-ons table | Same shape as Services, keyed by `slug` instead of `type` | |
| Add custom service / add-on forms | Local draft state (`newService`/`newAddon`), Add button disabled until required fields are filled | |
| Save pricing button | n/a (submits all local draft state) | |

`MARKUP_MULTIPLIER` was a locally hardcoded `1.3` — see Finding #2.

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save pricing (3 parallel PATCHes: services, add-ons, hidden catalog) | no | n/a | yes (`disabled={saving}`) | yes (`saveError`); on partial failure `Promise.all` rejects before `reloadPricing()`, but nothing is lost — local edits stay in place for retry, and any request that did succeed is idempotently re-sent on the next attempt |
| Add custom service / add-on | no | n/a | yes (`disabled={addingService/addingAddon || ...required fields empty}`) | yes (`rowError`) |
| Delete custom service / add-on | yes — permanently removes a partner-defined service/add-on and its pricing | **no (before fix)** | no busy-state guard, but the backend delete is idempotent (`deleteCount === 0` -> a harmless `NotFoundException` on a duplicate click, not a second deletion of something else) | yes (`rowError`) |

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

## Unused/dead fields
None — every field `ShopPricing`/`ShopServicePrice`/`ShopAddonPrice` declares
is read and rendered somewhere on this page.

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook for both the branch list and the
pricing fetch (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md` — this page benefits from that fix
too). No polling or realtime subscription — pricing changes are infrequent
and admin-initiated only via this same page, so a manual reload after Save
is sufficient.
