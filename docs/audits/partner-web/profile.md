# Audit: Partner-web — Profile

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/profile/page.tsx`
- Component(s): `DetailRow` (inline in the page file)

## Sub-pages
None — no outbound navigation into a dynamic detail route. Links to
`/settings` and `/staff` are sibling top-level pages, not detail views of
this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Shop branch info | GET | `/partner/settings` | `PartnerSettingsData` | `PartnerController.getSettings` -> `PartnerSettingsService.getSettings` |
| Own profile | GET | `/partner/profile` | `PartnerOwnProfile` | `PartnerController.getOwnProfile` -> `PartnerProfileService.getOwnProfile` |
| Update display name | PATCH | `/partner/profile` | `PartnerOwnProfile` | `PartnerController.updateOwnProfile` -> `PartnerProfileService.updateOwnProfile` |
| Upload avatar | POST (multipart, via `uploadOwnAvatar` in `partner-api.ts`) | `/partner/profile/avatar` | `PartnerOwnProfile` | `PartnerController.uploadOwnAvatar` -> `PartnerProfileService.updateOwnAvatar` |
| Remove avatar | DELETE | `/partner/profile/avatar` | `PartnerOwnProfile` | `PartnerController.removeOwnAvatar` -> `PartnerProfileService.removeOwnAvatar` |
| Sign out | — | — (`staffLogout()`, already traced in `docs/audits/partner-web/login.md`) | — | `AuthController.logout` |

## Backend trace
`PartnerProfileService`'s own-profile methods are all correctly scoped by
`req.user.sub` (a `UserProfile` document keyed by `userId`, upserted on
first name/avatar change) — no ownership check needed since a user can only
ever act on their own `sub`. Avatar upload/remove correctly deletes the
*previous* Cloudinary asset after uploading/clearing the new one
(`updateOwnAvatar`/`removeOwnAvatar`, both read the prior `avatarUrl` before
upserting, then call `cloudinaryStorageService.deleteFile` after — no
orphaned-then-leaked-forever assets, and no risk of deleting the new asset
since the delete uses the *previous* url captured before the upsert).
`getSettings` (shared with the actual Settings page, not traced fully here)
resolves "the" branch for the caller via `resolveBranch` — for `STAFF`, via
`resolvePortalBranchId` (their own assigned branch, unambiguous); for
`PARTNER`, via `branchModel.findOne({ partnerUserId })` with **no sort
applied** — see Finding #1.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Avatar + name + role | `profileData.avatarUrl` (fallback: first letter of `displayName`), `profileData.displayName` (fallback: `user.email`, then `'Portal user'`), `user.role` (via `roleLabel`, a hardcoded 3-case label map matching `PortalRole`'s only 3 values) | |
| Photo upload/remove controls | `profileData.avatarUrl` (toggles "Upload"/"Change"/"Remove" button states) | file input restricted to `image/jpeg,image/png,image/webp`, matching the backend's `ALLOWED_IMAGE_TYPES` allowlist exactly |
| Display name editor | `nameDraft` (local, seeded from `profileData.displayName` via `useEffect`) | Save button disabled unless the trimmed draft is non-empty and differs from the last-saved value |
| Detail list (Email / Role / Shop branch / Address) | `user.email`, `user.role`, `shopData.branch.{name,code}`, `.{line1,city,province}` (Address row only rendered when `branch` is present) | "Shop branch" row shows "Loading…" / the branch / "Could not load branch" / "—" depending on `shopLoading`/`branch`/`shopError` state — all four states correctly covered |
| Footer actions | `partner` (`isPartnerRole()`, gates whether "Staff team" link shows) | "Shop settings" link always shown; "Sign out" always shown |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save display name | no | n/a | yes (`disabled={savingName || !nameDraft.trim() || nameDraft.trim() === profileData?.displayName}`) | yes (`toast.error`) |
| Upload avatar | no (replaces, previous asset cleaned up server-side) | n/a | yes (file input `disabled={avatarBusy}`, label shows "Uploading…") | yes (`toast.error`) |
| Remove avatar | no (reversible — upload another anytime) | n/a | yes (`disabled={avatarBusy}`) | yes (`toast.error`) |
| Sign out | no | n/a | n/a (immediate, best-effort) | n/a |

## Authorization
All four `/partner/profile*` routes and `/partner/settings` (GET) are `@Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)`, matching the frontend's `useProtectedPage({ roles: [PARTNER, STAFF, ADMIN] })`. Every profile mutation acts on `req.user.sub` only — no `staffId`/`userId` request param exists on the own-profile routes to widen scope to another account (the separate staff-profile routes, `PATCH/POST staff/:staffId/profile*`, are `PARTNER`/`ADMIN`-only and go through `assertOwnsStaff`, verified correct in the service trace above — not reachable from this page, which only calls the own-profile endpoints). No `[authz]` issues.

## Findings

1. A partner who owns more than one branch gets an arbitrary, non-deterministic "Shop branch" on this page (and on the actual Settings page, which shares the same `getSettings`/`resolveBranch` call). `PartnerSettingsService.resolveBranch` (`partner-settings.service.ts:29-37`) does `branchModel.findOne({ partnerUserId })` for `PARTNER` role with **no `.sort()`** — unlike `resolvePartnerBranches` (used by `getDashboard`, `getReports`, `getCustomers`, `getInventory` — see `docs/audits/partner-web/customers.md` and `inventory.md`), which correctly returns *all* of a multi-branch partner's branches and lets each caller decide how to aggregate/scope across them. A partner with 2+ branches would see whichever single branch Mongo happens to return first for "Shop branch" and "Address" here, which could differ between requests/deployments and doesn't necessarily match what they'd expect.
   Left unfixed: this is a pre-existing gap in `partner-settings.service.ts` (shared by both this page and Settings), not something introduced by or specific to Profile — and the real fix requires a product decision on what "my shop branch" should even mean for a multi-branch partner (a branch switcher? show all branches? use the first-created branch deterministically?), not a page-level bug fix. Flagging here since it's directly observable via this page's own fields, but the root cause and any fix belong to the settings service, not this page.

No other issues found — avatar cleanup correctly deletes the previous Cloudinary asset (not the newly-uploaded one), every displayed field matches what the backend returns, and role-based access is consistent between frontend and backend.

## Unused/dead fields
None found on this page's own profile fetches. `shopData` (`PartnerSettingsData`) carries a `settings`/`canEdit` field beyond `branch` that this page doesn't use — expected, since those fields exist for the actual Settings page, not this one; not a dead-field concern since this page only asks for and reads what it needs (`shopData?.branch`).

## Loading/error/realtime behavior
Both fetches use the shared `usePartnerQuery` hook (fixed for the "wipe on
error" bug in `docs/audits/partner-web/inventory.md` — this page benefits
from that fix too). No polling or realtime subscription — appropriate for a
low-change-frequency personal profile page. Mutation feedback goes through
`sonner` toasts (`toast.success`/`toast.error`) rather than the inline
`alert-error` pattern used on most other partner-web pages — a UI-consistency
observation, not a bug (the `Toaster` is correctly mounted app-wide in
`app/layout.tsx:34`, so these toasts do render).
