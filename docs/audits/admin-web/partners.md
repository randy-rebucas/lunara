# Audit: Admin-web — Partners (laundry shop accounts)

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/partners/page.tsx`
- Component(s): `apps/admin-web/src/components/datacenter/partners-board.tsx` (`PartnersBoard`, 1435 lines — list + row-click drawer, no separate route for detail)

## Sub-pages
No dynamic detail route — clicking a row opens `PartnerDetailsDrawer` in place (a
slide-out panel with its own tabs: Overview/Branches/Subscription/Settlements/
Documents/Audit/Settings), fetching `/admin/shops/:id/detail` directly from
`partners-board.tsx:575`, not via navigation. This is the same "in-page drawer,
not a route" pattern as the branches board.

Three static (non-dynamic) pages are linked from this module's header/tabs and
are out of this audit's scope per the Scope section (they're not per-record
detail views): `/partners/new` ("+ Add New Partner" button), `/partners/branding`
(Settings tab), `/partners/settlements` (Settlements tab). Worth their own audits
if desired, not traced here.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Partner list | GET | `/admin/shops` | `{ shops: Shop[] }` | `AdminController.getShops` -> `AdminService.getShops` |
| Parent-branch options (for Add branch drawer) | GET | `/admin/branches/parents` (fixed, was `/admin/branches`) | `ParentBranch[]` | `AdminController.getParentBranches` -> `BranchesService.listParentBranches` |
| Partner detail drawer | GET | `/admin/shops/:id/detail` | `ShopDetail` | `AdminController.getShopDetail` -> `AdminService.getShopDetail` |
| Suspend/reactivate | PATCH | `/admin/shops/:id` | — | `AdminController.setShopActive` -> `BranchManagementService.setPartnerActive` |
| Edit business info / subscription / document verification | PATCH | `/admin/shops/:id/profile` | — | `AdminController.updatePartnerProfile` -> `AdminService.updatePartnerProfile` |
| Add branch | POST | `/admin/branches` | — | `AdminController.createBranch` (via `AddBranchDrawer`) |

## Backend trace
`getShops()` runs partner lookup plus three parallel aggregates (lifetime order
stats, 30-day order stats, review ratings) keyed by `partnerId`/`_id`, plus one
more query for every branch owned by any partner to build `branchNames`/
`mainBranchName`/`operatingHours` maps. `getShopDetail(id)` re-runs equivalent
aggregates scoped to a single partner (this-month/last-month summaries, branch
list, 5 most recent orders, repeat-customer rate, rating) — reasonable, no N+1
inside it. `setPartnerActive` blocks deactivation while the partner has any
non-terminal order in progress across any of its branches (matches the frontend's
confirm-dialog copy exactly).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Stat tiles (Total/Active/Trial/Inactive/Revenue 30d) | `isActive`, `subscriptionPlan`, `revenue30d`, `totalOrders` | Counts computed client-side over the full loaded `shops` array — acceptable here since `getShops()` already returns the complete partner list in one call (no pagination to fight, unlike the laundry-tags full-fetch-loop finding from an earlier audit). |
| Partner table | `ownerName`/`email`/`_id`, `branchNames`+`mainBranchName` (via `branchSummary`), `isActive`, `subscriptionPlan`+`planPrice`+`planRenewsAt`/`trialEndsAt`, `orders30d`, `revenue30d`, `rating`+`reviewCount` | `PLAN_BADGE`/`PLAN_LABEL` (`partners-board.tsx:129-141`) are hardcoded maps keyed by `SubscriptionPlan` — must stay in sync by hand if a plan tier is added/removed, same class of finding as the laundry-tags `BOOKING_TYPE_LABELS` map before it was tied to the enum. |
| Drawer > Overview tab | `performance.{ordersThisMonth,completedThisMonth,cancelledThisMonth}` + deltas, `performance.completionRate`, `rating`+`reviewCount`, `performance.repeatRate`, business info fields, `pickupRadiusKm`/`deliveryRadiusKm`/`coverageCities`, `recentOrders` | `performance.revenueThisMonth` and `performance.revenueDelta` are computed by the backend but have no corresponding tile here (Orders/Completed/Cancelled each get a delta tile, revenue doesn't) — see Unused/dead fields. |
| Drawer > Branches tab | `branches[].{name,isActive,city,province,maxActiveOrders,serviceRadiusKm}` | All fields used, no dead weight. |
| Drawer > Subscription tab | `subscriptionPlan`, `planPrice`, `planRenewsAt`/`trialEndsAt` | Straightforward edit form, no derived logic. |
| Drawer > Documents tab | `tin`, `businessPermitNumber`+`businessPermitVerified`, `birRegistrationNumber`+`birRegistrationVerified`, `deliveryRadiusKm` | Verify/Unverify toggles a single boolean per field — see Mutations. |
| Drawer > Settlements/Audit/Settings tabs | link-outs only (`/partners/settlements`, `/audit-log`, `/partners/branding`) plus the suspend/reactivate action on Settings | No additional fetch. |
| `AddBranchDrawer` | `parentBranches` (`ParentBranch[]`), address fields via `BranchAddressEditor` | Uses the now-correct lightweight parent-branch endpoint (see Findings). |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Suspend partner (`toggleActive`, deactivating) | yes — blocks dispatch to all branches, fails if orders in progress | yes, `window.confirm` names the partner and states the exact consequence (`partners-board.tsx:616-623`) | yes, `disabled={togglingActive}` | yes, `actionError` |
| Reactivate partner (`toggleActive`, activating) | no | n/a (correctly skipped, per the `!nextActive &&` guard) | yes | yes |
| Edit business info (`saveInfo`) | no | n/a | yes, `disabled={savingInfo}` | yes |
| Edit subscription (`saveSubscription`) | no | n/a | yes, `disabled={savingSub}` | yes |
| Verify/unverify permit or BIR doc (`toggleVerified`) | no (reversible toggle) | n/a | yes, `disabled={verifyBusy === which}` | yes |
| Add branch (`AddBranchDrawer.submit`) | no | n/a | yes, `disabled={busy}` | yes |

No issues found in this section — every mutation on this page already follows the
checklist correctly.

## Authorization
`AdminController` is class-level `@Roles(UserRole.ADMIN)` (`admin.controller.ts:70`),
so every endpoint this module calls — `getShops`, `getShopDetail`, `setShopActive`,
`updatePartnerProfile`, `getParentBranches`, `createBranch` — is admin-only, matching
the frontend (admin-web has no other role able to reach this board). None of these
endpoints take a role-scoped filter param (there's no "which partner's data can I
see" narrowing to check — admin sees all partners by design), so there's no
widening-via-param risk to check here. No `[authz]` findings.

## Findings

1. **Parent-branch dropdown was fetching the wrong, much heavier endpoint.**
   `PartnersBoard.load()` (`partners-board.tsx:1136`, pre-fix) called
   `adminFetch<ParentBranch[]>('/admin/branches')`, which hits
   `BranchesService.listBranches()` — a query that runs
   `serializeBranchWithCapacity()` per branch (`branches.service.ts:1666`), which
   itself issues 3 sequential DB queries per branch (`countActiveOrders`,
   `countTodaysOrders`, `sumBranchWeightLoadKgInternal`). A dedicated, lightweight
   endpoint already exists for exactly this dropdown: `GET /admin/branches/parents`
   -> `listParentBranches()` (`branches.service.ts:894`, explicitly commented "All
   active branches including HQ — lightweight list for parent branch selectors"),
   returning only `{_id, code, name}` with a single un-augmented query. This is the
   same bug class already found and fixed in `branches-board.tsx` on 2026-07-22
   (see `docs/audits/admin-web/branches.md`, Finding 1) — it had recurred
   independently in this sibling module.
   **Fix:** `partners-board.tsx:1137` now calls `/admin/branches/parents`
   instead of `/admin/branches`. Cross-module check (per the skill's step 12): grepped
   all other `/admin/branches` GET consumers — `users-board.tsx:243`
   (`BranchOption` — same `{_id,code,name}` shape, but needs HQ *excluded* since
   staff shouldn't be assignable to HQ, which `listBranches()`'s
   `operationalBranchFilter()` already does correctly — left unchanged, verified
   not a duplicate of this bug) and `settings/page.tsx:301` (`BranchCoverageRow` —
   needs `city`/`province`/`serviceRadiusKm`, fields the lightweight endpoint
   doesn't return — left unchanged, genuinely needs the heavier query).

2. **`staffCount` was a dead field computed incorrectly.** `AdminService.getShops()`
   (`admin.service.ts:899`, pre-fix) computed
   `this.userModel.countDocuments({ role: STAFF, isActive: true })` **once, outside
   the per-partner map**, and assigned that single platform-wide count to every
   partner's `staffCount` field — every shop in the list would have shown the same
   number, and it wasn't even partner-scoped. It was also never rendered anywhere
   in `partners-board.tsx` (only declared on the `Shop` type, `partners-board.tsx:29`
   pre-fix).
   **Fix:** removed the field from both the backend response
   (`admin.service.ts`, the `staffCount` local and its use in the returned object)
   and the frontend `Shop` interface — it was unused, so deleting the misleading
   computation is safe rather than fixing its scoping for a value nothing reads.

## Unused/dead fields
- `Shop.revenue` (lifetime revenue per partner, `admin.service.ts` `getShops`) is
  fetched and typed on the frontend but never rendered — only `revenue30d` is
  shown, in the list table and the "Revenue (30d)" stat tile. Left as-is: this
  looks like a deliberate simplification (30-day revenue is the actionable number
  for this list), not a bug — an ambiguous UX call, not fixed here.
- `ShopDetail.performance.revenueThisMonth` / `.revenueDelta` (computed in
  `getShopDetail`) have no corresponding tile in the Overview tab, unlike
  Orders/Completed/Cancelled which each get a `MiniStatTile` with a delta. Whether
  a partner's monthly revenue trend belongs in this drawer is a product decision,
  not fixed here.

## Loading/error/realtime behavior
List and detail both use the shared `useAsyncQuery`/`useAdminQuery` hook
independently: the list drives `loading`/`error`/`reload` for `shops` (and also
loads `parentBranches` as a side effect inside the same `load()` call — a failed
`/admin/branches/parents` call now fails the whole partner list load, same
coupling as before the fix, just against a cheaper endpoint), while
`PartnerDetailsDrawer` manages its own separate `detailLoading`/`detailError`
state via a local `loadDetail()`, independent of the parent list. No realtime
socket subscription on this page — actions call `reload()` (list) and/or
`loadDetail()` (drawer) directly after a mutation succeeds, which is appropriate
for an admin-driven CRUD board with no other actor pushing state changes.
