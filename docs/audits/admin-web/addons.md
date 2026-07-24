# Audit: Admin-web — Booking add-ons (catalog)

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/addons/page.tsx` -> `AddonsBoard` (`apps/admin-web/src/components/datacenter/addons-board.tsx`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Catalog list + manual "Sync" | GET | `/admin/addons` | `LaundryAddonRow[]` | (catalog addon list handler) |
| Edit add-on (label/description/price/image URL/sort order) | PATCH | `/admin/addons/:id` | — | `UpdateLaundryAddonDto` |
| Toggle active | PATCH | `/admin/addons/:id` | — | Same handler, `{ isActive }` only |
| Upload add-on image | POST | `/admin/addons/:id/image` | `LaundryAddonRow` | (dedicated image-upload handler, persists + returns the updated row) |

Structurally this is the add-on equivalent of the already-audited [services.md](services.md) — same
catalog-editor shape, same shared `ListControls`/stat-tile/edit-form pattern.

## Backend trace
Not independently re-traced (catalog-sized, bounded list). `UpdateLaundryAddonDto` validates every field the
edit form sends: `label`, `description`, `price: @Min(0)`, `imageUrl`, `sortOrder: @Min(0)`, `isActive` —
full 1:1 match with what the frontend submits on both the full edit and the separate active-toggle PATCH.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| State banner | Client-derived `deriveAddonState()` — "attention" if zero active add-ons | Same pattern as [services.md](services.md)'s `deriveServiceState()`. |
| Stat tiles (3): Catalog size, Active add-ons, Inactive | Client-counted from the fetched list; each tile is also a status-filter toggle | Full use. |
| Add-on catalog table | Every `LaundryAddonRow` field: `slug`, `label`, `description` (tooltip), `price`, `imageUrl` (resolved thumbnail), `sortOrder`, `isActive`, plus row actions (Edit/Activate-Deactivate) | Full field usage — no unit ambiguity here since `LaundryAddon.price` is a flat, unitless catalog field (mirrors the earlier finding that catalog-level schemas have no per-kg/load/piece variance; that only exists at the branch-pricing-override level, see [branches.md](branches.md) Finding 4). |
| Edit add-on form | Same fields, pre-filled from the selected row; includes a click-to-upload image thumbnail plus a manual image-URL override input | `slug` is intentionally read-only in the form (shown as context text) — the catalog key, not editable, matching `type` on the services page. |

## Findings
No correctness bugs. The one cross-cutting issue this page shared with several others — a static "Polling"
badge with no polling/socket behind it — was already found and fixed during the [services.md](services.md)
audit's sitewide sweep (this file was one of the four fixed alongside it).

## Unused/dead fields
None — every `LaundryAddonRow` field is both fetched and either displayed or directly editable.

## Loading/error/realtime behavior
- Same shared `useAdminQuery` pattern, so a failed reload keeps the last-good view visible under the error
  banner (fixed during the overview audit, [overview.md](overview.md) Finding 1).
- No realtime socket subscription — correct for this page; a manual "Sync" button covers refresh needs for
  what's expected to be a low-churn catalog, consistent with [services.md](services.md).
- Image upload has its own loading (`uploading` state, spinner + disabled thumbnail) and error handling,
  separate from the main edit-form save — a reasonable split since the two are genuinely independent
  operations (upload persists immediately server-side; the rest of the form only saves on submit).
