# Audit: Admin-web — Partner onboarding (Create partner)

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/partners/new/page.tsx` (`CreatePartnerPage`)
- Component(s): `BranchAddressEditor` (`apps/admin-web/src/components/datacenter/branch-address-editor.tsx`, shared — also used by `AddBranchDrawer` in `partners-board.tsx`, already implicitly exercised in `partners.md`, not re-audited in depth here)

## Sub-pages
None — no outbound navigation into a detail route. On success the page
`router.push('/partners')` (`page.tsx:92`), a redirect back to the already-audited
list page, not a linked detail sub-page.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Parent-branch options | GET | `/admin/branches/parents` | `Branch[]` | `AdminController.getParentBranches` -> `BranchesService.listParentBranches` |
| Create partner + branch | POST | `/admin/partners/onboard` | — | `AdminController.onboardPartner` -> `AdminService.onboardPartner` |

This page already calls the correct lightweight `/admin/branches/parents`
endpoint (not the heavier `/admin/branches`) — the same fix that was needed in
`partners-board.tsx`'s `AddBranchDrawer` (see `partners.md`, Finding 1) was
already in place here.

## Backend trace
`onboardPartner` checks for an existing user by email or phone (`ConflictException`
if found), hashes the password with `bcrypt` (cost 12), creates the `User` with
`role: PARTNER`, then calls `BranchManagementService.createBranch` — which
validates the parent branch and branch-code uniqueness, and marks the branch
`isMainShop: true` since a brand-new partner has no prior branches
(`branch-management.service.ts:304-321` — matches the page's own copy, "This
becomes the partner's main shop automatically"). If branch creation throws for
any reason, the just-created user is deleted to avoid a dangling login-only
partner account with no branch (`admin.service.ts:800-819`) — a correct
compensating rollback, since this isn't run in a DB transaction. Finally sends
the partner an invite email containing their temporary password in plaintext
(`email.service.ts:95-101`) — an intentional, documented pattern (the form's own
copy says "Share this with the partner after creation. They can change it on
first login."), not flagged as a bug.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Account section | `email`, `phone` (optional), `password` (with a "Generate" button producing `Lunara<8-char-random>!`) | Password input is `type="text"` (not masked) — deliberate, so the admin can read/copy it to share out-of-band; not a bug. |
| Branch section | `branchCode`, `branchName`, `branchType`, `parentBranchId` (options from `/admin/branches/parents`, labelled `code — name (city) [HQ]` for HQ options), address via `BranchAddressEditor` | Empty-options case is handled with a specific message + link to Setup (`page.tsx:192-198`) rather than a silent empty dropdown. |
| Capacity & commission section | `maxActiveOrders`, `maxWeightCapacityKg`, `commissionRate` (client `%` -> server fraction via `/100`) | Bounds on the inputs (`min`/`max`/`step`) line up with the DTO's `@Min`/`@Max` server-side validation — no mismatch. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Create partner & branch (`handleSubmit`) | no (pure creation) | n/a | yes, `disabled={busy}` | yes, `error` shown as `alert-error` |

No issues found in this section.

## Authorization
`AdminController` is class-level `@Roles(UserRole.ADMIN)` — matches the frontend
(admin-only page, only reachable from the already-audited admin-only Partners
board). No role-scoped filter to widen (this creates a brand-new account, there's
no "whose data can I see" narrowing to check) — no `[authz]` findings.

## Findings
No issues found. Validation on `OnboardPartnerDto` (`dto/onboard-partner.dto.ts`)
matches the frontend form's constraints field-for-field (email format, password
`@MinLength(8)`, `commissionRate` `@Min(0)@Max(1)` matching the `%`-to-fraction
conversion, `maxActiveOrders`/`maxWeightCapacityKg` `@Min(1)`, `branchType`
`@IsEnum`, `parentBranchId` `@IsMongoId`), the rollback-on-partial-failure logic
is correct, and the endpoint choice for the parent-branch dropdown was already
the efficient one.

## Unused/dead fields
None — every field in the response (`partner._id/email/phone`, `branch.branchId/code/name`)
is either used to redirect or not needed further (the page navigates away
immediately on success rather than displaying the created record).

## Loading/error/realtime behavior
`loadBranches` doesn't use the shared `useAdminQuery` hook (unlike three other
pages fixed this session for the same reason) — but here there's no need for
`reload`/stale-data-preservation semantics: this is a one-shot dropdown-population
fetch on a create-only form with no user-triggered refresh path, so the manual
`useEffect` + `try/catch` is sufficient and reasonably matches the hook's own
behavior in this narrow case (error message shown, no data to preserve). Not
flagged as an instance of the recurring finding — that pattern only matters where
a page needs `reload()`/stale-data behavior, which this page doesn't. No
realtime subscription; not applicable to a single create form.
