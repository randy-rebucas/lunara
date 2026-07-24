# Audit: Partner-web — Inventory

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/inventory/page.tsx`
- Component(s): inline in the page file, no separate board component

## Sub-pages
None — no outbound navigation into a dynamic detail route. The disabled-state
banner links to `/settings` (a sibling top-level page), not a detail view of
this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Inventory-enabled flag | GET | `/partner/settings` | `PartnerSettingsData` | (traced separately — not this module's endpoint, only `settings.settings.inventoryEnabled` is read here) |
| List inventory | GET | `/partner/inventory` | `PartnerInventoryItem[]` | `PartnerController.getInventory` -> `PartnerOperationsService.getInventory` |
| Update item | PATCH | `/partner/inventory/:id` | `PartnerInventoryItem` | `PartnerController.updateInventory` -> `PartnerOperationsService.updateInventory` |

## Backend trace
`getInventory` resolves the caller's branch(es) via the same
`resolvePartnerBranches` helper used by the dashboard and revenue endpoints
(`PARTNER` → branches they own; `STAFF` → n/a on this route, not in `@Roles`;
`ADMIN` → one representative `partner_shop` branch), lazily seeds a fixed set
of ~10 default SKUs (detergent/supplies/maintenance) into any of those
branches that have no inventory rows yet, then returns only items scoped to
those branch ids. `updateInventory` resolves the same branch set and rejects
(404) any `itemId` that doesn't belong to one of them. Before the fix, none
of this scoping existed — see Finding #1.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| SKU count / Low stock / Out of stock stat tiles | client-derived from `items[]` via `stats` (`.length`, `stockLevel(i) === 'low'/'out'` counts) | |
| Category filter chips | `categories` (client-derived `Set` of `item.category`), only shown when `categories.length > 1` | |
| Per-category item list | `item.name`, `.sku`, `.category` (via `categoryLabel`, hardcoded label map + fallback), `.quantity`, `.unit`, `.lowStockThreshold`, `.isLowStock` (falls back to client computing `quantity <= lowStockThreshold` if absent) | stock-level badge/row-tint/progress-bar color all derived client-side from the same `stockLevel()` helper — consistent, not duplicated logic |
| Quantity adjust buttons (−1/+1/+10) | `item.quantity` | optimistic update, debounced 400ms — see Findings for the failure-rollback fix |
| Adjust panel (Set quantity / Low-stock alert) | draft-local `draftQty`/`draftThreshold` state, seeded from `item.quantity`/`.lowStockThreshold` on open | |
| Disabled-state banner (when `!inventoryEnabled`) | `settingsData.settings.inventoryEnabled` | links to Settings to turn tracking on |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Quick adjust (−1/+1/+10, debounced) | no | n/a | partial — buttons stay enabled during the 400ms debounce window (only `disabled={busy}` once the actual PATCH is in flight), so rapid clicks queue via `pendingQty`/timer reset rather than firing duplicate requests; correctly coalesces into one PATCH per burst | **no (before fix)** — a failed PATCH left the optimistically-updated quantity on screen with no rollback, see Findings |
| Save quantity / Save alert threshold (draft panel) | no | n/a | yes (`disabled={busy}`) | yes (`actionError`), and doesn't apply any local state until the PATCH succeeds, so no rollback is needed on this path |

## Authorization

`GET /partner/inventory` and `PATCH /partner/inventory/:id` are both `@Roles(UserRole.PARTNER, UserRole.ADMIN)` (`partner.controller.ts:486,494-499`) — matches the frontend (`useRequirePartner`). Before the fix, the underlying data had **no partner/branch scoping at all** (see Finding #1) — any authenticated partner account could view and edit every other partner's inventory. After the fix, both routes scope through `resolvePartnerBranches(userId, role)`, the same helper the dashboard/revenue endpoints already use, so a `PARTNER` only ever sees/edits branches they own, and `updateInventory` 404s on any `itemId` outside that set rather than revealing it exists.

## Findings

1. **[authz] [FIXED] Inventory had no per-partner/per-branch scoping — every partner shared one global inventory pool and could read/edit every other partner's stock.** `getInventory` returned `this.inventoryModel.find()` with zero filter (pre-fix), and `updateInventory` accepted any `itemId` with no ownership check — both reachable by any `PARTNER`-role account. Root cause: the `ShopInventoryItem` schema had no `branchId`/`partnerId` property at all, and its `sku` was declared **globally** unique — the data model was built as one shared, platform-wide inventory rather than one per shop. Concretely: Partner A could open `/inventory`, see Partner B's detergent stock counts, and adjust them (accidentally or otherwise) — a real cross-tenant confidentiality and integrity issue, not just a display bug.
   **Fix:**
   - Added a required `branchId` field to `ShopInventoryItem` and replaced the bare-`sku` unique index with a compound `(branchId, sku)` index, so each shop has its own SKU namespace — `apps/api/src/modules/partner/schemas/shop-inventory.schema.ts`. Pre-existing rows (created before this field existed) have no `branchId` and are now orphaned rather than migrated — there was no reliable way to attribute the old shared rows to one specific branch, so they're simply excluded by every query going forward (harmless, not deleted). **Deployment note:** Mongoose's `autoIndex` creates the new compound index automatically but does not drop the old single-field unique index on `sku`; that stale index must be dropped manually in any already-deployed database (`db.shop_inventory.dropIndex('sku_1')`) before two branches can share a SKU code — flagging this explicitly since it's a real gap between "fixed in code" and "fully effective in a running deployment."
   - `ensureInventorySeeded` now takes a `branchId` and seeds the default SKU set per-branch (only for branches that have none yet) instead of once globally — `partner-operations.service.ts:214-220`.
   - `getInventory(userId, role)` and `updateInventory(userId, role, itemId, dto)` now resolve the caller's branches via the existing `resolvePartnerBranches` helper (same one `getDashboard`/`getReports`/etc. already use) and scope reads/writes to those branch ids; `updateInventory` 404s on any item outside that set — `partner-operations.service.ts:825-846`. Controller routes updated to pass `req.user.sub`/`req.user.role` through — `partner.controller.ts:485-499`.
   - **Regression-checked the dashboard's low-stock count**, which shared the same root cause: `getDashboard`'s `lowStock` tile queried `this.inventoryModel.countDocuments({ $expr: ... })` with no branch filter either (the same global-pool bug, one level removed) — it's now scoped by the same `staffBranchIds` the rest of that method already computes for `PARTNER`/`STAFF`, and left unscoped for `ADMIN` (consistent with how every other admin-facing count in that method already behaves) — `partner-operations.service.ts:247-269,300-303`.
   - Typechecked `apps/api` and `apps/partner-web` clean; grepped for any other caller of the old zero-arg `ensureInventorySeeded()`/`getInventory()`/`updateInventory()` signatures — none found outside the files changed.

2. **Failed quantity adjustments left the UI silently out of sync with the server.** `adjustQty` applies an optimistic `setData` update immediately, then debounces the actual `PATCH` by 400ms (`page.tsx:113-124`). If that debounced `patchItem` call failed (pre-fix), the `catch` block only set `actionError` — it never reverted the optimistically-changed quantity (`page.tsx:103-105`), so the on-screen count would keep showing a value the server never actually saved, with only a generic error banner as a clue, and no way to notice which item was affected without manually reloading.
   **Fix:** `patchItem`'s catch block now calls `reload()` to resync the whole list from the server after a failed save, `apps/partner-web/src/app/inventory/page.tsx:103-108` — guarantees the UI never keeps showing an unsaved optimistic value.

3. **[shared-code] `usePartnerQuery`'s `reload()` wiped previously-loaded data on any fetch error, unlike the equivalent shared hook.** `apps/partner-web/src/lib/use-partner-query.ts` is a partner-web-local copy of `@lunara/hooks`' `useAsyncQuery` (which `admin-web`'s `useAdminQuery` re-exports directly, `apps/admin-web/src/lib/use-admin-query.ts:1`) — but the partner-web copy had drifted: its `reload()` called `setData(null)` in the `catch` block (pre-fix), while the canonical shared hook deliberately does not, with a comment explaining why ("Keep any previously loaded data on screen; only the initial load has none yet."). This affected **all 14 other pages in partner-web that use `usePartnerQuery`** (`orders/history`, `services`, `settings`, `staff`, `profile`, `orders/[id]`, the dashboard `page.tsx`, `customers`, `reports`, `settlements`, `revenue`, `orders`, `orders/progress`, plus this page) — any transient network error during a background refresh would blank the entire page back to its empty state instead of just showing an error banner over the last-good data, exactly the systemic bug class step 12 of this skill calls out.
   **Fix:** removed the `setData(null)` line from `use-partner-query.ts`'s `reload()`, matching `@lunara/hooks`' `useAsyncQuery` behavior exactly — `apps/partner-web/src/lib/use-partner-query.ts:14-26`. Left the file as its own local copy rather than switching to re-export `@lunara/hooks` directly (the approach `admin-web` uses) because `@lunara/hooks` isn't currently a `partner-web` dependency (not in `package.json`, not in `next.config.ts`'s `transpilePackages`) — wiring that up is a monorepo dependency change beyond this page-level fix's scope, so the minimal, verifiable fix was applied in place instead. Checked: all 14 consumers benefit from the same fix with no behavior change needed on their end (they all already assumed `data` — like admin-web pages — stays populated through an error, since none of them null-guard `data` specifically because of a possible reload-triggered wipe).

No other frontend/backend field mismatches found — every field `PartnerInventoryItem` declares (`_id`, `sku`, `name`, `category`, `quantity`, `unit`, `lowStockThreshold`, `isLowStock`) is both returned by `formatInventoryItem` and rendered on the page.

## Unused/dead fields
None — every field the inventory endpoints return is rendered somewhere on the page.

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook (see Finding #3) for both the settings
flag and the inventory list — spinner via `DataPageStatus`, error text without
(after the fix) clearing prior data, and an explicit "no items yet" /
"no items in this category" empty state depending on whether any items exist
at all vs. just the current filter being empty. No polling or realtime
subscription — a manual "Refresh" button triggers `reload()`.
