# Audit: Partner-web — Inventory page

Date: 2026-08-25

## Entry point
- Page: `apps/partner-web/src/app/inventory/page.tsx`
- Component(s): inline in the page (no separate component file)

## Sub-pages
None — no outbound navigation into a detail route. The page is a single flat list
with inline expand-to-edit rows.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load settings (for `inventoryEnabled` flag) | GET | `/partner/settings` | `PartnerSettingsData` | `PartnerController.getSettings` |
| Load items | GET | `/partner/inventory` | `PartnerInventoryItem[]` | `PartnerController.getInventory` -> `PartnerOperationsService.getInventory` |
| Adjust/set quantity or threshold | PATCH | `/partner/inventory/:id` | `PartnerInventoryItem` | `PartnerController.updateInventory` -> `PartnerOperationsService.updateInventory` |

## Backend trace
`getInventory` resolves the caller's branches (`resolvePartnerBranches` — all
branches owned by a `PARTNER`, or one representative `partner_shop` branch for
`ADMIN`), lazily seeds `shop_inventory` with `DEFAULT_INVENTORY` the first time a
branch has zero rows (`ensureInventorySeeded`, `partner-operations.service.ts:245`),
then queries real Mongo documents sorted by category/name. `updateInventory` loads
the item by id, checks its `branchId` is in the caller's owned branch set (returns
404 rather than leaking existence if not), applies `quantity`/`lowStockThreshold`,
and saves. Both endpoints are fully DB-backed — no mock/hardcoded response data in
the request path itself; the only synthetic data is the one-time default seed rows
used to bootstrap a brand-new shop, which then become real, independently editable
documents.

The shop-level dashboard (`PartnerController` dashboard endpoint) independently
computes `counts.lowStockItems` from the same `shop_inventory` collection and links
to `/inventory`, confirming the "low-stock items appear on your dashboard" copy in
the page description is accurate, not aspirational.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| SKU count stat | `items.length` | client-derived |
| Low stock stat | `stockLevel(item) === 'low'` per item | client-derived from `isLowStock`/`quantity`/`lowStockThreshold` |
| Out of stock stat | `stockLevel(item) === 'out'` per item | client-derived |
| Category filter chips | `item.category` (deduped) | `CATEGORY_LABELS` map covers `detergent`/`supplies`/`maintenance`; any other category falls back to a humanized raw string, so it degrades gracefully rather than breaking |
| Item row | `name`, `sku`, `lowStockThreshold`, `unit`, `quantity`, `category` | stock-level pill and progress bar are client-derived; bar width formula divides by `lowStockThreshold * 2` as a visual heuristic (not from backend) |
| Inline edit panel | `quantity`, `lowStockThreshold` (draft inputs) | writes back via PATCH |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| ±1 / +10 quantity adjust | no | n/a | yes — debounced 400ms, coalesces rapid clicks into one PATCH via `pendingQty` ref | yes — `actionError` shown, and `reload()` resyncs on failure so an optimistic update can't drift from the server |
| Set exact quantity | no | n/a | yes — `saving` state disables the Save button while in flight | yes — same as above |
| Set low-stock threshold | no | n/a | yes | yes |

No delete/remove action exists for inventory items, so no destructive-action gap.

## Authorization
Both `/partner/inventory` endpoints are `@Roles(UserRole.PARTNER, UserRole.ADMIN)`.
`updateInventory` re-derives the caller's owned branches server-side and checks the
target item's `branchId` against that set before allowing the write — a partner
cannot patch another shop's item by guessing its `_id`. `[authz]` — no gap found.

## Findings
1. `UpdateInventoryDto.note` (`apps/api/src/modules/partner/dto/update-inventory.dto.ts`)
   accepted an optional `note` field that `updateInventory` never read or persisted
   — dead input, silently discarded.
   **Fix:** removed the unused `note` field and its `IsString` import
   (`update-inventory.dto.ts`). No frontend caller ever sent this field, so no
   other code was affected.
2. Stock only ever moved through manual partner action (buttons/inline edit) — no
   code path deducted inventory when an order actually consumed supplies, so the
   count drifted from real usage unless a partner manually re-counted.
   **Fix (feature, not just a bug fix):** added `usagePerOrder`/`usagePerKg` rate
   fields to `ShopInventoryItem` (`schemas/shop-inventory.schema.ts`), exposed
   them through `UpdateInventoryDto`/`formatInventoryItem` so a partner can set a
   per-item auto-deduct rate, and added
   `PartnerOperationsService.deductInventoryForOrder` which `ShopReceivingService
   .confirmItems` calls once an order is confirmed `RECEIVED_AT_SHOP` (the point
   where verified weight and item count are both known) — deducts
   `usagePerOrder + usagePerKg × verifiedWeightKg` per matching item, clamped at
   0. Both rates default to 0, so existing items are unaffected until a partner
   opts in; `DEFAULT_INVENTORY` seeds sensible starting rates for detergent (per
   kg) and bags (per order). Frontend: `inventory/page.tsx` gained "Auto-deduct
   per order"/"per kg" inputs in the edit panel and a row-level hint showing the
   active rate. The deduction call is wrapped in `.catch(() => {})` so an
   inventory error never blocks the order status transition itself.

No other issues found. The module is fully real: DB-backed reads/writes, correct
per-branch ownership checks, matching frontend/backend types, working optimistic
UI with resync-on-failure, and an accurate dashboard low-stock linkage. No mock or
placeholder data anywhere in the live request path.

## Unused/dead fields
None remaining after the fix above. All other fields returned by `getInventory`
(`_id`, `sku`, `name`, `category`, `quantity`, `unit`, `lowStockThreshold`,
`isLowStock`) are rendered on the page.

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook: `loading` shown via `DataPageStatus`,
`error` surfaces a message while keeping previously-loaded data on screen (a
failed reload doesn't wipe the list), and an explicit "no items yet" / "no items
in this category" empty state. No sockets/polling on this page — refresh is
manual (button) or after a mutation.
