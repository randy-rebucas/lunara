# Audit: Admin-web — Reports

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/reports/page.tsx` -> `ReportsBoard` (`apps/admin-web/src/components/datacenter/reports-board.tsx`)

## Sub-pages
None — no outbound navigation into a detail route. The page links to `/`,
`/revenue`, `/orders`, `/refunds`, `/riders` (`QUICK_ACTIONS`, `reports-board.tsx:28-34`,
plus per-tile links on "Total orders"/"Revenue"), all sibling top-level pages,
not per-record detail views of anything fetched on this page.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Period report (7/14/30 day toggle) | GET | `/admin/reports?days=N` | `ReportData` | `AdminController.getReports` -> `AdminService.getReports` |

## Backend trace
`getReports(days)` computes a `from` cutoff date and pulls every order created
since then, filters/sums/groups them entirely in application code (JS `.filter`/
`.reduce`) rather than via a MongoDB aggregation — see Finding 1. `newCustomers`
and `ridersJoined` are simple `countDocuments` calls, both fine as-is. Unlike
`getRevenue` (audited separately, `revenue.md`), which already selects only the
fields it needs and uses aggregation pipelines for its month/week sums, this
endpoint had neither discipline before this pass.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| State banner | Client-derived `deriveReportState()` from `totalOrders`/`completedOrders`/`cancelledOrders` (attention if completion rate <50% or cancel rate >20% — hardcoded thresholds) | Own client-side judgment, not server-provided; thresholds are reasonable defaults but not configurable — low priority, consistent with similar banners on other boards. |
| Stat tiles (7): Total orders, Completed, In flight, Cancelled, Revenue, Avg order, New customers | `totalOrders`, `completedOrders` (+ client `completionRate`), `inFlight` (client-derived: `totalOrders - completed - cancelled`), `cancelledOrders`, `revenue`, `averageOrderValue`, `newCustomers`+`ridersJoined` | Full use of every top-level field; "Total orders" and "Revenue" tiles double as links to `/orders`/`/revenue`. |
| Quick actions chip row | Static `QUICK_ACTIONS` list | Hardcoded link list — fine, these are stable top-level routes, not data-driven. |
| Orders by status (table) | `ordersByStatus` (client-sorted by count, `statusBadgeClass()` maps status substrings to badge colors) | `statusBadgeClass` (`reports-board.tsx:62-70`) is a substring-matching heuristic (`status.includes('cancel')`, `.includes('rider')`, etc.) rather than an explicit key map — more resilient to new statuses than a hardcoded `Record` lookup (falls back to `badge-neutral` instead of breaking), a reasonable design choice, not a finding. |
| Completed by service (table) | `ordersByService` (client-sorted by count, share % of `completedOrders`) | Full use. |

## Mutations
None — this page issues no create/update/delete/toggle requests. "Sync" is a
plain GET re-fetch, and the 7/14/30 day toggle just changes the query param.

## Authorization
`AdminController` is class-level `@Roles(UserRole.ADMIN)` — matches the frontend
(admin-only page). `getReports` takes no user-scoped filter (platform-wide
aggregates, same as `revenue.md`) — no `[authz]` findings. No PII returned,
only counts/sums.

## Findings

1. **`getReports` loaded every matching order in full and processed them entirely in-memory.**
   `AdminService.getReports` (pre-fix) ran `this.orderModel.find({ createdAt: { $gte: from } })`
   with no `.select()` projection — pulling every field of every order in the
   window (addresses, `statusHistory`, `assignmentHistory`, payment references,
   etc.) into Node memory just to compute counts/sums/group-bys that only ever
   need `status`, `total`, `bookingType`, and `createdAt`. This is the same class
   of over-fetch already fixed for `getRevenue` (`revenue.md`), which already
   scopes its raw per-order query to `.select('updatedAt total subtotal deliveryFee discount branchName bookingType')`
   and uses aggregation pipelines for its summary sums — `getReports` had neither.
   **Fix:** added `.select('status total bookingType createdAt')` to the query
   (`admin.service.ts`) — cuts the per-order payload to just the fields actually
   read. Left as a further, unfixed optimization: converting the `totalOrders`/
   `completedOrders`/`ordersByStatus`/`ordersByService` computation into a MongoDB
   `$facet` aggregation (avoiding pulling per-order documents into JS entirely)
   would scale better on a very large order collection, but is a larger,
   behavior-preserving rewrite disproportionate to fix mechanically in this pass
   for an admin-only, low-traffic reporting page — noted for whoever revisits this
   endpoint under real load pressure.

2. **`days` query param had no bounds or type validation.** `AdminController.getReports`
   (`admin.controller.ts:561-564`) does `Number(days) || 7` with no further checks,
   and the service used it directly to compute `from`. A negative value (e.g.
   `?days=-5`) would set `from` in the future, silently returning an always-empty
   report with no error; an arbitrarily large value (e.g. `?days=999999`) would
   query the entire orders collection with no limit — compounding Finding 1's
   over-fetch. The frontend only ever sends `7`, `14`, or `30` (`PERIOD_OPTIONS`,
   `reports-board.tsx:26`), so this only mattered for a direct API call, not
   through the UI.
   **Fix:** clamped in `AdminService.getReports` to `Math.min(Math.max(Math.trunc(days) || 7, 1), 90)`
   (`admin.service.ts`), and the response's `periodDays` now reflects the clamped
   value (not the raw input) so the UI's "Last N days" label always matches the
   actual query window.

## Unused/dead fields
None — every field on `ReportData` is read and rendered somewhere on the page.

## Loading/error/realtime behavior
Standard shared `useAdminQuery` behavior (spinner while `null`, failed reload
keeps prior data, `alert-error` on failure) — same pattern as every other
audited admin-web board. No realtime socket subscription; reasonable for a
periodic reporting page with a manual "Sync" button, consistent with
`revenue.md`.
