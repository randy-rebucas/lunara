# Audit: Admin-web — Error logs

Date: 2026-08-23

## Entry point
- Page: `apps/admin-web/src/app/error-logs/page.tsx`
- Component(s): none — self-contained page component (`ErrorLogsPage`), client component

## Sub-pages
None — no outbound navigation into a detail route. Rows expand inline (`expandedId` state toggles a details row within the same table) instead of linking anywhere.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List | GET | `/admin/error-logs?page=&limit=&search=&source=` | `ErrorLogPage` (`page.tsx:21-28`) | `ErrorLogController.list` -> `ErrorLogService.list` |
| Record (server-side, not called from this page) | POST | `/errors/client` | n/a | `ClientErrorReportController.report` -> `ErrorLogService.record` |

The `/errors/client` endpoint is the write side that populates this collection from frontend crash boundaries (admin-web/customer-web/partner-web) and is unauthenticated by design (documented at `error-log.controller.ts:32-34`); it is not called from the error-logs page itself, only traced here because it's the other half of the same service/schema.

## Backend trace
`ErrorLogController.list` (`error-log.controller.ts:19-29`) passes raw query params straight to `ErrorLogService.list` (`error-log.service.ts:53-114`), which clamps `page` (min 1) and `limit` (1-100), builds a Mongo filter from `source` (exact match), `from`/`to` (date range on `createdAt`), and `search` (regex-escaped, matched against `message` OR `path`, case-insensitive), then runs `find` + `countDocuments` + a `$group by source` aggregation in parallel. `source` and `statusCode` are indexed (`error-log.schema.ts:9,25`) and there's a dedicated `createdAt: -1` index (`error-log.schema.ts:42`), so the sort/filter/count path is index-backed. The `$or` regex search on `message`/`path` is not index-backed (regex `$or` can't use a standard index for arbitrary substrings) but is acceptable at this collection's expected scale (error volume, not transactional volume).

5xx errors are captured automatically via `HttpExceptionFilter.catch` (`http-exception.filter.ts:60-74`), which records `source: 'api'`, message, stack, path, method, statusCode, and the authenticated actor's `userId`/`userRole` if present — this is the only writer of `source: 'api'` rows and explains why `statusCode` is present for API errors but typically absent for frontend-reported ones (frontend crash reports don't carry an HTTP status).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Source count tiles (`page.tsx:91-100`) | `data.bySource[s]` for each of the 4 hardcoded `SOURCES` | `SOURCES` (`page.tsx:30`) is a hardcoded literal tuple matching the schema's `source` union — if a new source value were ever added to the schema without updating this array, its count would silently never render even though `bySource` from the backend would include it. |
| Search input | `search` (debounced client state) | See Finding 1 (fixed). |
| Source filter chips | `source` | Reuses the same hardcoded `SOURCES` array as the tiles. |
| "Showing N of total" | `data.items.length`, `data.total` | Straightforward. |
| Error table (`page.tsx:152-230`) | `entry.createdAt` (relative + full via `title`), `entry.source` (badge, color via `sourceBadgeClass`), `entry.message` (truncated, full via `title`), `entry.statusCode` (badge or em-dash) | `sourceBadgeClass` (`page.tsx:46-49`) is a 2-way client color map: `'api'` -> danger red, everything else -> secondary/neutral — so `admin-web`, `customer-web`, and `partner-web` crash reports are visually indistinguishable from each other by badge color, only by the text label. |
| Expanded detail row | `entry.path`, `entry.method`, `entry.userRole`, `entry.userId` (added by this audit's fix), `entry.createdAt`, `entry.context` (added by this audit's fix), `entry.stack` | Previously `userId` and `context` were fetched but never rendered — see Finding 2 (fixed). |
| Pagination controls | `data.page`, `data.totalPages` | Standard prev/next, disabled at bounds. |

## Mutations
None — this is a read-only log viewer. No create/update/delete/toggle actions exist on the page.

## Authorization
`ErrorLogController` is guarded with `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(UserRole.ADMIN)` (`error-log.controller.ts:13-15`) — only admins can list logs, matching the frontend (the page lives under admin-web's authenticated admin shell, no role branching in the UI). No request param widens this scope — the query only accepts `page`/`limit`/`source`/`search`/`from`/`to`, none of which touch role/actor filtering, so there's no way to narrow/widen results by identity. `ClientErrorReportController.report` (`/errors/client`) is deliberately unauthenticated with its own rate limit (20/min) and length caps, which is documented and appropriate for a crash-reporting endpoint that must work even when auth is broken. No `[authz]` findings.

## Findings

1. **Search fired a network request on every keystroke, with no stale-response guard.** `page.tsx`'s `load()` had `search` as a direct dependency of the fetch (`page.tsx:60-74` prior to fix), so each keystroke triggered an immediate fetch; combined with the separate `useEffect(() => setPage(1), [search, source])` (`page.tsx:80-82`), a search edit while on page > 1 could fire two overlapping requests, and fast typing had no ordering guarantee — an older, slower response could arrive after a newer one and overwrite the on-screen results with stale data. This is the same pattern as `apps/admin-web/src/app/audit-log/page.tsx:104-136`, which shares the identical no-debounce, no-request-ordering structure.
   **Fix:** Added a 300ms debounce (`debouncedSearch` state, `page.tsx`) so typing no longer fires a request per keystroke, and a request-generation counter (`requestId` ref) so an in-flight request whose response arrives after a newer request has started is discarded rather than overwriting current data. Cross-module note: `audit-log/page.tsx` has the identical unfixed pattern — left as-is since it's a separate module/audit scope, but the same fix would apply there.

2. **`userId` and `context` were fetched but never rendered.** Both are declared on the frontend `ErrorLogEntry` type (`page.tsx:15,17` — pre-fix) and returned by `ErrorLogService.list` (`error-log.service.ts:102,104`), but neither appeared anywhere in the expanded detail row, even though `context` is populated for client error reports (`digest` from Next.js error boundaries, `error-log.controller.ts:47`) and `userId` is the one actor-identifying field the backend already scopes by (alongside `userRole`, which *was* shown). This made the payload strictly less useful for debugging than it could be — an admin investigating a crash had `userRole` ("admin") but not which specific admin.
   **Fix:** Added an "Actor ID" row and a `context` JSON dump (mirroring the existing `stack` `<pre>` block) to the expanded detail row (`page.tsx`), shown only when present.

3. **Hardcoded `SOURCES` tuple must stay manually in sync with the schema's `source` union.** `page.tsx:30` and the schema's literal union (`error-log.schema.ts:10`) are two independent hardcoded lists. If a source value is ever added to one without the other, the count tiles/filter chips silently omit it while the backend `bySource` aggregation would still include it under a key nothing on the page reads.
   **Fix:** left unfixed — this needs the source union to live in a shared package (e.g. `@lunara/types`) to fix properly, which is a larger cross-cutting change beyond this module's scope; noted here so it's not silently missed.

4. **Backend supports a `from`/`to` date-range filter with no frontend UI for it.** `ErrorLogService.list` accepts and applies `from`/`to` (`error-log.service.ts:66-71`) but the page never sends them — there's no date-range picker. Not a bug, just an unused backend capability.
   **Fix:** left unfixed — adding a date-range UI is a product/UX decision, not a defect to fix in an audit pass.

## Unused/dead fields
- `userId`, `context` — were unused; now rendered (see Finding 2, fixed).
- None remaining after the fix. `stack`, `path`, `method` were already used in the expanded row.

## Loading/error/realtime behavior
No shared `useAsyncQuery` hook here (unlike several other admin-web boards) — loading/error/data are plain local `useState`. Loading shows "Loading…" only on the very first load (`!data`); a failed refresh sets `error` but — same as the shared-hook convention elsewhere — leaves the previously-loaded `data` on screen rather than wiping it, so a transient failure doesn't blank the table. Empty results get a dedicated "No errors logged. Good sign." panel. No realtime/socket subscription — this page is poll-on-demand only (initial load + explicit search/filter/page changes), which is appropriate for a log viewer with pagination rather than a live board.
