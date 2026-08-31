# Audit: Admin-web — Settings

Date: 2026-07-23 (re-audited 2026-09-01)

**2026-09-01 re-audit:** page/backend otherwise unchanged since 2026-07-23.
Fixed Finding 2 (app-version format validation) this pass — Finding 1 remains
a deliberate open product/UX call.

## Entry point
- Page: `apps/admin-web/src/app/settings/page.tsx`
- Component: inline in the page file (`AdminSettingsPage`), no separate board component

## Sub-pages
None — no outbound navigation into a dynamic detail route. The page links to
sibling top-level pages (`/branches`, `/partners/branding`, `/services`,
`/riders`, `/dispatch`, `/refunds`, `/partners/settlements`,
`/riders/withdrawals`, `/audit-log`, `/maintenance`, `/profile`, `/setup`,
`/automation-settings`) but these are separate, already-audited modules, not
detail views of this page's own data — not in scope here.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load delivery fee | GET | `/admin/settings/delivery-fee` | `DeliveryFeeSettings` | `SettingsController.getDeliveryFee` -> `SettingsService.getDeliveryFeeSettings` |
| Load automation | GET | `/admin/settings/automation` | `AutomationSettings` | `SettingsController.getAutomationSettings` -> `SettingsService.getAutomationSettings` |
| Load rider fees | GET | `/admin/settings/rider-fees` | `RiderFeeSettings` | `SettingsController.getRiderFees` -> `SettingsService.getRiderFeeSettings` |
| Load app version | GET | `/admin/settings/app-version` | `AppVersionSettings` | `SettingsController.getAppVersionSettings` -> `SettingsService.getAppVersionSettings` |
| Load branch coverage | GET | `/admin/branches` | `BranchCoverageRow[]` | `AdminController` -> `BranchesService.findAll` (see `docs/audits/admin-web/branches.md`) |
| Save delivery fee | PATCH | `/admin/settings/delivery-fee` | — | `SettingsController.updateDeliveryFee` |
| Save automation | PATCH | `/admin/settings/automation` | — | `SettingsController.updateAutomationSettings` |
| Save rider fees | PATCH | `/admin/settings/rider-fees` | — | `SettingsController.updateRiderFees` |
| Save app version | PATCH | `/admin/settings/app-version` | — | `SettingsController.updateAppVersionSettings` |
| Update branch radius | PATCH | `/admin/branches/:id` | — | `AdminController` -> `BranchesService.update` |
| System health | GET | `/admin/maintenance/status` | `CollectionStat[]` | `MaintenanceController.getStatus` -> `MaintenanceService.getStatus` |

## Backend trace
All four settings resources (`delivery-fee`, `automation`, `rider-fees`,
`app-version`) read/write a single `PlatformSettings` singleton document via
`SettingsService.getOrCreateSettings()` (finds one, creates a default doc if
none exists — cheap, no collection scan). `updateAutomationSettings` and
`updateAppVersionSettings` iterate `Object.entries(dto)` and only assign keys
the client actually sent, with a code comment explaining why (`class-validator`
instantiates every declared DTO property, even omitted ones, as `undefined`,
and blindly `Object.assign`-ing that would unset fields on save) —
`updateDeliveryFeeSettings`/`updateRiderFeeSettings` use explicit
`!== undefined` checks for the same reason. `MaintenanceService.getStatus` lists
every collection in the DB and runs `countDocuments()` on each in parallel —
fine at current collection counts, would need attention only if the collection
count grows very large (not observed here).

## Cards / panels
General tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Workspace preferences | `localPrefs.denseTables`, `localPrefs.sosSoundAlerts` | browser-local only, via `admin-settings.ts` (`loadAdminSettings`/`saveAdminSettings`), not part of the server settings fetch or Save button |
| Environment | `API_URL` (build-time env var, not server data) | "Copy URL" is a clipboard action, not a mutation |

Orders & operations tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Order pricing | `deliveryFee.deliveryFee` | |
| Order-flow automation | `automation.autoDispatchOrders/autoAssignPickupRider/autoAssignDeliveryRider` | |

Payments tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Financial automation | `automation.autoGenerateSettlements`, `autoApproveRefunds` + `autoApproveRefundsThreshold`, `autoApproveWithdrawals` + `autoApproveWithdrawalsThreshold` | thresholds only editable while their toggle is on (`disabled={!checked}` in `ToggleRow`) |
| Related pages | static link list | hardcoded, not server-driven — reasonable for a fixed set of sibling pages |

Riders tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Rider fees | `riderFees.riderPickupFee`, `riderFees.riderDeliveryFee` | |
| Related pages | static link list | |

Laundry shops tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Service coverage | `data.branches[].name/code/city/province/serviceRadiusKm` | per-row save-on-blur, independent of the global Save button |
| Related pages | static link list | |

Mobile apps tab:

| Card | Fields consumed | Notes |
|---|---|---|
| Customer app | `appVersion.customerMinAppVersion/customerLatestAppVersion/customerIosStoreUrl/customerAndroidStoreUrl` | plain text inputs, no version-format validation client-side |
| Rider app | `appVersion.riderMinAppVersion/riderLatestAppVersion/riderIosStoreUrl/riderAndroidStoreUrl` | same |

Right rail (all tabs):

| Card | Fields consumed | Notes |
|---|---|---|
| Settings summary | `deliveryFee.deliveryFee`, `riderFees.riderPickupFee/riderDeliveryFee`, `automationsOn` (client-derived count of 6 booleans), `appVersion.customerMinAppVersion/riderMinAppVersion` | mirrors edited-but-unsaved local state, not last-saved server state — see Findings |
| System health | `error` (page-level fetch error), `health.data`/`health.error` (`CollectionStat[]` reduced to `totalDocs`), `socketLive` (`isAdminRealtimeConnected()` polled every 2s) | "API server" row is really "did the settings fetch succeed", not an independent health probe |
| Shortcuts | static link list | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save changes (batched delivery fee / automation / rider fees / app version PATCH) | no (config change, not data loss) | no | yes (`disabled={saving \|\| !dirty.any}`) | yes (`saveError` alert) |
| Update branch service radius (save-on-blur) | no | n/a | yes (`disabled={savingBranchId === b._id}`) | yes (`branchError`) |
| Toggle workspace preference (dense tables / SOS sound) | no, local-only | n/a | n/a (instant, synchronous `localStorage` write) | n/a, cannot fail |

No destructive (delete/retire) actions on this page.

## Authorization
All four `/admin/settings/*` routes and `/admin/maintenance/status` are guarded by `JwtAuthGuard` + `RolesGuard` with class-level `@Roles(UserRole.ADMIN)` (`settings.controller.ts:12-14`, `maintenance.controller.ts:20-22`) — no route-level override, matches the frontend (only admin-web calls these paths). `/admin/branches` and `/admin/branches/:id` sit under `AdminController`, also class-level `@Roles(UserRole.ADMIN)`. No role-scoped filter here to widen (single global settings document, not scoped by branch/partner). Separately, `AppVersionController` at `GET /app-version` (no `admin` prefix) is intentionally public/unauthenticated — it's the mobile apps' launch-time version-gate lookup, not reachable from admin-web, and correctly does not expose the admin-only settings fields (only `minVersion/latestVersion/iosStoreUrl/androidStoreUrl` for the requested app).

## Findings

1. Right-rail "Settings summary" card reflects locally-edited (possibly unsaved) values, not the last-saved server state — `deliveryFee`/`riderFees`/`automationsOn`/`appVersion` in the summary (`page.tsx:857-878`) read the same `useState` slices the form inputs write to, not `data.deliveryFee` etc. If an admin edits the delivery fee and never clicks Save, the summary silently shows the unsaved number as if it were live, with no visual distinction from the "Unsaved changes" badge sitting a few lines up in the header. Low severity (the badge is directly above), left unfixed — deciding whether the summary should show live-editing state or committed state is a product/UX call, not a code bug.

2. App-version text fields (`customerMinAppVersion`, `riderMinAppVersion`, etc.) had no format validation, client or server (`UpdateAppVersionSettingsDto` only applied `@IsString()`, `apps/api/src/modules/settings/dto/update-app-version-settings.dto.ts`). `compareVersions` (`packages/utils/src/version.ts`) silently treats any non-numeric segment as `0` via `parseInt(p, 10) || 0`, so a typo'd minimum version (e.g. "1.2.x") would silently behave as "0.0.0" — disabling update enforcement instead of erroring.
   **Fix:** the required format wasn't actually ambiguous — the UI's own placeholders (`0.0.0`, `1.1.5`) and `compareVersions`' dotted-numeric-segment parsing already implied it. Added `@Matches(/^\d+(\.\d+)*$/)` to the four version fields (min/latest for customer/rider) in `UpdateAppVersionSettingsDto`, and mirrored the same pattern client-side in `apps/admin-web/src/app/settings/page.tsx`: `TextField` gained an `error` prop rendering inline validation text, the four version inputs pass it, and `saveAll`/the Save button are now also gated on `appVersionValid` (all four fields matching the pattern) in addition to the existing `dirty.any` check. Store-URL fields were left as plain `@IsString()` — no evidence of an intended format to validate against. Typechecked clean on both `apps/api` and `apps/admin-web`.

No authorization or data-flow mismatch issues found — every field the four settings endpoints and `/admin/maintenance/status` return is read and rendered, request DTOs validate the same numeric bounds the UI enforces (`serviceRadiusKm` 1–50 both in `update-branch.dto.ts:87-91` and the input's `min/max`; fee fields `@Min(0)` both server and client).

## Unused/dead fields
None found — every response field from all five GETs is consumed by a card listed above.

## Loading/error/realtime behavior
The main settings fetch (`load`, all 5 GETs via `Promise.all`) and the health
check (`healthLoad`) each use the shared `useAdminQuery` hook independently:
initial loading shows a spinner (`page.tsx:464-472`), a fetch error surfaces via
`alert-error` without discarding previously-loaded `data`, and there's no
explicit "empty" case since settings always exist (`getOrCreateSettings` creates
a default doc). No polling/socket subscription drives a refetch of the settings
themselves — only the "Realtime socket" health indicator polls
`isAdminRealtimeConnected()` every 2s (a local check of an existing socket
connection, not a network request) to show connected/polling status.
