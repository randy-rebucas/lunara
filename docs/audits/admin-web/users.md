# Audit: Admin-web — Users

Date: 2026-07-22 (export truncation fixed, audit-log total wired up, and department filter wired up 2026-07-22)

## Entry point
- Page: `apps/admin-web/src/app/users/page.tsx` -> `UsersBoard` (`apps/admin-web/src/components/datacenter/users-board.tsx`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Initial load + manual "Sync" + after import | GET | `/users` | `UserRow[]` | `UsersController.findAll` -> `UsersService.findAll` |
| Branch name lookup (separate `useAdminQuery`) | GET | `/admin/branches` | `BranchOption[]` | (branches list endpoint, not re-traced here) |
| Toggle active / bulk activate / set department / upload photo | PATCH/POST | `/users/:id/active`, `/users/bulk-active`, `/users/:id/department`, `/users/:id/photo` | `UserRow` / `UserRow[]` | `UsersController` (various) -> `UsersService` |
| Send password reset | POST | `/auth/forgot-password` | — | (auth module, not re-traced here) |
| CSV import | POST | `/users/import` | `{ email, status, message? }[]` | `UsersController.bulkImport` -> `UsersService.bulkImport` |
| Recent activity (rail, only for admin/staff users) | GET | `/admin/audit-logs?actorEmail=...&limit=5` | `AuditLogPage` | `AuditLogController` -> `AuditLogService.list` |

## Backend trace
`UsersService.findAll` does a single `find()` (optionally filtered by `department`, though the frontend never
sends that param — see Unused/dead capability), sorted by `createdAt` descending, **capped at 2000** with
password hashes excluded. There is no true pagination — the frontend receives up to 2000 full user documents
in one response and does all role/status/search filtering and page-`limit` slicing client-side. The 2000 cap
is a safety bound, not a real page size, so this page's actual behavior is "load everything up to a large
ceiling, then filter locally" — the same fetch-then-filter shape used by the orders list page
([orders.md](orders.md)), just without even a status/tab-scoped server query. `AuditLogService.list` (used
by the activity rail) is properly paginated with `page`/`limit`/filters and returns a real `total` count.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Stat tiles (6): Total users, Active accounts, Customers, Riders, Partners, Team | All client-derived from the full `users` array: `counts` per role (client `.filter()`), `activeCount`, `newThisMonth` (created-this-month count) | No backend aggregation at all here — every tile is computed by iterating the full fetched user list in the browser. Fine at the current 2000-row ceiling; would need real backend aggregates if that ceiling is ever raised. |
| Status tabs (All/Active/Inactive) + role filter dropdown | Same `users` array, filtered client-side | Tab/filter counts (`STATUS_TABS`, `roleFilterOptions`) are also derived from the already-loaded full set, not fetched. |
| User roster table | `visible` (searched+filtered+`limit`-sliced): `_id`, `email`/`phone` (via `Avatar`/`displayName`), `role`, `department`, `branchId` (via `branchName()` lookup), `isActive`, `lastLoginAt`, `createdAt` | Full field usage — every `UserRow` field is rendered somewhere in this table or the detail rail. |
| Export button | See Findings — previously exported only the `limit`-capped `visible` slice when nothing was checked; now exports the full filtered `searched` set. |
| Bulk activate/deactivate | `checkedIds` (client selection state) | Straightforward — no dead fields. |
| CSV import | User-supplied CSV, mapped to `{ email, phone, role, department }` rows | Full round-trip use; result summary derived from the response array. |
| User details rail — Profile tab | `selected.email`/`.phone`/`._id`/`.createdAt`/`.lastLoginAt`/`.branchId`/`.department`/`.role`/`.isActive` | Full field usage, plus inline department editing and photo upload actions. |
| User details rail — Permissions / Sessions tabs | None (static "not available yet" placeholders) | Honest about unimplemented features rather than showing fake data — good practice, not a gap to fix. |
| User details rail — Activity tab | `activity.data.items[]` (`_id`, `action`, `statusCode`, `createdAt`), and now `.total` (see Findings) | Only fetched for admin/staff users (the only accounts that appear as audit actors); customer/rider/partner rows show an explanatory empty state instead of an empty list, which is clearer than a blank "no activity" message. |

## Findings

1. **[FIXED] "Export" silently truncated to the current page size instead of the full filtered result set.**
   `exportSelected()` (users-board.tsx) previously built its row set from `visible` — the `limit`-sliced
   (25/50/100/250) subset of `searched` — whenever nothing was checked. So if a search/role/status filter
   matched more rows than the currently selected page size, clicking "Export" produced a CSV missing rows the
   admin almost certainly expected to be included, with no indication anything was cut. This is a more
   serious version of the client-side-search scoping issue already flagged on the orders list page
   ([orders.md](orders.md)) — there it just meant search wouldn't find an off-page row; here it meant an
   **exported file silently omitted data**. Fix: with no rows checked, export now uses the full `searched`
   set (every row matching the active filters, ignoring the display `limit`); with rows checked, it now looks
   them up from the full `users` array rather than `visible`, so a checked row that scrolled out of the
   current filter/tab is still included correctly.

2. **[FIXED] `AuditLogPage.total` was fetched but never displayed.**
   The activity rail showed the 5 most recent admin actions with a "View full audit log →" link, but never
   surfaced how many total actions existed for that user. Fix: the link now reads
   "View full audit log (N total) →" whenever there are more entries than the 5 shown.

## Unused/dead fields
- No dead `UserRow` fields — every field returned by `UsersService.findAll` is rendered somewhere on this
  page (table, avatar, or detail rail).
- **[FIXED] Unused backend capability**: `UsersController.findAll` accepts an optional `department` query
  param that the frontend never sent. Wired up: a second "Department" filter dropdown now appears next to
  "Role" (reusing `ListControls`' existing `filter2` slot), populated from the distinct department values
  present in the loaded users and applied client-side alongside the existing role/status/search filters —
  consistent with how role filtering already worked, rather than adding a new server round-trip. The
  dropdown only renders when at least one user has a department set, so it stays hidden for
  deployments/tenants that don't use departments at all.

## Loading/error/realtime behavior
- Loading/error: same shared `useAdminQuery` pattern as the rest of admin-web, so a failed reload keeps the
  last-good view visible under the error banner (fixed during the overview audit, [overview.md](overview.md)
  Finding 1). This page has no realtime socket subscription at all (no `useAdminOperationsSocket` usage) —
  reasonable, since user account changes aren't the kind of live-ops event the socket channel is built
  around; a manual "Sync" button covers refresh needs here.
- Empty states are handled per-section rather than one blanket message: the roster table, the activity rail
  (with a distinct message for non-actor roles vs. actors with no logged actions), and CSV import summary all
  have their own explicit empty/result text.
- The 2000-row fetch cap (see Backend trace) is the one scalability ceiling on this page. It's not a bug
  today, but it's the reason every stat tile, filter, and the (now-fixed) export are all client-side
  computations over a single large in-memory array rather than server aggregates — worth keeping in mind if
  the platform's user count approaches that ceiling.
