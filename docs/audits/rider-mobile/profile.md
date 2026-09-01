# Audit: Rider-mobile — Profile module

Date: 2026-09-02

## Entry point
- Page: `apps/rider-mobile/app/(tabs)/profile.tsx`
- Component(s): inline `Avatar`, `MenuRow`, `MenuSection` in the same file; `ComplianceBanner`
  (`src/components/compliance-banner.tsx`), `LocationPermissionBanner`, `StatusBadge`.

## Sub-pages

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `app/profile/edit.tsx` | "Edit profile" and "Vehicle info" rows, `profile.tsx:307,329`; also `ComplianceBanner`'s "Edit profile" link | none (rider identity from JWT) | yes |
| `app/documents.tsx` | "Documents" row, `profile.tsx:320`; also `ComplianceBanner`'s "Documents" link | none (rider identity from JWT) | yes |

Both sub-pages are full pages with their own fetch/mutation flow (not thin detail panels), so
they're covered in full here per the "deep sub-page" guidance, since they're tightly coupled to
the same `RiderMe` payload and small enough to keep in one doc.

### `profile/edit.tsx`
Re-fetches the entire `RiderMe` payload from `GET /riders/me` on mount (`load()`,
`edit.tsx:205-228`) rather than accepting the already-loaded `me` from
`useRiderOperations()` (the parent tab and `profile.tsx` both already hold this data in
context). This is a redundant round-trip on every "Edit profile" tap — not wrong, but an
extra request for data the app already had a few hundred ms earlier. Has its own
loading/error state independent of the parent (`loading`/`error` local state,
`DataLoadState`), and a **client-side duplicate-phone check is delegated to the backend**
(`ConflictException` in `RidersService.updateProfile`).

### `documents.tsx`
Also independently re-fetches `GET /riders/me` (`documents.tsx:359-369`) instead of reusing
`useRiderOperations().me`. Same redundant-fetch pattern as `edit.tsx`. Has its own
loading/error/refresh (pull-to-refresh) state, and per-document upload state
(`uploadingType`) that is independent of the parent context's `refreshing` flag.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load profile (tab, edit, documents) | GET | `/riders/me` | `RiderMe` | `RidersController.getMe` → `RidersService.getMe` |
| Save profile edits | PATCH | `/riders/me` | body: partial `RiderMe` fields | `RidersController.updateMe` → `RidersService.updateProfile` |
| Upload avatar | POST (multipart) | `/riders/me/avatar` | `RiderMe` | `RidersController.uploadAvatar` → `RidersService.uploadAvatar` |
| Upload KYC document | POST (multipart) | `/riders/me/documents/:type` | `RiderMe` | `RidersController.uploadDocument` → `RidersService.uploadDocument` |
| Fetch document/task image | GET | `/uploads/rider-documents/:filename` | n/a (blob, via `AuthenticatedImage`) | `MediaController.getRiderDocument` → `MediaService.assertAccess` |

`riderFetch`/`apiFetch` (`src/store/auth.ts:11-42`) unwrap the `{ success, data }` envelope
returned by every rider endpoint, so the frontend `RiderMe` type correctly describes the
unwrapped `data` payload.

## Backend trace
`RidersService.getMe` (`riders.service.ts:224-240`) loads/creates the rider doc
(`findOrCreate`), the linked `User` (`email`, `phone` only, via `.select`), the
`UserProfile` (`avatarUrl` only), and — only for a platform-pooled, non-employee rider —
the platform's flat per-leg fee amounts from settings. It calls
`serializeMePayload` to shape the response, which also runs `isRiderCompliant` to derive
`compliance` (profile/document gaps, approved count, verification status) inline, and
`serializeRiderDocuments` (`rider-compliance.ts:152-168`) to always return one entry per
`RIDER_DOCUMENT_TYPES` (so a never-uploaded doc still renders as `status: undefined` →
"missing" client-side) rather than only the documents that exist.

`updateProfile` (`riders.service.ts:612-656`) patches only the fields present in the DTO
(partial update pattern), trims strings, and — for phone changes — checks for a
phone collision against other users before applying it, throwing `ConflictException` on
collision. `uploadAvatar`/`uploadDocument` store the file via `LocalStorageService`
(memory-buffered multer upload, validated by `ALLOWED_IMAGE_TYPES` mimetype allowlist and
a size limit set per-endpoint in the controller: avatar 5MB, KYC doc 5MB) and best-effort
delete the previous file afterward (wrapped in `.catch(() => {})` so a delete failure never
fails the request).

No N+1s or obvious inefficiencies — `getMe` is a small, fixed number of point reads keyed
by `userId`.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| `ComplianceBanner` | `compliance.isCompliant`, `compliance.profileGaps`, `compliance.documentGaps`, `compliance.approvedDocumentCount` | `totalDocs` was hardcoded `4`; now derived from `RIDER_DOCUMENT_TYPES.length` (fixed, see Findings). |
| `LocationPermissionBanner` | `locationDenied` (context-derived, not from `RiderMe`) | Not part of this payload; from device permission state. |
| Profile hero (avatar, name, contact, status) | `authUser?.email` / `me.user.email`, `me.user.phone`, `name` (context-derived), `me.avatarUrl`, `shiftStatus` | `Avatar` derives initials client-side from `name`. |
| Earnings row | `me.todayEarnings`, `me.totalEarnings` | Formatted client-side via `formatCurrency`. |
| "Edit profile" row | none beyond nav | Static hint text. |
| "Documents" row | `compliance.isCompliant`, `compliance.approvedDocumentCount` | Hint text hardcoded "of 4 documents approved"; now uses `RIDER_DOCUMENT_TYPES.length` (fixed). |
| "Vehicle info" row | `me.vehicleType`, `me.plateNumber` | Static fallback `'Motorcycle'` if `vehicleType` missing. |
| Activity section rows | `me.partnerId` (branches "Wallet & withdrawals" vs "Pay & payouts") | Static icon/link list, not data-driven beyond the partner-id branch. |
| "Notifications" row | `unreadCount` (context, from `/riders/notifications`, not `RiderMe`) | n/a to this module's fetch. |
| `edit.tsx` — Rider Information | `data.firstName`/`data.user?.firstName`, `lastName` similarly, `data.user?.email` (read-only field), `data.user?.phone` | Email field is locked/read-only client-side (`editable={false}`) — matches that `updateProfile` never accepts an email field in its DTO. |
| `edit.tsx` — Home Address | `data.homeAddress.{line1,line2,city,province,postalCode,lat,lng}` | "Use current location" reverse-geocodes client-side via `expo-location` + `reverseGeocodeAddress`, only overwriting fields the geocoder actually returned. |
| `edit.tsx` — Vehicle Information | `data.vehicleType`, `data.plateNumber`, `data.orCrNumber` | `VEHICLE_ICONS` is a client-side icon map keyed by vehicle type string — must stay in sync with `VEHICLE_TYPES`; falls back to a generic car icon for unknown types, so it degrades safely rather than breaking. |
| `documents.tsx` — `ProgressBar` | `compliance.approvedDocumentCount`, `RIDER_DOCUMENT_TYPES.length` | Percent computed client-side; already correctly used `RIDER_DOCUMENT_TYPES.length`, unlike the other two hardcoded spots. |
| `documents.tsx` — `DocCard` (×4) | `doc.status`, `doc.fileUrl`, `doc.rejectionReason` | `STATUS_CONFIG`/`DOC_ICONS` are client-side maps keyed by status/type — must stay in sync with backend's `RiderDocumentStatus`/`RiderDocumentType` unions. Image preview goes through `AuthenticatedImage`, which authenticates the download with the bearer token for any path under `/uploads/rider-documents/`. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save profile (`edit.tsx` `saveProfile`) | no | n/a | yes — `saving` disables the button while in flight | yes — `error` state renders an inline banner; `Alert` on success, `router.back()` only on success |
| Upload avatar (`profile.tsx` `handleAvatarPress`) | no (replaces previous, old file deleted server-side) | no confirmation, but low-risk/reversible | yes — `avatarUploading` disables the avatar `Pressable` | yes — `Alert.alert('Upload failed', ...)`; state resets in `finally` |
| Upload/replace KYC document (`documents.tsx` `uploadDocument`) | no (previous doc superseded, not silently discarded — old file best-effort deleted only *after* the new one is saved) | yes — source picker (camera/library) itself acts as an intentional step, and replacing an already-approved doc resets it to `pending` (expected verification behavior, not flagged as an issue) | yes — `uploadingType` disables just that card's button, keyed per document type | yes — `Alert.alert('Upload failed', ...)`; `finally` clears `uploadingType` regardless of outcome |

No delete/deactivate actions exist on this module (sign-out is a session action, not a
destructive data mutation, and is unconfirmed — consistent with how most mobile apps treat
sign-out as reversible via re-login).

## Authorization
All five endpoints in this module (`GET/PATCH /riders/me`, `POST /riders/me/avatar`,
`POST /riders/me/documents/:type`, `GET /uploads/rider-documents/:filename`) are guarded by
`JwtAuthGuard` + `RolesGuard` and `@Roles(UserRole.RIDER)` (controller-level guard,
route-level role decorator) except the media route, which is JWT-only and instead scopes
access via `MediaService.assertAccess('rider-documents', filename, req.user)` — i.e.,
filename alone isn't sufficient, the service checks the requesting user owns the document.
Every service method keys off `req.user.sub` (the JWT subject) rather than any
client-supplied id, so there's no param a rider could widen to read/edit another rider's
profile or documents. No cross-role widening found — `[authz]` clean.

## Findings

1. **PII/internal-data over-exposure**: `serializeRiderDocuments` sent `reviewedBy` (the
   admin `User` ObjectId who reviewed a KYC document) to the rider client on every
   `GET /riders/me` call, for all 4 KYC documents. The rider frontend never rendered it
   (confirmed via grep — the field only appeared in the `RiderKycDocument` type
   declaration, never read anywhere in `documents.tsx`/`profile.tsx`/`edit.tsx`). An
   unused, internal admin-identifying field being shipped to every rider on every profile
   load is a real (if low-severity) over-exposure — it leaks which internal admin account
   reviewed a document to a party that has no legitimate need to know.
   **Fix:** removed `reviewedBy` from the object returned by `serializeRiderDocuments`
   (`apps/api/src/modules/riders/rider-compliance.ts:152-167`) and from the frontend
   `RiderKycDocument` type (`apps/rider-mobile/src/lib/rider-types.ts:97-104`). This
   function is only used by the rider-facing `RidersService.getMe` (confirmed via grep —
   no admin-facing serializer shares it), so no other consumer is affected.

2. Magic number `4` (total KYC document count) was hardcoded independently in two places
   — `ComplianceBanner`'s `totalDocs = 4` (`src/components/compliance-banner.tsx:15`) and
   the "Documents" row hint text `` `${approvedDocs} of 4 documents approved` ``
   (`app/(tabs)/profile.tsx:318`) — while `documents.tsx`'s own `ProgressBar` already
   correctly derived the same number from `RIDER_DOCUMENT_TYPES.length`. Any future
   addition/removal of a required KYC document type would silently desync these two
   spots from the real requirement.
   **Fix:** both now import `RIDER_DOCUMENT_TYPES` and use `RIDER_DOCUMENT_TYPES.length`
   (`apps/rider-mobile/src/components/compliance-banner.tsx:1,15`,
   `apps/rider-mobile/app/(tabs)/profile.tsx:13,318`), matching `documents.tsx`'s existing
   pattern.

3. Redundant re-fetch: both `profile/edit.tsx` (`load()`, line 205) and `documents.tsx`
   (`load()`, line 359) independently call `GET /riders/me` on mount instead of seeding
   from the `me` object `useRiderOperations()` already holds (the same context the parent
   tab and `ComplianceBanner` read from). This costs one extra round-trip per navigation
   into either sub-page, and briefly shows the sub-page's own loading spinner even though
   the data was already in memory a moment earlier.
   **Left unfixed** — out of scope as a "fix now": reusing the context's `me` would still
   need to handle the case where it's stale or not yet loaded (e.g. deep-linking directly
   into `/profile/edit`), which is a small design decision (loading-state fallback logic)
   rather than a pure bug fix, and both pages already have correct independent
   loading/error handling as a fallback. Flagging for a follow-up rather than fixing
   opportunistically here.

4. Two dead fields in the `RiderMe` payload: `fixedWageAmount` and `wageFrequency` are set
   by `serializeMePayload` (`riders.service.ts:197-198`) on every `GET /riders/me`
   response but aren't declared in the frontend `RiderMe` type at all (so they're silently
   dropped/ignored by TypeScript, not read anywhere in this module). Not sensitive (it's
   the rider's own wage config, not another user's data), just wasted payload.
   **Left unfixed** — likely intentional payload for a different screen (employment/wage
   settings) not in scope for this audit; removing them risks breaking a consumer not
   traced here. Flagging as dead-weight-if-truly-unused rather than removing blind.

## Unused/dead fields
- `RiderKycDocument.reviewedBy` — unused and sensitive; see Finding 1 (fixed, removed).
- `RiderMe.fixedWageAmount`, `RiderMe.wageFrequency` — sent by the backend, not in the
  frontend type, not read by this module; see Finding 4 (left unfixed, likely used
  elsewhere).
- `RiderMe.riderId`, `RiderMe.shopLocation` — present in the payload and the frontend
  type but not read anywhere in `profile.tsx`/`edit.tsx`/`documents.tsx`. Not flagged as a
  finding: neither is sensitive (an internal-only Mongo id and a fixed shop address used
  elsewhere in the app, e.g. pickup/delivery navigation), and both are plausibly consumed
  by other screens sharing the same `RiderMe` fetch — out of scope to chase down here.

## Loading/error/realtime behavior
- `profile.tsx` has no local loading state of its own — it renders whatever
  `useRiderOperations()` currently holds and relies on pull-to-refresh
  (`RefreshControl` wired to `refreshing`/`onRefresh` from context) for manual refresh.
  There's no visible skeleton for the very first load before `me` populates; fields fall
  back to `'—'`/defaults (e.g. `phone ?? '—'`), which reads acceptably rather than
  breaking.
- `edit.tsx` and `documents.tsx` each have their own `loading`/`error` local state backed
  by the shared `DataLoadState` component (`src/components/data-load-state.tsx`), so both
  show a loading message on initial fetch and a retry affordance
  (`onRetry={load}`) on error — consistent with the pattern used elsewhere in the app.
  `documents.tsx` additionally supports pull-to-refresh.
  A failed refresh does not wipe previously-shown data in either page — `error` is only
  used to gate the *initial* load screen (`error && !firstName` for edit, plain `error`
  for documents-first-load); once data has loaded once, subsequent fetch calls only run
  through `saveProfile`/`uploadDocument`, which use `Alert.alert` for failures and leave
  the previously-rendered data in place.
- No sockets or polling on this module; refresh is manual (pull-to-refresh) or triggered
  after a successful mutation (`refresh()` from context after avatar/profile/document
  changes, so the tab's `me` stays in sync with what the sub-page just wrote).
