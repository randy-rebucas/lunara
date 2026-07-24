# Audit: Partner-web — Staff team

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/staff/page.tsx`
- Component(s): `StaffProfileModal` (`components/staff-profile-modal.tsx`)

## Sub-pages
None — no outbound navigation into a dynamic detail route. "Edit profile"
opens an in-page modal (not a route change); "Incoming orders →" links to a
sibling top-level page, not a detail view of this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List staff | GET | `/partner/staff` | `PartnerStaffMember[]` | `PartnerController.listStaff` -> `PartnerOperationsService.listStaff` |
| List shops (for the branch picker) | GET | `/partner/branches` | `BranchOption[]` | `PartnerController.listOwnBranches` (traced in `docs/audits/partner-web/services.md`) |
| Create staff account | POST | `/partner/staff` | `PartnerStaffMember` | `PartnerOperationsService.createStaff` |
| Reassign staff to a branch | PATCH | `/partner/staff/:staffId/branch` | `PartnerStaffMember` | `PartnerOperationsService.reassignStaffBranch` |
| Update staff display name / avatar (modal) | PATCH/POST | `/partner/staff/:staffId/profile[/avatar]` | `PartnerOwnProfile` | traced and verified correct in `docs/audits/partner-web/profile.md` (`assertOwnsStaff`) |

## Backend trace
Unlike the single-arbitrary-branch bug found in `docs/audits/partner-web/profile.md`/`settings.md`, every staff endpoint here correctly handles multi-branch partners: `listStaff` scopes to `branchId: { $in: ownedBranchIds }` using `listOwnedBranchIds` (*all* the partner's branches, not just one), `reassignStaffBranch` validates both the target branch (`resolveOwnedBranchId`) and that the staff member currently belongs to one of the partner's owned branches before allowing the move, and `createStaff` only falls back to the single-branch `resolvePartnerBranchId` helper when the frontend didn't send an explicit `branchId` — which the frontend only allows when `hasMultipleBranches` is false (i.e. exactly one branch exists, so "arbitrary" pick is actually unambiguous) — a multi-branch partner is required by client-side validation (`page.tsx:85-88`) to explicitly choose a branch before the form can submit, and the server independently validates that choice via `resolveOwnedBranchId`. Active-job counts come from a single aggregation (`staffActiveJobCounts`, grouped by `assignedStaffId`) — no N+1.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Team members / Active jobs / High workload stat tiles | client-derived from `staff[]` (`.length`, sum of `.activeJobs`, count where `activeJobs > 3`) | the `> 3` "high workload" threshold is a hardcoded client-side constant, not server-configurable — acceptable for a simple visual flag, not a correctness issue |
| Add staff form | local draft state; `hasMultipleBranches` (from `branches.length > 1`) gates whether the branch `<select>` is shown and required | password confirmation and min-length (8) checked client-side, matching `CreateStaffDto`'s `@MinLength(8)` exactly |
| Staff table | `s.displayName ?? s.email ?? s._id`, `.avatarUrl`, `.role ?? 'staff'` (see Unused/dead fields — `role` is never actually populated by the backend, but the fallback makes this harmless since every row here is already staff-only), `.branchId` + branch `<select>` (only shown when `hasMultipleBranches`), `.phone`, `.createdAt` (via `formatMemberSince`), `.activeJobs` (badge color flips at `> 3`, matching the stat tile's own threshold) | |
| Edit profile modal | `staff.displayName/avatarUrl/email/_id` | already traced in `docs/audits/partner-web/profile.md` |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Create staff account | no | n/a | yes (`disabled={submitting}`) | yes (`formError`) |
| Reassign staff branch | no | n/a | yes (`disabled={reassigningId === s._id}` on the `<select>`) | yes (`reassignError`) |
| Edit staff name / avatar (modal) | no | n/a | yes (verified in `profile.md`) | yes (`toast.error`) |

No destructive (delete/deactivate) actions on this page — there's no way to remove a staff account from here (out of scope to flag as a gap; not implied by any visible UI element).

## Authorization
`GET/POST /partner/staff` and `PATCH /partner/staff/:staffId/branch` are all `@Roles(UserRole.PARTNER, UserRole.ADMIN)`, matching the frontend's `useRequirePartner()`. Every mutation re-validates branch ownership server-side (`resolveOwnedBranchId`/`listOwnedBranchIds`) rather than trusting the client-supplied `branchId` — a partner can't reassign a staff member to a branch they don't own, and can't reassign a staff member who doesn't already belong to one of their own branches. No `[authz]` issues.

## Findings
No issues found. This module handles the multi-branch-partner case more
correctly than the sibling Settings/Profile pages audited earlier in this
pass — worth noting as a positive pattern to point to if `settings.md`
Finding #1 (no branch selector, arbitrary single-branch resolution) is ever
addressed, since this page already demonstrates the fetch-branches +
conditionally-require-a-selection approach that fix would need.

## Unused/dead fields
`PartnerStaffMember.role` is declared in the frontend type and read on this
page (`s.role ?? 'staff'`) but never actually set by `formatStaffMember`
(`partner-operations.service.ts:610-629`) — always falls back to the
hardcoded `'staff'` string. Harmless in practice (every row this endpoint
returns is already filtered to `role: UserRole.STAFF` server-side, so the
displayed badge is trivially correct either way), but the field itself is
dead weight — not flagged as a bug since there's no incorrect behavior, just
an unpopulated optional field.

## Loading/error/realtime behavior
Both fetches (`staff`, `branches`) use the shared `usePartnerQuery` hook
(fixed for the "wipe on error" bug in `docs/audits/partner-web/inventory.md`
— this page benefits from that fix too). No polling or realtime
subscription — staff roster changes are infrequent and self-initiated from
this same page.
