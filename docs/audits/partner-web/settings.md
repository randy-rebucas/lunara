# Audit: Partner-web — Shop settings

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/settings/page.tsx`
- Component(s): `MachinesTab`, `SettingToggle`, `DetailRow` (all inline in the page file)

## Sub-pages
None — no outbound navigation into a dynamic detail route. Five tabs (Shop,
Hours, Machines, Preferences, Payout) are all rendered client-side from one
fetch, not separate routes.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load settings | GET | `/partner/settings` | `PartnerSettingsData` | `PartnerController.getSettings` -> `PartnerSettingsService.getSettings` |
| Save toggle/hours/holidays/payout | PATCH | `/partner/settings` | `PartnerSettingsData` | `PartnerController.updateSettings` -> `PartnerSettingsService.updateSettings` |
| Upload/remove logo | POST/DELETE | `/partner/settings/logo` | `{ branch: {...} }` | `PartnerController` (traced in `docs/audits/partner-web/profile.md`, shared `partner-api.ts` helpers) |
| List/add/edit/remove machines | GET/POST/PATCH/DELETE | `/partner/branches/:id/machines[/:machineId]` | `BranchMachine[]` | `PartnerController.*OwnBranchMachine*` -> `BranchesService.*Machine*` |

## Backend trace
`getSettings`/`updateSettings` resolve "the" branch for the caller via
`resolveBranch` — the same single-arbitrary-branch method flagged in
`docs/audits/partner-web/profile.md` Finding #1 (`PARTNER` role:
`branchModel.findOne({ partnerUserId })` with **no `.sort()`**, so a partner
who owns 2+ branches gets whichever one Mongo returns first). This page is
that finding's actual home — Profile only *displays* a couple of fields
sourced from the same call; this page is where a multi-branch partner would
actually try to edit hours/payout/machines and find themselves unable to
target a specific branch at all (see Finding #1 below, more complete here
than in Profile's version). `updateSettings` strips `undefined` keys from
the DTO before merging into `portalSettings` so an omitted toggle never
unsets an existing one, and separately merges `operatingHours`/`holidays`
only when present in the request. Machine CRUD goes through
`getOwnBranchOrThrow` for `PARTNER` (an exact `branch.partnerUserId` match)
— which cannot succeed for a `STAFF` caller by construction, since staff
aren't a branch's `partnerUserId` — see Finding #2 for what this broke.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Shop tab — logo/name/code/address | `branch.logoUrl/name/code/line1/city/province` | logo upload gated by `canEdit`, same helpers audited in `profile.md` |
| Shop tab — status/capacity/quota/radius | `branch.isActive/maxActiveOrders/maxWeightCapacityKg/dailyQuotaOrders/dailyQuotaWeightKg/serviceRadiusKm` | read-only display, no edit control on this page (branch capacity is admin-managed) |
| Hours tab | `branch.operatingHours` (7-entry array, edited via a local `hoursDraft` synced once from the loaded data) | explicit "Save hours" button, not auto-saved per toggle unlike Preferences |
| Holidays sub-section | `branch.holidays`, `.holidaysInherited`, `.isMainShop` (drives which of three explanatory copy variants is shown) | add/remove holiday saves immediately (no separate Save button) |
| Machines tab | `BranchMachine[].label/machineType/status/capacityKg` | see Finding #2 — `STAFF` couldn't load this at all before the fix |
| Preferences tab (3 sections: Order intake, Notifications, Operations) | `settings.acceptingOrders/autoAcceptIncoming/notifyNewOrders/notifyPickupArriving/notifyReadyForDelivery/notifyLowStock/allowStaffToRequestDelivery/requireWeightVerificationOnReceive/inventoryEnabled` | each toggle auto-saves individually via `updateSetting` (one PATCH per click, not batched) |
| Payout tab | `settings.payoutMethod/gcashNumber/mayaNumber/bankName/bankAccountName/bankAccountNumber` | **[FIXED]** see Finding #3 — these were sent to every role regardless of whether the UI would ever show them |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Toggle any Preferences setting | no | n/a | yes (`disabled={!canEdit \|\| saving}`) | yes (`toast.error`) |
| Save operating hours | no | n/a | yes (`disabled={saving}`) | yes |
| Add/remove holiday | no | n/a | yes (`disabled={saving}` on inputs/button) | yes |
| Upload/remove logo | no | n/a | yes (`disabled={logoBusy}`) | yes |
| Save payout method | no (stores account info, doesn't move money) | n/a | yes (`disabled={saving}`) | yes |
| Add machine | no | n/a | yes (`disabled={busy \|\| !addForm.label.trim()}`) | yes (`toast.error`) |
| Edit machine | no | n/a | yes | yes |
| Change machine status | no | n/a | yes (`disabled={busy}` on the `<select>`) | yes |
| Remove machine | yes — but explicitly labeled low-stakes: "This only affects capacity display — no orders are changed" | yes (`window.confirm`, `page.tsx:194`) | yes | yes |

## Authorization
`GET /partner/settings` and `PATCH /partner/settings` are `@Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)`/`@Roles(UserRole.PARTNER, UserRole.ADMIN)` respectively — `STAFF` can view but not edit, matching every `canEdit`-gated control on this page. `updateSettings` additionally double-checks `branch.partnerUserId.toString() !== userId` for `PARTNER` role, which is unreachable dead code given `resolveBranch` already only returns a branch it found *by* that same `partnerUserId` — harmless redundancy, not a gap. Machine routes were the one real mismatch — see Finding #2 (now fixed). No other `[authz]` issues.

## Findings

1. **A multi-branch partner can't target a specific branch anywhere on this page — every field silently reflects an arbitrary one.** Same root cause as `docs/audits/partner-web/profile.md` Finding #1: `PartnerSettingsService.resolveBranch` (`partner-settings.service.ts:29-37`) does `branchModel.findOne({ partnerUserId })` for `PARTNER` role with no sort, so which branch's hours/payout method/machines/toggles this page edits is whichever one MongoDB happens to return first — not user-selectable, and not necessarily stable across requests. This is a sharper version of the Profile finding because this page actually *writes* data (hours, payout details, machine inventory, operational toggles) per-branch, not just displays a read-only summary — a partner with 2 branches has no way to configure the second one's hours or machines from this UI at all. Notably, the sibling Services & pricing page (`docs/audits/partner-web/services.md`) already solved exactly this problem with a branch `<select>` (`loadBranches` -> `GET /partner/branches` -> a dropdown when `branches.length > 1`) — this page has no equivalent picker and doesn't even fetch the branch list.
   Left unfixed: adding a branch selector to this page, and threading a `branchId` through `getSettings`/`updateSettings`/every machine route, is a real feature-parity gap with Services & pricing, not a one-line fix — it needs the same UI pattern ported over plus deciding whether `PartnerSettingsService`'s single-branch model should be replaced entirely or just have a selector bolted on. Flagging clearly since the fix pattern already exists elsewhere in this exact app.

2. **[FIXED] [authz] Staff couldn't view the Machines tab at all — 403 on every load.** `GET /partner/branches/:id/machines` was `@Roles(UserRole.PARTNER, UserRole.ADMIN)` only (`partner.controller.ts:247`, pre-fix) — but this settings page is reachable by `STAFF` (`useProtectedPage({ roles: [PARTNER, STAFF, ADMIN] })`) and renders the Machines tab unconditionally, with `canEdit`-gated Add/Edit/Remove controls implying the intended behavior was "staff can view, only partners can edit" — the same pattern used consistently for every other tab on this page. Since `STAFF` wasn't in `@Roles` at all, every staff visit to this tab hit a 403 and the tab would sit in its error state.
   **Fix:** added `UserRole.STAFF` to `@Roles` for the GET route only (POST/PATCH/DELETE remain `PARTNER`/`ADMIN`-only, matching `canEdit`), and — since the existing `getOwnBranchOrThrow` ownership check only matches a branch's exact `partnerUserId` (which a staff member's `sub` can never equal) — added a staff-specific ownership check using `resolvePortalBranchId` (the same helper `PartnerSettingsService.resolveBranch` already uses for staff) to verify the requested branch is the staff member's own assigned branch — `apps/api/src/modules/partner/partner.controller.ts:246-259`. Typechecked `apps/api` clean.

3. **[FIXED] [sensitive-data exposure] `/partner/settings` sent the shop's full payout/banking details to every role, including staff who can never see or edit them in the UI.** `getSettings` (pre-fix) returned the complete `portalSettings` object — including `payoutMethod`, `gcashNumber`, `mayaNumber`, `bankName`, `bankAccountName`, and `bankAccountNumber` — to any authenticated caller regardless of role. The frontend never *renders* these for a non-`canEdit` viewer (the Payout tab shows a "Only shop partners can configure..." message instead, `page.tsx:1068-1072`), but the data was already present in the JSON response and readable via browser devtools/network inspection by any shop staff account — a bank account number and e-wallet numbers are more sensitive than a staff login needs, independent of whether the current UI happens to display them.
   **Fix:** `getSettings` now strips the six payout fields from the response when `canEdit` is false (i.e., for every role except `PARTNER`/`ADMIN`) via a new `stripPayoutDetails` helper — `apps/api/src/modules/partner/partner-settings.service.ts`. Verified the frontend doesn't break: `payoutDraft`'s seeding `useEffect` already falls back to `''` for any missing field (`page.tsx:467-472`), and the payout form itself is already gated behind `canEdit`, so a staff viewer sees the same "Only shop partners can configure..." message as before, just without ever receiving the banking data in the first place. Typechecked `apps/api` and `apps/partner-web` clean.

## Unused/dead fields
None remaining after Finding #3's fix — every field `PartnerSettingsData` can
return is either rendered for the roles that receive it, or (for the payout
fields) no longer sent to roles that don't render them.

## Loading/error/realtime behavior
The main settings fetch and the Machines tab's own fetch both use the shared
`usePartnerQuery` hook (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md` — both benefit from that fix). No
polling or realtime subscription — settings changes are infrequent and
self-initiated, consistent with every other configuration page in this app.
