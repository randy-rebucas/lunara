# Audit: Admin-web — Maintenance

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/maintenance/page.tsx`
- Component(s): five inline tab components in the same file — `StatusTab`, `SeedTab`, `ResetTab`, `ScriptsTab`, `BackupTab`

## Sub-pages
None — no outbound navigation into a dynamic detail route. This page is a
self-contained ops console with local tab state only.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Collection stats | GET | `/admin/maintenance/status` | `CollectionStat[]` | `MaintenanceController.getStatus` -> `MaintenanceService.getStatus` |
| Run seed | POST | `/admin/maintenance/seed` | `SeedResult` | `MaintenanceController.runSeed` -> `MaintenanceService.runSeed` |
| Reset collections | POST | `/admin/maintenance/reset` | `ResetResult` | `MaintenanceController.resetCollections` -> `MaintenanceService.resetCollections` |
| Run npm script | POST | `/admin/maintenance/run-script` | `ScriptResult` | `MaintenanceController.runScript` -> `MaintenanceService.runScript` |
| Download backup | GET | `/admin/maintenance/backup` | raw JSON blob (not through `adminFetch`) | `MaintenanceController.downloadBackup` -> `MaintenanceService.createBackup` |
| Restore backup | POST | `/admin/maintenance/restore` (multipart) | `{ result: string }` (not through `adminFetch`) | `MaintenanceController.restoreBackup` -> `MaintenanceService.restoreBackup` |

## Backend trace
`getStatus` lists every collection in the connected DB and runs
`countDocuments()` on each in parallel — fine at current scale. `runSeed`
upserts dev fixtures (catalog services/addons/promotions, 5 dev user accounts
with a shared bcrypt-hashed password) directly via the raw Mongo driver,
bypassing Mongoose schemas/validation — acceptable for a dev-seed utility.
`resetCollections` maps a `scope` string to a hardcoded list of collection
names (`RESET_SCOPE_MAP`) and drops each with `db.dropCollection`, swallowing
only "ns not found" errors; the scope whitelist and the `confirm === 'RESET'`
literal check are both enforced server-side (`maintenance.controller.ts:42-49`),
not just client-side. `runScript` validates `script` against a server-side
`ALLOWED_SCRIPTS` whitelist before calling `spawn('npm', ['run', script, ...])`
with `shell: true` — since the script name is checked against a fixed list
before reaching `spawn`, this isn't attacker-controlled command injection, but
`shell: true` combined with a hardcoded allowlist is a defense-in-depth
concern rather than an active hole. Output is capped at a 60s timeout via
`child.kill()`. `createBackup`/`restoreBackup` serialize/deserialize every
collection as one JSON document in memory (fine for a dev/small-prod database;
would need streaming if the DB grows very large — not observed here).

## Cards / panels
Status tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Total documents / Collections tracked / Largest collection / Empty collections | `data[].collection/count`, all 4 client-derived (`reduce`, `.length`, `sort`+`[0]`, `.filter`) | no backend pre-aggregation needed, cheap client-side math over a small array |
| Collection statistics table | `data[].collection/count`, row bar width derived from `count / maxCount` | sorted by count desc client-side |

Seed tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Per-target seed card (5) | `SeedResult.log[]` / error string, keyed by target id | `SEED_TARGETS` labels/descriptions are a static client-side list that must stay in sync with the server's `allowed` array (`maintenance.controller.ts:34`) and `RESET_SCOPE_MAP`-style branching in `runSeed` — currently in sync, no drift found |

Reset tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Scope picker | `RESET_SCOPES` (static list) | must stay in sync with server's `RESET_SCOPE_MAP` keys — currently in sync (`orders/settlements/ledger/wallets/remittances/users/all`) |
| Drop result | `ResetResult.dropped[]`, `.scope` | |

Scripts tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Script picker + output | `ScriptResult.output`, `.exitCode` | `ALLOWED_SCRIPTS` client list must stay in sync with server `ALLOWED_SCRIPTS` — currently in sync |

Backup & Restore tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Backup | n/a (blob download) | |
| Restore | `restoreFile` (client-only), `{ result }` string dumped verbatim into a `<pre>` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Run seed (per target) | no — idempotent upsert | n/a | yes (`disabled={busy === t.id}`) | yes, inline per-card error |
| Reset collections | **yes** — drops entire collections, unrecoverable without a backup | yes — must type `RESET` (`confirmText !== 'RESET'` disables the button) plus server re-checks `confirm === 'RESET'` | yes (`disabled={busy}`) | yes |
| Run npm script | yes — can run arbitrary allowlisted repo scripts (incl. a DB migration) server-side | no | yes (`disabled={busy}`) | yes |
| Download backup | no | n/a | n/a (fire-and-forget download) | yes (`downloadError`) |
| Restore backup | **yes** — drops every existing collection and replaces it with the uploaded file's contents | **no (before fix)** | yes (`disabled={!restoreFile \|\| restoring}`) | yes (`restoreError`) |

## Authorization
All six `/admin/maintenance/*` routes sit under `MaintenanceController`, guarded by `JwtAuthGuard` + `RolesGuard` with class-level `@Roles(UserRole.ADMIN)` (`maintenance.controller.ts:20-22`) — matches the frontend (only reachable from this admin-only page). No role-scoped data filtering applies here (whole-database operations, not scoped by branch/partner), so there's no widening-via-param concern.

## Findings

1. **Backup download and restore-upload hit the wrong origin — hardcoded `/api/v1/...` instead of the configured API base URL.** `page.tsx` (before fix) called `fetch('/api/v1/admin/maintenance/backup', ...)` and `fetch('/api/v1/admin/maintenance/restore', ...)` as same-origin relative paths, unlike every other network call in this app which goes through `adminFetch`/`API_URL` (built from `resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL)` — see `admin-api.ts:5`, `settings/page.tsx:16`). In this repo's own `.env`, the API runs on `http://localhost:3001` while admin-web runs on a different port, so these two calls would 404 against the Next.js app itself instead of reaching the NestJS API — backup download and restore upload were both broken.
   **Fix:** added the same `resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL)` `API_URL` constant used elsewhere in the app and pointed both `fetch` calls at it, `apps/admin-web/src/app/maintenance/page.tsx:1-8, 435, 464`.

2. **Restore had no confirmation despite being as destructive as Reset.** `handleRestore` (`page.tsx:454` pre-fix) dropped and replaced every collection in the database on a single button click, guarded only by a static warning banner — no typed-confirmation gate, unlike the Reset tab's required "type RESET" input which this same file already establishes as the pattern for irreversible collection drops.
   **Fix:** added a `window.confirm` prompt naming the selected file and stating the drop-and-replace effect before the restore request fires, `apps/admin-web/src/app/maintenance/page.tsx:454-461`.

3. Client-side static lists (`SEED_TARGETS`, `RESET_SCOPES`, `ALLOWED_SCRIPTS`) must stay hand-in-sync with their server-side counterparts (`maintenance.controller.ts`'s `allowed` array, `maintenance.service.ts`'s `RESET_SCOPE_MAP` keys and `ALLOWED_SCRIPTS`) — currently in sync, but nothing enforces that at build time. Left unfixed: turning this into a single shared source of truth would touch the API's module boundaries and is a larger refactor than this pass's scope, not a live bug today.

## Unused/dead fields
None — every field returned by all six endpoints is rendered somewhere on the page.

## Loading/error/realtime behavior
The Status tab uses the shared `useAdminQuery` hook (spinner on initial load,
`alert-error` on failure without clearing prior `data`, manual "Refresh"
button — no polling). The other four tabs (Seed, Reset, Scripts, Backup) don't
fetch on mount; each mutation manages its own `busy`/`result`/`error` state
locally and surfaces failures inline rather than through `useAdminQuery`,
which is appropriate since they're one-shot actions, not data views.
