# Audit: Partner-web — Inventory page

Date: 2026-08-31

## Entry point
- Page: `apps/partner-web/src/app/inventory/page.tsx`
- Component(s): `AddItemForm` (same file, extracted for the create-item form)

## Sub-pages
None — no outbound navigation into a detail route. The page is a single flat list
with inline expand-to-edit rows, plus an inline add-item form and per-branch/category
grouping.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load settings (for `inventoryEnabled` flag) | GET | `/partner/settings` | `PartnerSettingsData` | `PartnerController.getSettings` |
| Load items | GET | `/partner/inventory` | `PartnerInventoryItem[]` | `PartnerController.getInventory` -> `PartnerOperationsService.getInventory` |
| Create item | POST | `/partner/inventory` | `PartnerInventoryItem` | `PartnerController.createInventoryItem` -> `PartnerOperationsService.createInventoryItem` (`CreateInventoryDto`) |
| Adjust/set quantity, threshold, or auto-deduct rates | PATCH | `/partner/inventory/:id` | `PartnerInventoryItem` | `PartnerController.updateInventory` -> `PartnerOperationsService.updateInventory` (`UpdateInventoryDto`) |
| Delete item | DELETE | `/partner/inventory/:id` | `{ _id: string }` | `PartnerController.deleteInventoryItem` -> `PartnerOperationsService.deleteInventoryItem` |

This module grew since the last audit pass: create and delete are new (previously
read/update only), along with branch filtering/grouping, search, and sort — all
audited fresh here.

## Backend trace
`getInventory` resolves the caller's branches (`resolvePartnerBranches` — all branches
owned by a `PARTNER`, or one representative `partner_shop` branch for `ADMIN`), lazily
seeds `shop_inventory` with `DEFAULT_INVENTORY` the first time a branch has zero rows,
then queries real Mongo documents sorted by category/name. `createInventoryItem`
re-resolves owned branches, resolves the target branch from `dto.branchId` if provided
(falling back to `branches[0]` — an *unordered* result from `branchModel.find()` — when
omitted), rejects a branch not owned by the caller (`ForbiddenException`), and rejects a
duplicate SKU within that branch (`ConflictException`). `updateInventory` and
`deleteInventoryItem` both independently verify the target item's `branchId` is in the
caller's owned-branch set before acting (404, not leaking existence, if not) — a partner
cannot patch or delete another shop's item by guessing its `_id`. All four endpoints are
fully DB-backed — no mock/hardcoded response data in the request path; the only
synthetic data is the one-time default seed rows used to bootstrap a brand-new shop's
branch, which then become real, independently editable/deletable documents.

The shop-level dashboard independently computes `counts.lowStockItems` from the same
`shop_inventory` collection and links to `/inventory`, confirming the "low-stock items
appear on your dashboard" copy is accurate.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| SKU count / Low stock / Out of stock stats | `items.length`, `stockLevel(item)` per item | all client-derived from `isLowStock ?? quantity <= lowStockThreshold` |
| Search box | `item.name`, `item.sku` (substring match, case-insensitive) | client-side filter only |
| Sort select | `name`/`quantity`/`stock` | client-side sort; "stock" uses a hardcoded `STOCK_RANK` map (`out`:0,`low`:1,`ok`:2) |
| Branch filter chips | `item.branchId`/`item.branchName` (deduped, shown only when `branches.length > 1`) | client-side filter |
| Category filter chips | `item.category` (deduped) | `CATEGORY_LABELS` covers `detergent`/`supplies`/`maintenance`; unknown categories fall back to a humanized raw string, so it degrades gracefully |
| Item row | `name`, `sku`, `lowStockThreshold`, `unit`, `quantity`, `category`, `usagePerOrder`/`usagePerKg` (shown only if >0) | stock-level pill and progress bar are client-derived; bar width divides by `lowStockThreshold * 2` as a visual heuristic, not from backend |
| Inline edit panel | `quantity`, `lowStockThreshold`, `usagePerOrder`, `usagePerKg` (draft inputs) | writes back via PATCH, one field at a time |
| Add-item form | `sku`, `name`, `category`, `unit`, `quantity`, `lowStockThreshold`, and (multi-branch only) a `branchId` select | writes via POST; category/unit are free-text, not constrained to `CATEGORY_LABELS`' keys |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Create item | no | n/a | yes — `saving` disables the Add button | yes — inline `error` in the form (e.g. duplicate SKU) |
| ±1 / +10 quantity adjust | no | n/a | yes — debounced 400ms, coalesces rapid clicks via `pendingQty` ref | yes — `actionError` shown, `reload()` resyncs on failure |
| Set exact quantity / threshold / usage rates | no | n/a | yes — `saving` disables the relevant Save button | yes — same as above |
| Delete item | **yes** — removes the row entirely | yes — `window.confirm(...)` (page.tsx:256) | yes — `saving` disables the Delete button while in flight | yes — `actionError` shown |

## Authorization
All five `/partner/inventory*` endpoints are `@Roles(UserRole.PARTNER, UserRole.ADMIN)`.
`createInventoryItem`, `updateInventory`, and `deleteInventoryItem` all independently
re-derive the caller's owned branches server-side and check branch ownership before
allowing the write — a partner cannot create/patch/delete another shop's item by
supplying an arbitrary `branchId` or item `_id`. `[authz]` — no gap found.

## Findings

1. **A multi-branch partner adding an item while filtered to a specific shop could
   silently create it under the wrong branch.** `AddItemForm` never sent a `branchId`
   in its POST body (pre-fix), so `createInventoryItem` always fell back to
   `branches[0]` (`partner-operations.service.ts:1162`) — the first branch returned by
   `resolvePartnerBranches`'s unsorted `branchModel.find(...)` (`:243`), an arbitrary
   order unrelated to which branch's items the partner was currently looking at via the
   page's own branch filter chips. A partner viewing "Shop B" and clicking "Add item"
   could have the new SKU appear under "Shop A" instead, with no indication anything
   went to the wrong place.
   **Fix:** `AddItemForm` now takes `branches`/`defaultBranchId` props and, when the
   caller owns more than one branch, shows an explicit "Shop" select (defaulting to
   the page's active branch filter, or the first branch if filtered to "All shops"),
   sending that `branchId` in the POST body — `apps/partner-web/src/app/inventory/page.tsx`
   (`AddItemForm` definition and its call site in `InventoryPage`). Single-branch
   partners are unaffected: `branches.length > 1` gates both the new select and whether
   `branchId` is sent at all, so the backend's existing single-branch fallback path is
   untouched.
2. The add-item form's Category and Unit fields are free-text (page.tsx: `category`/`unit`
   inputs), not constrained to `CATEGORY_LABELS`' known keys (`detergent`/`supplies`/
   `maintenance`) or the units used by `DEFAULT_INVENTORY`. A typo'd category (e.g.
   `"Detergent"` vs `"detergent"`) creates a new, uncombined filter chip rather than
   merging into the existing group. **Left unfixed** — `categoryLabel()` already
   degrades gracefully for unknown categories (humanizes the raw string rather than
   breaking), and constraining input to a fixed category list is a product/UX decision
   (e.g. datalist vs. dropdown vs. allowing genuinely custom categories) rather than a
   bug.

## Unused/dead fields
None — all fields returned by `getInventory`/`createInventoryItem`/`updateInventory`
(`_id`, `branchId`, `branchName`, `branchCode`, `sku`, `name`, `category`, `quantity`,
`unit`, `lowStockThreshold`, `isLowStock`, `usagePerOrder`, `usagePerKg`) are rendered
somewhere on the page (`branchCode` is the one exception — returned but not directly
rendered; not sensitive, and `branchName` already covers the same row-grouping need,
so not flagged as a problem).

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook: `loading` shown via `DataPageStatus`, `error`
surfaces a message while keeping previously-loaded data on screen, and explicit
"no items yet" / "no items in this category" empty states. No sockets/polling on this
page — refresh is manual (button) or after a mutation.
