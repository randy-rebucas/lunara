# Audit: Admin-web — Setup

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/setup/page.tsx`
- Component(s): inline in the page file, plus the shared `BranchAddressEditor` (`components/datacenter/branch-address-editor.tsx`)

## Sub-pages
None — no outbound navigation into a dynamic detail route. Links to `/branches`, `/settings`, `/partners/new`, `/partners` are sibling top-level pages, not detail views of this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Setup status | GET | `/admin/setup/status` | `SetupStatus` | `AdminController.getSetupStatus` -> `AdminService.getSetupStatus` |
| Initialize HQ | POST | `/admin/setup/init` | — | `AdminController.initializeNetwork` -> `AdminService.initializeNetwork` |
| Create first operational branch | POST | `/admin/setup/branch` | — | `AdminController.createSetupBranch` -> `AdminService.createSetupBranch` |

## Backend trace
`getSetupStatus` looks up the single `branchType: 'hq'` branch document; if
found, counts all non-HQ branches for `operationalBranchCount` — two cheap,
indexed-by-nature lookups. `initializeNetwork` is idempotency-guarded: it
throws `ConflictException` if an HQ branch already exists (`admin.service.ts:1427-1428`),
so this step can't silently double-create a root branch. `createSetupBranch`
requires an HQ to already exist and rejects a duplicate `code`
(`admin.service.ts:1457-1461`) before creating the branch with a fixed set of
4 default machines and admin-supplied capacity/radius, defaulting
`commissionRate` to 0.20 if not passed (not exposed in this page's form,
inherits the backend default). Both mutations attribute the created record to
`adminUserId` as both `partnerUserId` and `managerUserId` — placeholder
ownership until a real partner/manager is assigned elsewhere (expected for a
bootstrap flow, not a bug).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Status banner | `status.initialized`, `status.hqBranch.name/code/city`, `status.operationalBranchCount` | banner color/copy branches client-side on `initialized` |
| Step 1 — Initialize network (shown only if `!status.initialized`) | form: HQ code/name + `BranchAddressEditor` (line1/city/province/lat/lng) | `hq-code`/`hq-name` inputs are `required`; the shared address editor's text fields were not — see Findings |
| Step 2 — Add first operational branch (shown only if `status.initialized && operationalBranchCount === 0`) | form: branch code/name/type/radius/max orders/max weight + `BranchAddressEditor` | numeric fields all `required` with `min`/`max` matching backend `@Min`/`@Max`; branch type options (`partner_shop`/`franchise`) match `CreateSetupBranchDto`'s `@IsEnum` |
| Quick links | `status.operationalBranchCount` (gates the "Onboard a partner" link) | static link list otherwise |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Initialize network (create HQ) | no (additive, and backend-idempotency-guarded against a second HQ) | n/a | yes (`disabled={hqBusy}`) | yes (`hqError`) |
| Create first operational branch | no (additive; backend rejects duplicate branch codes) | n/a | yes (`disabled={branchBusy}`) | yes (`branchError`), and success clears the form + shows a confirmation banner with a next-step link |

## Authorization
Both `/admin/setup/*` routes sit under `AdminController`, class-level `@Roles(UserRole.ADMIN)` — matches the frontend (admin-only), no role-scope-widening concern (this is a one-time global bootstrap, not scoped per-branch/partner).

## Findings

1. **Branch address fields (street/city/province) could be submitted empty, both client- and server-side.** The shared `BranchAddressEditor` (used here for both the HQ and first-branch forms, and also by `branches-board.tsx` and `partners-board.tsx`/`partners/new/page.tsx`) had no `required` attribute on its `line1`/`city`/`province` text inputs, and the backend DTOs that accept them (`InitNetworkDto`, `CreateSetupBranchDto`, and the general `CreateBranchDto`/`UpdateBranchDto` used by the Branches module) validated them with only `@IsString()` — which accepts an empty string. An admin could submit the HQ-init or branch-create form with the address auto-filled by a map click/drag (which only sets lat/lng, not line1/city/province — see `MapPicker.onClick`/`onDragEnd`, `branch-address-editor.tsx:121-132`) and get a branch record with a valid location but blank `city`/`province`, which several other pages display directly (e.g. `settings/page.tsx`'s "Service coverage" table renders `{b.city}, {b.province}` — see `docs/audits/admin-web/settings.md`).
   **Fix:** added `required` to the three text inputs in the shared `BranchAddressEditor` (`apps/admin-web/src/components/datacenter/branch-address-editor.tsx`), and `@IsNotEmpty()` alongside the existing `@IsString()` on `line1`/`city`/`province` in `InitNetworkDto` (`apps/api/src/modules/admin/dto/init-network.dto.ts`), `CreateSetupBranchDto` (`apps/api/src/modules/admin/dto/create-setup-branch.dto.ts`), and — since this is a shared-component/shared-validation-pattern bug, not specific to Setup — also `CreateBranchDto` and `UpdateBranchDto` (`apps/api/src/modules/branches/dto/{create,update}-branch.dto.ts`), which have the exact same gap and are exercised by the Branches module (`docs/audits/admin-web/branches.md`). Checked `BranchAddressEditor`'s other two consumers (`branches-board.tsx`, `partners-board.tsx`/`partners/new/page.tsx`) — all three treat a branch's street/city/province as required data in their own copy and forms already, so requiring them doesn't change intended behavior anywhere, only closes the gap that let them be skipped.

No authorization or data-flow mismatch issues found beyond the above — every field `getSetupStatus` returns is rendered, and the numeric bounds on the branch-creation form (`min`/`max` on radius, `min` on order/weight capacity) match the backend DTO's `@Min`/`@Max`.

## Unused/dead fields
None — every field `SetupStatus` returns (`initialized`, `hqBranch.{id,code,name,city}`, `operationalBranchCount`) is rendered.

## Loading/error/realtime behavior
Uses the shared `useAdminQuery` hook for the status fetch (spinner while
`loading && !status`, error banner via `alert-error` without clearing prior
`status`, no polling). Each form manages its own `busy`/`error` state
independently and calls `reload()` after a successful submission so the page
re-evaluates which step to show next (status banner and Step 1/Step 2
visibility are both driven by the freshly reloaded `status`, not local
optimistic state).
