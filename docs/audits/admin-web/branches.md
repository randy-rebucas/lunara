# Audit: Admin-web — Branches (network tree + branch profile)

Date: 2026-07-22 (parent-branch dropdown fixed; ShopPricingPanel error handling added; partner-owner and
service-radius fields wired up; customer-price unit suffix fixed 2026-07-22, after a full line-by-line
re-pass of the whole 1340-line board)

## Entry point
- Page: `apps/admin-web/src/app/branches/page.tsx` -> `BranchesBoard` (`apps/admin-web/src/components/datacenter/branches-board.tsx`, 1340 lines — the largest board audited so far)
- Sub-component: `ShopPricingPanel` (`apps/admin-web/src/components/datacenter/shop-pricing-panel.tsx`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Network tree + stats | GET | `/admin/branches/network` | `{ tree: BranchTreeNode[]; totalBranches; operationalCount }` | `AdminController.getBranchNetwork` -> `BranchManagementService.getNetworkTree` |
| Meta: branches (for parent selector), shops, riders | GET | `/admin/branches/parents` (fixed, was `/admin/branches`), `/admin/shops`, `/admin/riders` | — | `AdminController.getParentBranches` -> `BranchesService.listParentBranches`, etc. |
| Selected branch profile | GET | `/admin/branches/:id/profile` | `BranchProfile` | `AdminController` -> (branch profile handler) |
| Create branch | POST | `/admin/branches` | — | `AdminController.createBranch` |
| Update branch settings/address, toggle active, assign rider, logo upload/remove | PATCH/POST/DELETE | `/admin/branches/:id`, `/:id/assigned-rider`, `/:id/logo` | — | `AdminController` (various) |
| Pricing (per-kg service rates, add-on rates) | GET/PATCH | `/admin/services`, `/admin/addons`, `/admin/branches/:id/pricing`, `/:id/addon-pricing` | `CatalogServiceOption[]`, `CatalogAddonOption[]` | (`ShopPricingPanel`, separate component) |

## Backend trace
`BranchManagementService.getBranchProfile()` (backs `GET /admin/branches/:id/profile`) runs 8 queries in
parallel (manager, staff, parent, children, active-order count, current weight load, performance metrics,
daily quota usage) plus one more for the partner owner, and returns a much richer object than the frontend
originally consumed — see Finding 2. `listParentBranches()` and `listBranches()` are two deliberately
different queries: `listBranches()` filters through `operationalBranchFilter()`, which explicitly excludes
`branchType: 'hq'`; `listParentBranches()` is a separate, explicitly-commented ("All active branches
including HQ — lightweight list for parent branch selectors") endpoint built for exactly the dropdown this
page has. See Finding 1. `updateBranch()` (backs the settings-tab PATCH) already had full, validated support
for `serviceRadiusKm` (`@Min(1) @Max(50)` in `UpdateBranchDto`) with no frontend field to send it — see
Finding 2.

## Cards / panels
This audit was done in two passes: an initial targeted-search pass across each major data shape
(`BranchTreeNode`, `BranchProfile` and its nested `hierarchy`/`capacity`/`dailyQuota`/`performance`/`manager`/
`staff`/`machines`, and the `meta` bundle), followed by a full line-by-line read of the entire 1340-line file
to catch anything a search-based pass would miss. Every field in every frontend interface is now rendered
somewhere on the page (network tree node labels, branch profile header/metrics, hierarchy parent/children
links, capacity + daily-quota bars, performance score/label, partner/manager/staff/machines lists,
assigned-rider panel, logo upload, and the settings/address/pricing tabs) — the two exceptions found in the
full pass are Finding 2, now fixed.

Notable design choices worth flagging (not bugs):
- `updateBranch()` combines the settings-tab and address-tab saves into one shared PATCH, with a
  well-commented guard (`numericField()`) against accidentally zeroing capacity/quota fields when a form
  input is left blank — a good defensive pattern, not present verbatim elsewhere in admin-web but worth
  reusing if a similar numeric-field-editing panel is built later.
- `ShopPricingPanel` intentionally suppresses `exhaustive-deps` on its data-loading effect (keyed only on
  `branchId`) so it reseeds prices from the branch's current override values whenever the selected branch
  changes, without refetching the catalog on every unrelated re-render.

## Findings

1. **[FIXED] The "Create branch" form's Parent branch dropdown could never offer HQ as a parent.**
   The dropdown was populated from `meta.branches`, sourced from `GET /admin/branches` ->
   `BranchesService.listBranches()`, which runs every branch query through `operationalBranchFilter()` —
   and that filter explicitly excludes `branchType: 'hq'` (`{ isActive: true, branchType: { $ne: 'hq' } }`,
   used across most of `BranchesService`'s customer/dispatch-facing queries, where excluding HQ makes sense).
   Meanwhile, `BranchesService.listParentBranches()` is a separate, purpose-built endpoint — its own comment
   reads "All active branches including HQ — lightweight list for parent branch selectors" — that the
   frontend never called. Since the network tree explicitly models HQ as the root with franchises/shops
   nested under it (`BranchTreeNode.branchType === 'hq'` with `children`), an admin creating a new top-level
   franchise directly under HQ had no way to select it from this dropdown. Fix: `loadMeta()` now calls
   `GET /admin/branches/parents` instead of `GET /admin/branches` for the dropdown's data source — nothing
   else on the page used `meta.branches`, so this was a pure swap with no other call sites to update.

2. **[FIXED] `ShopPricingPanel` failed silently if its catalog fetch errored.**
   The pricing tab's `/admin/services`/`/admin/addons` fetches were each wrapped in `.catch(() => {})`, and
   the component returned `null` whenever `services`/`addons` weren't loaded — so a network blip or backend
   error left the entire pricing tab blank with zero indication anything went wrong, no different from a
   still-loading state. Fix: both fetches now run through a single `loadCatalog()` that surfaces a real
   `alert-error` message plus a "Retry" button on failure (bumping a `loadAttempt` counter re-runs the
   effect), and a "Loading pricing…" message is shown while genuinely still loading, so a real error is no
   longer indistinguishable from "not loaded yet."

3. **[FIXED] The branch profile fetched the partner owner's contact and the branch's dispatch service
   radius, but neither was ever surfaced or editable on the page.** Found during the full line-by-line
   re-pass (the earlier targeted-search pass checked field usage *within* the frontend's own type
   declarations, which meant these two — present in the backend response but never even declared in the
   frontend `BranchProfile` type — weren't caught until reading the backend handler directly against the
   full response shape):
   - `partner: { id, email, phone } | null` — the actual partner account that owns this branch, returned by
     `getBranchProfile()` alongside `manager`/`staff`, but with no corresponding field in the frontend type
     at all. An admin reviewing a branch had no way to see who owns it without leaving this page — the
     "Manager" card usually reads "Not assigned" (most branches don't have a separate branch-manager
     account), so this was the one piece of ownership contact info actually missing. Fix: added a "Partner
     owner" card (email/phone) alongside Manager/Staff/Assigned rider.
   - `serviceRadiusKm` — the distance within which dispatch/rider-assignment considers this shop eligible
     for a pickup (used directly in `RiderAssignmentService`'s radius filtering). Fully supported end-to-end
     on the backend (`UpdateBranchDto.serviceRadiusKm`, validated `@Min(1) @Max(50)`, already applied in
     `BranchManagementService.updateBranch()`) but had no input field anywhere in admin-web — an admin could
     not see or change a shop's dispatch radius without touching the database directly. Fix: added a
     "Service radius (km)" input to the Edit branch tab, wired through the same `numericField()`
     blank-skips-not-zeroes guard already used for the other capacity fields.

4. **[FIXED — upgraded from a label bug to an editing bug] `ShopPricingPanel` edited the wrong rate field
   for any service or add-on not priced per kg.**
   Branch-level pricing carries a real `pricingUnit` per service/add-on (`per_kg` / `per_load` / `per_piece`,
   or unset/`flat_bag` meaning a flat per-order price — mirrors `BranchPricingMode` in `packages/types`) —
   and four *separate* rate fields (`basePricePerKg`, `basePricePerLoad`, `basePricePerPiece`, plus
   add-ons' flat `basePrice`), of which only the one matching the active `pricingUnit` is actually consulted
   at checkout (`booking.service.ts` branches strictly on `pricingMode` to pick the field). The panel's
   input for every row was unconditionally bound to `basePricePerKg` (services) / `basePrice` (add-ons) on
   both read and write, regardless of the row's real `pricingUnit`. Practical impact: for a service/add-on
   priced per load or per piece, the number an admin saw and typed here was never the field checkout
   actually reads, and saving it wrote to the *wrong* field — the real per-load/per-piece rate was silently
   left untouched, so price edits for any non-per-kg service/add-on had **no effect on customer billing at
   all**. This was first spotted as just a hardcoded `/kg` label in the preview text (fixed as a labeling
   issue), but tracing where that number actually came from surfaced the deeper read/write bug. Fix: added
   `rateFieldFor(pricingUnit, kind)` to resolve the one correct field per row for both seeding the input's
   initial value and writing it back on save (carrying every other, inactive rate field through unchanged,
   since both PATCH endpoints replace the whole pricing array). `unitSuffix()` (from the original labeling
   fix) is kept for the "customer pays" preview text, now backed by the same correctly-bound value. Also
   added the missing `basePricePerKg`/`basePricePerLoad`/`basePricePerPiece`/`pricingUnit` fields to the
   frontend `BranchAddonPrice` type, which only declared `addonSlug`/`basePrice` before.

5. **[FIXED] `CreateBranchDto`/`UpdateBranchDto` accepted empty-string `line1`/`city`/`province`.**
   Found while auditing the Setup page (`docs/audits/admin-web/setup.md`), which shares the same
   `BranchAddressEditor` component and the same validation gap: `@IsString()` alone accepts `''`, and
   the shared address editor's text inputs had no `required` attribute, so a branch could be created or
   edited with a valid lat/lng (set via map click/drag) but a blank street/city/province — data several
   pages display directly (e.g. Settings' "Service coverage" table). Fix: added `@IsNotEmpty()` alongside
   `@IsString()` on all three fields in `create-branch.dto.ts` and `update-branch.dto.ts`, and `required`
   to the shared editor's text inputs (`branch-address-editor.tsx`) — fixed once for every consumer
   (Branches, Setup, and Partners onboarding all use the same component/DTOs).

6. **[FIXED] Hardcoded markup multiplier duplicated the shared `@lunara/utils` constant.**
   Found while auditing partner-web's Services & pricing page (`docs/audits/partner-web/services.md`),
   which shares the same "customer pays" preview logic: `shop-pricing-panel.tsx:35` hardcoded
   `MARKUP_MULTIPLIER = 1.3` locally instead of importing `SHOP_PRICE_MARKUP_MULTIPLIER` from
   `@lunara/utils` — the actual constant `applyShopMarkup` (the function the backend uses to compute
   the `customerPricePerKg`/`customerPrice` fields this page reads) is built on. Currently in sync
   (both `1.3`), but nothing enforced that. Fix: now imports the shared constant instead of
   hardcoding it — same fix applied in both places this duplicate existed.

## Unused/dead fields
None remain in the frontend types (see Cards/panels and Finding 3). Two backend capabilities are unused by
admin-web but confirmed intentional, not orphaned:
- `GET/PATCH /admin/branches/:id/custom-services` and `/custom-addons` — these back **partner-web**'s own
  Services & Pricing page (per-branch-variant custom pricing), not an admin-web feature; admin-web manages
  base shop pricing via `ShopPricingPanel` instead.
- `PATCH /admin/branches/:id/main-shop` — used by partner-web's settings page, not admin-web.

## Loading/error/realtime behavior
- Same shared `useAdminQuery` pattern for the network tree; the selected branch's profile fetch is a
  separate, manually-managed `useState`/`AbortController` fetch (not `useAdminQuery`) so switching branches
  properly cancels the previous in-flight profile request rather than racing it — a correct and important
  detail for a master-detail page like this one (`useEffect` cleanup calls `controller.abort()` on
  `selectedId` change).
- No realtime socket subscription on this page — reasonable, branch network topology/config doesn't change
  as a live-ops event stream; a manual "Sync" button covers refresh needs.
- `ShopPricingPanel`'s catalog load now has explicit loading/error/retry states (fixed, see Finding 2)
  instead of silently rendering nothing on failure.
