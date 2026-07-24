# Audit: Admin-web — Service categories

Date: 2026-07-22 (description tooltip wired up; misleading "Polling" badge removed 2026-07-22)

## Entry point
- Page: `apps/admin-web/src/app/categories/page.tsx` -> `CategoriesBoard` (`apps/admin-web/src/components/datacenter/categories-board.tsx`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Initial load + manual "Sync" | GET | `/admin/services` | `LaundryServiceRow[]` | `AdminController.getServices` -> `CatalogService.listAllServices` |

This is a **read-only** grouping/summary view — all editing (pricing, active toggle, sort order,
description) happens on the linked `/services` page (`services-board.tsx`), which shares the same backend
endpoint and row shape.

## Backend trace
`CatalogService.listAllServices()` does a single `find().sort({ sortOrder: 1, label: 1 })` — this matters
for this page specifically: services are grouped into per-type categories by iterating the fetched array
in order and appending to a `Map`, so each category's service list is displayed in the exact order the
backend already sorted them in (by `sortOrder`, then `label`). The frontend never needs to read `sortOrder`
directly to get correct ordering — it's inherited for free from the fetch order. Categories themselves
(the distinct `type` groups) are then sorted alphabetically by the frontend.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Stat tiles (3): Categories, Active services, Total services | All client-derived from the fetched `LaundryServiceRow[]` (grouped/counted in `categories` memo) | No backend aggregation — reasonable for what's expected to be a small, static catalog. |
| Category cards | `CategoryGroup.type`, `.services.length`, `.activeCount`, and per-service `label`, `pricePerKg`, `minWeightKg`, `isActive`, and now `description` (tooltip, see Findings) | `sortOrder` isn't read directly but its effect is present via fetch order (see Backend trace). |
| Footer note | Static text linking to `/services` for editing | No fetched data. |

## Findings

1. **[FIXED] `description` was fetched but never surfaced anywhere, not even as a tooltip.**
   The linked `/services` page already shows the same field as a `title` attribute on its truncated label
   (`title={s.description}`) so admins can hover a truncated row to read the full description. This page's
   service rows are truncated the same way but had no such tooltip. Fix: added the identical
   `title={s.description || undefined}` pattern to this page's service label.

2. **[FIXED] The header showed a permanent "Polling" badge with no actual polling behind it.**
   Unlike live-tracking/control-tower, this page has no `setInterval` and no realtime socket subscription —
   it only refetches on mount or a manual "Sync" click. The static badge implied a live-refresh behavior
   that didn't exist. Fix: removed the badge rather than fabricate polling this page doesn't need; the
   "Updated {time}" label and "Sync" button already communicate its actual (manual-refresh) behavior.
   The same issue turned out to affect four other boards too — swept and fixed together, see
   [services.md](services.md) Finding 1.

## Unused/dead fields
None remain — `sortOrder` doesn't need to be read directly (see Backend trace) and `description` is now
used (see Finding 1).

## Loading/error/realtime behavior
- Same shared `useAdminQuery` pattern, so a failed reload keeps the last-good view visible under the error
  banner (fixed during the overview audit, [overview.md](overview.md) Finding 1).
- No realtime socket subscription — reasonable for a largely-static service catalog; a manual "Sync" button
  covers refresh needs. The header's misleading "Polling" badge is fixed, see Finding 2.
- Empty state (no service categories) includes an actionable seed-command hint rather than a generic
  "nothing here" message — good practice already in place.
