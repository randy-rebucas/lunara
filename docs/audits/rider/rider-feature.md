# Audit: Rider feature — admin-web + partner-web + rider-mobile + apps/api

Date: 2026-09-11

This is a cross-app audit of the "rider" feature, which spans three frontend
apps built around one shared `Rider` schema (`apps/api/src/modules/riders/schemas/rider.schema.ts`).
Per-page detail for each app already exists and is not repeated wholesale
here — this doc focuses on the seams between the apps and the backend: the
shared schema, cross-partner authorization, the employment-activation gate,
and the self-service document/assignment flows that connect them. See:
- `docs/audits/admin-web/riders.md` (fleet board, withdrawals, rider profile page)
- `docs/audits/rider-mobile/profile.md`, `docs/audits/rider-mobile/tasks.md` (self-service profile/documents, task accept/reject)
- `docs/audits/partner-web/staff.md` (older non-slug `/staff` route — the current `[partnerSlug]/staff` "Riders" tab audited fresh here)

`apps/api/src/modules/rider-applications` is a **separate, unrelated** pre-hire
application model (a laundry-partner's application to become a rider before
any `User`/`Rider` document exists) — intentionally not part of this trace.

## Entry point

Three independent entry surfaces hit the same `Rider` collection:

1. **admin-web** (unscoped, all partners): `apps/admin-web/src/app/riders/page.tsx` → `RidersBoard`
   (`apps/admin-web/src/components/datacenter/riders-board.tsx`), `apps/admin-web/src/app/riders/[userId]/page.tsx`
   (rider profile/review), `apps/admin-web/src/app/riders/withdrawals/page.tsx` → `WithdrawalsBoard`
   (`apps/admin-web/src/components/datacenter/withdrawals-board.tsx`). Full per-widget detail already
   documented in `docs/audits/admin-web/riders.md`; re-verified here for the admin.service.ts
   gate-bypass and cross-partner-link questions below.
2. **partner-web** (partner-owned riders only): `apps/partner-web/src/app/[partnerSlug]/staff/page.tsx`
   "Riders" tab + `apps/partner-web/src/components/rider-profile-modal.tsx`, via
   `apps/partner-web/src/lib/partner-api.ts`.
3. **rider-mobile** (self-service, single rider): tasks/profile screens under `apps/rider-mobile/app/`
   hitting `/riders/me`, `/riders/me/documents/:type`, `/riders/payout-method` (wallet), gated by
   `src/context/rider-operations.tsx`'s `goOnline()`, typed in `src/lib/rider-types.ts`. Full
   per-widget detail already documented in `docs/audits/rider-mobile/profile.md` and `tasks.md`.

### admin-web trace
- Fleet board (`RidersBoard`) fetches `GET /admin/riders` (`AdminService.getRiders` — unscoped `riderModel.find()`) and `GET /admin/riders/documents/pending`. Invite posts `POST /admin/riders` → `AdminService.createRider` (creates a platform rider, no `partnerId`).
- Rider profile page fetches `GET /admin/riders/:userId/profile` → `RidersService.getRiderProfileForAdmin` (unscoped — no `partnerId` filter, correct for an admin-wide view). Employment PATCH → `RidersService.updateEmployment(userId, dto)` called with **no `scope` arg**, so it's the unscoped admin variant of the same gated method partner-web uses (see Findings #1 — confirmed *not* a bypass).
- Withdrawals board fetches `GET /admin/riders/withdrawals`, approve/reject via a two-step `NoteModal` confirm (the most defensively-built rider mutation of the three admin-web surfaces).
- `admin.service.ts` owns exactly two rider methods (`getRiders`, `createRider`) — every mutation (document review, employment, wallet hold, earnings credit, remittances) delegates to `RidersService`/`RiderWalletService`, the same services partner-web uses with a `{ partnerId }` scope object.

### partner-web trace
- "Riders" tab on `staff/page.tsx` fires two unconditional `usePartnerQuery` calls on mount: `listAssignedRiders()` (`GET /partner/riders` — each branch's single default pickup/delivery rider) and `listOwnedRiders()` (`GET /partner/riders/owned` — riders this partner added themselves, `partnerId`-scoped). A third, independent consumer of the same two endpoints exists at `apps/partner-web/src/app/[partnerSlug]/pickup-delivery/page.tsx` (read-only, own `riderName`/merge logic — a duplication worth noting, not a bug).
- `RiderProfileModal` (opened from the "Edit" row action) owns document upload/review, employment activate/suspend, payout method, and remove-rider mutations — see Mutations and Findings below.
- `apps/api/src/modules/partner/partner-operations.service.ts` — every riderUserId-keyed method (`updateOwnedRider`, `removeOwnedRider`, `uploadDocumentForPartner`-via-controller, `reviewDocument`-via-controller, wallet payout methods) resolves `partnerId` server-side via `resolvePartnerId(userId, role)` and queries `riderModel.findOne({ userId: riderUserId, partnerId })` — **never `{ userId }` alone**. `resolvePartnerId` itself never takes a client-supplied partner id; for `PARTNER` role it's `new Types.ObjectId(userId)` from the JWT, for `ADMIN` it resolves the admin's "representative branch" partner. No cross-partner leakage found (see Authorization).

### rider-mobile trace
- `rider-operations.tsx`'s `goOnline()` runs three client-side gates before calling `POST /riders/online`: a busy-debounce, an **employment-status check** (blocks going online client-side if `partnerId` is set and `employmentStatus !== 'active'`, with a status-specific `Alert`), and a compliance check (profile/document gaps, with deep links to fix them). The server-side `ForbiddenException` fallback (when the client's own gates are stale) surfaces only `e.message`, not the structured `profileGaps`/`documentGaps` array the exception carries — a minor UX regression versus the client-side path, not a bug (the message text alone is still informative).
- Document upload (`POST /riders/me/documents/:type`) always writes the new document with `status: 'pending'` (`RidersService.uploadDocument`, `riders.service.ts:707-716`) — a rider can never self-approve by re-uploading; approval requires an admin/partner review call. Confirmed no self-approve path exists.

## Sub-pages

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `admin-web/riders/[userId]/page.tsx` | fleet board row "Open full profile" (`riders-board.tsx:892`), pending-doc rail "Review →" (`:925`) | `selected.userId` / `row.userId` → `userId` route param | yes — fetch is `/admin/riders/${userId}/profile` |
| `admin-web/riders/[userId]/page.tsx` (also linked from `accounting-board.tsx:305`, `quality-alerts-board.tsx:85`) | ledger `row.accountSubject` (= the rider's `userId`, set that way by every `LedgerService.post` call in `riders.service.ts`), quality-alerts `r.riderId` (grouped from `reviewModel` by rider userId) | both are the rider's `userId`, not the Rider document's own `_id` | yes — verified both values are userIds, not Mongo `_id`s, so the link resolves correctly |
| `rider-mobile/profile/edit.tsx`, `rider-mobile/documents.tsx` | profile tab rows | none (JWT identity) | yes — already traced in `docs/audits/rider-mobile/profile.md` |
| `rider-mobile/pickup/[id].tsx`, `delivery/[id].tsx` | tasks tab task cards | `item._id` → route `id` | yes — already traced in `docs/audits/rider-mobile/tasks.md` |

`RiderProfileModal` on partner-web is an in-page modal, not a route — not a sub-page by this skill's definition, but treated with full mutation-safety detail below since it's the primary rider-management surface for partners.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Admin fleet roster | GET | `/admin/riders` | `RiderRow[]` | `AdminController.getRiders` → `AdminService.getRiders` (unscoped) |
| Admin invite rider | POST | `/admin/riders` | `RiderRow` | `AdminController.createRider` → `AdminService.createRider` |
| Admin rider profile | GET | `/admin/riders/:userId/profile` | `RiderProfileData` | `AdminController.getRiderProfile` → `RidersService.getRiderProfileForAdmin` |
| Admin employment update | PATCH | `/admin/riders/:userId/employment` | — | `AdminController.updateRiderEmployment` → `RidersService.updateEmployment(userId, dto)` — no scope |
| Partner assigned riders (branch default) | GET | `/partner/riders` | `PartnerBranchRider[]` | `PartnerController.listAssignedRiders` → `PartnerOperationsService.listAssignedRiders` |
| Partner owned riders | GET | `/partner/riders/owned` | `PartnerOwnedRider[]` | `PartnerController.listOwnedRiders` → `PartnerOperationsService.listOwnedRiders` |
| Partner create/update/remove owned rider | POST/PATCH/DELETE | `/partner/riders/owned[/:id]` | `PartnerOwnedRider` | `PartnerOperationsService.createOwnedRider` / `updateOwnedRider` / `removeOwnedRider` — all `partnerId`-scoped |
| Partner document upload/review | POST/PATCH | `/partner/riders/owned/:id/documents/:type` | `PartnerOwnedRider` | `RidersService.uploadDocumentForPartner` / `reviewDocument({ partnerId })` |
| Partner employment update | PATCH | `/partner/riders/owned/:id/employment` | `PartnerOwnedRider` | `RidersService.updateEmployment(userId, dto, { partnerId })` — gated |
| Partner payout method get/set | GET/PATCH | `/partner/riders/owned/:id/payout-method` | `RiderPayoutMethodInfo` | `RiderWalletService.getPayoutMethodForPartner` / `updatePayoutMethodForPartner` — both `{ userId, partnerId }`-scoped |
| Rider self profile | GET/PATCH | `/riders/me` | `RiderMe` | `RidersController.getMe`/`updateMe` → `RidersService.getMe`/`updateProfile` |
| Rider self document upload | POST | `/riders/me/documents/:type` | `RiderMe` | `RidersService.uploadDocument` — always sets `status: 'pending'` |
| Rider go online/offline | POST | `/riders/online`, `/riders/offline` | `{isOnline, shiftStatus}` | `RidersService.setOnline` |
| Rider accept open pickup offer | POST | `/riders/pickup-offers/:orderId/accept` | — | `PickupService.acceptPickup` |

## Backend trace

`RidersService` is the single source of truth for the `Rider` document. Every
mutating method that a non-owner role can reach (`updateEmployment`,
`reviewDocument`, `uploadDocumentForPartner`) accepts an optional
`{ partnerId }` scope object and, when present, folds it directly into the
`riderModel.findOne({ userId, partnerId })` filter — there is no unscoped
fallback that a partner-supplied param can trigger. `RiderAssignmentService`
maintains its own eligibility gate (`assertRiderEligibleForAssignment`) as
the single enforcement point for every *admin/dispatch-initiated* pickup/
delivery assignment path (direct assign, confirmed suggestion, reassign,
branch-default short-circuit) — this is a well-designed single-choke-point
pattern. The one path that did **not** go through that choke point was the
rider's own open-offer self-accept flow (`PickupService.acceptPickup`), fixed
in this pass — see Findings #1.

No N+1s found in the traced methods; `listOwnedRiders`/`getRiders` batch their
user lookups via `$in`, and `rider-assignment.service.ts`'s suggestion ranking
uses grouped aggregates instead of per-rider `countDocuments()` calls (already
commented in the source as a prior fix).

## Cards / panels

Full per-widget tables already exist in `docs/audits/admin-web/riders.md`
(fleet board / withdrawals / rider profile) and `docs/audits/rider-mobile/profile.md`
(self-service profile/documents). Partner-web's "Riders" tab, not previously
audited at the `[partnerSlug]` route:

| Card | Fields consumed | Notes |
|---|---|---|
| "Add rider" form | local draft (email/phone/firstName/lastName/vehicleType/password) | Client-side validation only (required email, password ≥8, match) — no server-side field-level echo beyond a generic error string. |
| Owned-riders table | `firstName`/`lastName`/`email`/`userId` (fallback chain), `email`/`phone`, `vehicleType`/`plateNumber`, `employmentType`, `isOnline`/`shiftStatus`, Edit/Remove actions | Full field usage. |
| "Default rider per branch" table | `riderGroups` (client `Map` grouping `branchRiders` by `rider._id`), branch name/code badges | Full field usage; this is `PartnerAssignedRider`, distinct from the owned-rider rows above. |
| `RiderProfileModal` | see Mutations below | Full field usage across profile/documents/employment/payout panels. |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Admin: approve/reject KYC doc | no (reject blocks activation) | reject requires typed reason then a separate "Confirm reject" button; approve fires on one click | yes, per-document busy state | yes, `actionError` |
| Admin: wallet hold / earnings credit | no (credits money) | none | yes | yes |
| Admin: withdrawal approve/reject | yes (moves real payout money) | yes — two-step `NoteModal` | yes | yes |
| Admin: invite rider | no | n/a | yes | yes |
| Partner: create owned rider | no | n/a | yes (`riderSubmitting`) | yes (inline `riderFormError`) |
| Partner: remove owned rider (staff page button) | yes | **no confirmation before this pass** | yes (`removingRiderId`) | yes (`riderActionError`) |
| Partner: remove owned rider (modal) | yes | yes — two-step inline confirm (Remove → Confirm remove/Cancel) | yes | yes, via a local `removeError` (inconsistent with the file's other `toast.error` calls, but visible) |
| Partner: approve/reject document (modal) | no (reject blocks activation) | reject button disabled until a reason is typed; approve fires on one click | yes | yes, `toast.error` |
| Partner: upload/replace document (modal) | no (replaces, old file best-effort deleted after) | no | yes | yes, `toast.error` |
| Partner: activate/suspend employment (modal) | suspend is destructive to task eligibility | **suspend had no confirmation before this pass**; activate/reinstate need none (reversible, gated by doc/payout checks) | yes (`activating`) | yes, inline `activateError` |
| Partner: save payout method (modal) | no, but sensitive (bank/e-wallet numbers) | no | yes | yes, `toast.error` |
| Partner: load payout method on hover (modal) | read-only | n/a | n/a | **silently swallowed before this pass** |
| Rider: upload avatar / edit profile / upload document (mobile) | no | n/a (source picker itself is the confirming step for documents) | yes, all three | yes, `Alert.alert` |
| Rider: accept pickup offer | no (claims a task) | n/a | yes | yes |
| Rider: reject pickup/delivery task | yes (gives up assignment) | yes, `Alert.alert` confirm | yes | yes |

## Authorization

- **[authz] Cross-partner leakage — none found.** Traced every `riderUserId`-keyed method in `partner-operations.service.ts` (`updateOwnedRider`, `removeOwnedRider`) and `rider-wallet.service.ts` (`getPayoutMethodForPartner`, `updatePayoutMethodForPartner`), plus the controller methods in `partner.controller.ts` that call `RidersService.uploadDocumentForPartner`/`reviewDocument`/`updateEmployment` with a `{ partnerId }` scope. Every one queries `{ userId: riderUserId, partnerId }`, and `partnerId` itself is derived server-side from the authenticated JWT via `resolvePartnerId(userId, role)` — never taken from the request body/params. A partner passing another partner's `riderUserId` gets a `NotFoundException`, not another partner's data.
- Admin routes are unscoped by design (`@Roles(UserRole.ADMIN)` only) — confirmed intentional (admin needs cross-partner visibility), and `admin.service.ts` has no partner-scoping bug to report.
- Rider-mobile's five self-service endpoints all key off `req.user.sub` (JWT subject), never a client-supplied id — no widening possible (already verified in `docs/audits/rider-mobile/profile.md`).
- **[authz] Assignment/offer eligibility gap — real, fixed this pass.** See Findings #1.

## Findings

1. **[authz] Suspended/terminated partner-owned riders could go online, receive pickup-offer push notifications, and self-claim an open pickup offer — bypassing the assignment eligibility gate entirely.**
   `RiderAssignmentService.assertRiderEligibleForAssignment` is the single enforcement point for every *admin-initiated* pickup/delivery assignment path, but three self-service paths never called it:
   - `RidersService.setOnline` (`riders.service.ts:902-924`) only checked `isRiderCompliant` (profile/document completeness) — nothing referenced `employmentStatus`, so a rider suspended *after* being compliant could still flip `isOnline: true`.
   - `RiderOfferPushService.notifyOnlineRiders` (`apps/api/src/modules/push/rider-offer-push.service.ts:14-21`) queried `{ isOnline: true }` with no `employmentStatus` filter, so a suspended-but-online rider (via the gap above) would still receive the push for an open offer.
   - `PickupService.acceptPickup` (`pickup.service.ts:120-124`) only checked `rider.isOnline`, never `employmentStatus` — so that same rider could then atomically claim the order's `pickupRiderId`, fully bypassing `assertRiderEligibleForAssignment` (which only guards `assignPickupRider`/`assignDeliveryRider`, a different code path from open-offer accept). The parallel `DeliveryService.acceptDelivery` path was confirmed safe because it requires the order to already have `deliveryRiderId` pre-assigned via the gated `assignDeliveryRider`.
   Concrete impact: a partner suspends a rider for cause, but that rider — if already online or able to re-trigger `goOnline()` before the client-side check catches a stale cache — could keep receiving and accepting pickup jobs server-side with no gate stopping them.
   **Fix:** added a shared `isRiderEligibleForWork()` helper (`apps/api/src/modules/riders/rider-compliance.ts`, mirroring `assertRiderEligibleForAssignment`'s rule) and wired it into all three gaps: `RidersService.setOnline` now throws `ForbiddenException` before flipping `isOnline` for an ineligible rider (`riders.service.ts:902-915`); `PickupService.acceptPickup` now throws `BadRequestException` for an ineligible rider before claiming the order (`pickup.service.ts:120-130`); `RiderOfferPushService.notifyOnlineRiders` now filters ineligible riders out of the push recipient list using the same `$or` pattern already used by `getPartnerScopedRiderPool` (`rider-offer-push.service.ts:14-25`). `npx tsc --noEmit` passes in `apps/api` after the change. No other consumer of `notifyOnlineRiders`/`acceptPickup`/`setOnline` was affected (checked call sites: `rider-assignment.service.ts`'s two broadcast helpers, `pickup.service.ts`'s `dispatchPickupSearch`, and the rider-mobile `goOnline()`/task-accept flows — all narrow, none rely on the previously-unfiltered behavior).

2. **Activation-gate bypass — checked, not present.** `PartnerOperationsService.updateOwnedRider`'s generic PATCH (`partner-operations.service.ts:974-989`) enforces the identical doc-approval + payoutMethod gate as `RidersService.updateEmployment` (`riders.service.ts:676-690`) before allowing `employmentStatus: 'active'`. `admin.service.ts` has no competing rider-PATCH method at all — the only admin employment route (`PATCH /admin/riders/:userId/employment`) delegates to the same gated `RidersService.updateEmployment`. No fix needed — documenting the checked-and-clean result per the task brief.

3. **Self-service document upload — checked, not present.** `RidersService.uploadDocument` and `uploadDocumentForPartner` both always write the new/replaced document with `status: 'pending'` (`riders.service.ts:707-716`, `:740-748`) — there is no path by which a rider's own upload sets `status: 'approved'`. No fix needed.

4. **Assignment filter gaps — one real gap, fixed as part of Finding #1.** Every admin-initiated path (`getPartnerScopedRiderPool`, `applyBranchDefaultRider`, `autoAssignPickupRiderIfConfigured`, `assertRiderEligibleForAssignment`) already filtered correctly before this pass. `notifyAwaitingDeliveryDispatch`'s inline branch-default check (`rider-assignment.service.ts:462-464`) checks only `isOnline`, not `employmentStatus` — but it's immediately followed by `assignDeliveryRider`, which enforces the gate downstream (`try { assignDeliveryRider(...) } catch { /* fall through */ }`), so an ineligible default rider is rejected there, not silently assigned. No change needed to that specific spot. The genuine gap was the pickup open-offer self-accept path (Finding #1).

5. **Frontend/schema drift.**
   - admin-web's `RiderProfileData` type (`[userId]/page.tsx:38-69`) omits several fields `serializeMePayload`/`getRiderProfileForAdmin` actually return: `partnerId`, `avatarUrl`, `hireDate`, `feeRates`, `shopLocation`, `employmentStatus`, `compliance.approvedDocumentCount`. None are sensitive (all are either the admin's own operational data or already visible elsewhere on the page via other fields); `employmentStatus` specifically being untyped/unrendered is a minor gap since the page's Employment panel edits fields that gate it but never displays the current computed status directly (the online/inactive badges are a proxy, not the same thing). **Left unfixed** — wiring a new "Employment status" display is a small UI decision better made by whoever owns admin-web's page layout, out of scope for a backend/authz-focused pass.
   - rider-mobile's `RiderMe` type (`rider-types.ts`) omits `fixedWageAmount`, `wageFrequency`, and `hireDate`, all sent by `serializeMePayload`. Not sensitive (the rider's own wage config). **Left unfixed** — already flagged and deliberately left as-is in `docs/audits/rider-mobile/profile.md` Finding #4 (likely payload for a not-yet-audited employment/wage screen).
   - `packages/types/src/partner.ts`'s `PartnerOwnedRider`/`PartnerOwnedRiderDocument` match `formatOwnedRider`'s actual return shape field-for-field — no drift found there.

6. **Mutation safety on `rider-profile-modal.tsx` — two real gaps, fixed this pass; one minor inconsistency left as-is.**
   - Payout method's `ensurePayoutLoaded()` (triggered on hover) silently swallowed a fetch failure in an empty `catch {}`, leaving the form populated with stale/blank data and no indication anything failed. **Fix:** now shows `toast.error` and resets the "already loaded" flag so the next hover retries (`rider-profile-modal.tsx:97-112`).
   - "Suspend" fired immediately on click with no confirmation, unlike "Remove rider" which already had a two-step confirm. **Fix:** added a `window.confirm` guard before suspending, matching the `window.confirm` pattern already used elsewhere in partner-web (`inventory/page.tsx`, `shelf-lookup/page.tsx`, `services/page.tsx`) (`rider-profile-modal.tsx:190-193`).
   - The "remove rider" confirm step itself (two-step inline confirm: Remove → Confirm remove/Cancel, with the Confirm and Cancel buttons both disabled while removing) still works correctly and was not affected by this session's other uncommitted edits to this file — traced end-to-end, no broken references to removed state/props found.
   - Minor, left unfixed: "remove rider"'s error uses a local `removeError` state instead of the `toast.error` pattern every other handler in this file uses. Cosmetically inconsistent but still visible to the user — not a real bug, out of scope to touch for consistency alone.
   - On the staff page's own table (not the modal), the "Remove" button fired the delete with **no confirmation at all** — a different, more exposed gap than the modal's already-confirmed flow. **Fix:** added the same `window.confirm` pattern (`apps/partner-web/src/app/[partnerSlug]/staff/page.tsx:247-249, 736-741`).

## Unused/dead fields

- `RiderProfileData` (admin-web) missing `partnerId`/`avatarUrl`/`hireDate`/`feeRates`/`shopLocation`/`employmentStatus`/`compliance.approvedDocumentCount` from its frontend type despite the backend sending them — see Finding #5. None sensitive.
- `RiderMe` (rider-mobile) missing `fixedWageAmount`/`wageFrequency`/`hireDate` — see Finding #5 and `rider-mobile/profile.md` Finding #4. None sensitive.
- `RiderKycDocument.reviewedBy` — already removed from the rider-facing payload in a prior pass (`rider-compliance.ts:164-166`, confirmed still absent). Not re-flagged.
- `partner-api.ts`'s `listPendingRiderDocuments()` has no caller in `staff/page.tsx`, `rider-profile-modal.tsx`, or `pickup-delivery/page.tsx` — the modal instead reviews documents per-rider off `rider.documents` directly. Possibly dead code; not removed here since it may be used by a screen outside this audit's four traced files.
- `PartnerStaffMember.role` (unrelated to riders, already flagged in `docs/audits/partner-web/staff.md`) — not re-flagged here.

## Loading/error/realtime behavior

- admin-web: `useAdminQuery` + `useAdminOperationsSocket` pattern across all three surfaces; already documented in `docs/audits/admin-web/riders.md` (benefits from the shared reload-keeps-stale-data fix noted there).
- partner-web: `usePartnerQuery` for both `listAssignedRiders`/`listOwnedRiders` fetches (shared "wipe on error" fix from `docs/audits/partner-web/inventory.md` applies here too); no realtime subscription on the Riders tab (reasonable — roster changes are self-initiated, not live-ops events).
- rider-mobile: `goOnline()`/`acceptPickupOffer` etc. live in `rider-operations.tsx`'s shared context, refreshed after each mutation; task/document/profile screens each have independent `loading`/`error` state via `DataLoadState`, with pull-to-refresh where applicable — already documented in `docs/audits/rider-mobile/profile.md`/`tasks.md`.
- No module in this trace polls on an interval; all rely on either an operations socket, pull-to-refresh, or post-mutation refetch.
