# Audit: Admin-web — Audit log

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/audit-log/page.tsx`
- Component(s): inline in the page file, no separate board component

## Sub-pages
None — no outbound navigation into a dynamic detail route. Row click expands
an inline detail panel in place (`expandedId` state), not a navigation.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List entries | GET | `/admin/audit-logs?page=&limit=&search=&action=&method=` | `AuditLogPage` | `AuditLogController.list` -> `AuditLogService.list` |
| Action filter options | GET | `/admin/audit-logs/actions` | `string[]` | `AuditLogController.listActions` -> `AuditLogService.listActions` |
| Method filter chips | GET | `/admin/audit-logs/methods` | `string[]` | `AuditLogController.listMethods` -> `AuditLogService.listMethods` |

The audit log itself is written by `AuditLogInterceptor` (`apps/api/src/common/interceptors/audit-log.interceptor.ts`), registered globally in `app.module.ts` — it records every POST/PATCH/PUT/DELETE under `/api/v1/admin` automatically (no per-endpoint wiring needed for new routes to show up here).

## Backend trace
`AuditLogService.list` builds a Mongo filter from `actorEmail`/`action`/`method`/`from`/`to`/`search` (only `search`, `action`, and `method` are actually sent by this page — `actorEmail`/`from`/`to` are supported server-side but not exposed in this UI, a minor unused-capability gap, not a bug) and runs five queries in parallel: the paged `find`, a `countDocuments` for total, a second `countDocuments` scoped to `statusCode >= 400` for the "Failed requests" stat, `distinct('actorEmail', filter)` for the unique-actor count, and a 1-stage `$group`+`$sort`+`$limit` aggregate for the top action. All indexed on `createdAt`/`path`/`action`/`actorUserId` per the schema (`audit-log.schema.ts:8,22,26,46`) — no N+1 or unindexed-scan concerns. The interceptor redacts `password`/`newPassword`/`currentPassword`/`confirmPassword` from `requestBody` before persisting (`audit-log.service.ts:6-15`), but only at the top level of the body object (see Findings).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Matching actions | `data.total` | sub-label switches between "current filter"/"all time" based on client-derived `filtersActive` |
| Failed requests | `data.stats.failedTotal` | tone flips rose/accent based on `> 0`, client-derived |
| Admins involved | `data.stats.uniqueActors` | |
| Most common action | `data.stats.topAction.count` / `.action` (via `actionLabel`, which also strips the `get./post./...` prefix client-side) | |
| Action filter `<select>` | `actions[]` (from `/admin/audit-logs/actions`) | |
| Search input | free text, sent as `search` query param | |
| Method filter chips | `methods[]` (from `/admin/audit-logs/methods`) | |
| Log table (Time/Admin/Action/Method/Status) | `entry.createdAt` (+`timeAgo`/`formatDate`), `actorEmail`, `action` (via `actionLabel`), `method` (badge color via hardcoded `methodBadgeClass` map), `statusCode` (red badge if `>= 400`) | row click expands inline detail |
| Expanded row detail | `path`, `actorRole`, `createdAt`, `ip` (conditional), `requestBody` (conditional, dumped raw as pretty-printed JSON) | `entry.params` is fetched but never rendered here — see Unused/dead fields |
| Pagination | `data.page`, `data.totalPages` | |

## Mutations
None — this page is read-only (it displays the audit trail of mutations made elsewhere in the app, it doesn't itself mutate anything).

## Authorization
`/admin/audit-logs*` (all three routes) sits under `AuditLogController`, guarded by `JwtAuthGuard` + `RolesGuard` with class-level `@Roles(UserRole.ADMIN)` (`audit-log.controller.ts:8-10`) — matches the frontend, admin-only. No role-scoped filter to widen (the log is global, not scoped by branch/partner) and no route lets a caller view another actor's-only data beyond what any admin can already see by design (the whole point of this page is cross-admin visibility).

## Findings

1. **Unescaped user search text built directly into a MongoDB regex — could 500 on ordinary input.** `AuditLogService.list` (pre-fix) did `new RegExp(query.search.trim(), 'i')` with the raw search string. Since `search` also matches against `path`, which contains real request paths, a search containing regex metacharacters (an unbalanced `(`, a stray `[`, etc. — plausible in a copy-pasted path fragment) throws a `SyntaxError` from the `RegExp` constructor, which is unhandled here and would surface as an uncaught 500 rather than a clean "no results" or validation error.
   **Fix:** escape regex metacharacters in the search string before constructing the `RegExp`, `apps/api/src/modules/audit/audit-log.service.ts:72-75`.

2. Redaction of sensitive request-body fields (`password`, `newPassword`, `currentPassword`, `confirmPassword`) in `AuditLogService`'s `redact()` (`audit-log.service.ts:8-15`) only inspects top-level keys, not nested objects. Checked every admin route that currently sends a password in a mutating request body (`create-partner.dto.ts`, `create-rider.dto.ts`, `onboard-partner.dto.ts`) — all three declare `password` as a top-level DTO field, so today's actual traffic is fully redacted and no live leak exists. Left unfixed: making `redact()` recursive is a reasonable hardening step but speculative (no current DTO nests a password field), so it's noted here rather than treated as an active bug.

## Unused/dead fields
- `entry.params` (route params like the resource `:id` from the mutated route) is fetched and typed on the frontend (`AuditLogEntry.params`, `page.tsx:17`) but never rendered in the expanded-row detail panel — low impact since the same id is already visible embedded in the `path` field the detail panel does show.
- `actorUserId` is returned by `AuditLogService.list` (`audit-log.service.ts:99`) but isn't declared on the frontend's `AuditLogEntry` interface at all — harmless (an internal id, not more sensitive than `actorEmail` which is already shown), just unused.
- The `actorEmail`/`from`/`to` filter params `AuditLogService.list` supports are never sent by this page (only `search`/`action`/`method` are) — a usable server capability with no UI, not a bug.

## Loading/error/realtime behavior
This page manages `loading`/`error`/`data` with local `useState` + a manual
`load()` callback in a `useEffect`, rather than the shared `useAdminQuery` hook
most other admin-web pages use — functionally equivalent (spinner while
`loading && !data`, error text without clearing prior `data`, an explicit empty
state when `data.items.length === 0`), just a style inconsistency, not a bug.
No polling or realtime subscription; changing the search/action/method filters
resets `page` to 1 via a dedicated `useEffect` (`page.tsx:134-136`), and the
list refetches whenever `page`/`search`/`action`/`method` change via the
`load` `useCallback`'s dependency array.
