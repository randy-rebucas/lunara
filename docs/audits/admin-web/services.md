# Audit: Admin-web — Laundry services (catalog)

Date: 2026-07-22 (misleading "Polling" badge removed here and across 4 other boards, 2026-07-22)

## Entry point
- Page: `apps/admin-web/src/app/services/page.tsx` -> `ServicesBoard` (`apps/admin-web/src/components/datacenter/services-board.tsx`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Catalog list + manual "Sync" | GET | `/admin/services` | `LaundryServiceRow[]` | `AdminController.getServices` -> `CatalogService.listAllServices` |
| Edit service (label/description/price/min weight/sort order) | PATCH | `/admin/services/:id` | — | `AdminController.updateService` (`UpdateLaundryServiceDto`) |
| Toggle active | PATCH | `/admin/services/:id` | — | Same handler, `{ isActive }` only |

This is the catalog editor referenced by the read-only [categories.md](categories.md) summary page — both
share the same `LaundryServiceRow` shape and backend endpoint.

## Backend trace
`CatalogService.listAllServices()` is a single `find().sort({ sortOrder: 1, label: 1 })` — no aggregation,
bounded by catalog size (a handful of booking types). `UpdateLaundryServiceDto` validates every field the
edit form sends (`label`, `description`, `pricePerKg: @Min(0)`, `minWeightKg: @Min(1)`, `sortOrder: @Min(0)`,
`isActive`) — full 1:1 match with what the frontend submits, both on full edit and the separate
active-toggle PATCH.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| State banner | Client-derived `deriveServiceState()` — "attention" if zero active services | Own logic, not server-provided. |
| Stat tiles (3): Catalog size, Active services, Inactive | Client-counted from the fetched list; each tile also acts as a status-filter toggle | Full use. |
| Service catalog table | Every `LaundryServiceRow` field: `type`, `label`, `description` (tooltip), `pricePerKg`, `minWeightKg`, `sortOrder`, `isActive`, plus row actions (Edit/Activate-Deactivate) | Full field usage — this is the one admin-web page that actually edits `sortOrder`/`description`, which [categories.md](categories.md) and [branches.md](branches.md) both note are only ever *displayed*/*inherited* elsewhere. |
| Edit service form | Same fields, pre-filled from the selected row on `openEdit()` | `type` is intentionally read-only in the form (shown as context text, not an input) — booking type is the catalog key, not editable. |

## Findings
No correctness bugs in the data flow — every fetched field is used, and the DTO matches the form exactly.

One cross-cutting issue found and fixed here first, then swept across the rest of admin-web:

1. **[FIXED] Five boards showed a permanent "Polling" badge with no polling or realtime subscription behind
   it at all** — `services-board.tsx`, plus `categories-board.tsx` (already fixed, see
   [categories.md](categories.md)), `addons-board.tsx`, `refunds-board.tsx`, `reports-board.tsx`, and
   `support-board.tsx`. Unlike pages such as dispatch/orders/riders/live-tracking/control-tower/overview,
   which correctly show `<LiveBadge />` or "Polling" **conditionally** based on `isAdminRealtimeConnected()`
   (a real socket-connection check), these six boards had a bare, unconditional
   `<span className="badge-neutral">Polling</span>` — implying a live-refresh behavior none of them
   actually have (no `setInterval`, no `useAdminOperationsSocket`). Verified by grepping every
   `datacenter/*-board.tsx` file for the conditional `socketLive ?` pattern versus a static badge; the six
   static ones were all fixed by removing the badge (the "Updated {time}" label and manual "Sync" button
   already communicate the real, manual-refresh behavior correctly).

## Unused/dead fields
None — every `LaundryServiceRow` field is both fetched and either displayed or directly editable.

## Loading/error/realtime behavior
- Same shared `useAdminQuery` pattern, so a failed reload keeps the last-good view visible under the error
  banner (fixed during the overview audit, [overview.md](overview.md) Finding 1).
- No realtime socket subscription — correct for this page (now that the badge no longer implies one); a
  manual "Sync" button covers refresh needs for what's expected to be a low-churn catalog.
