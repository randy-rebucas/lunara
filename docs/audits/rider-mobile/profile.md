# Audit: Rider-mobile — Profile tab (+ Edit profile sub-page)

Date: 2026-07-24

## Entry point
- Page: `apps/rider-mobile/app/(tabs)/profile.tsx`
- Component(s): inline `Avatar`, `MenuRow`, `MenuSection` — no page-local fetch, purely reads the shared `RiderOperationsContext` (`me`, `name`, `shiftStatus`, `unreadCount`, `locationDenied`) already audited in [home.md](home.md).

## Sub-pages

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `app/profile/edit.tsx` | "Edit profile" row (`profile.tsx:230`) and "Vehicle info" row (`profile.tsx:252`) — both navigate to the same route | none (edits the caller's own profile via JWT identity) | yes, see below |
| `app/documents.tsx` | "Documents" row (`profile.tsx:243`) | none | out of scope — a full upload/verification feature (4 document types, camera capture, status per doc), not a thin detail view; warrants its own audit doc, not traced here |
| `app/performance.tsx` | "Performance" row (`profile.tsx:275`) | none | out of scope — separate feature (ratings/completion stats), not traced here |
| `app/earnings.tsx` | "Earnings history" row (`profile.tsx:284`) | none | out of scope — already noted as a separate deep feature in [home.md](home.md) |
| `app/wallet.tsx` | "Wallet & withdrawals" row (`profile.tsx:293`) | none | out of scope — separate feature (balance, payout, remittance) |
| `app/notifications.tsx` | "Notifications" row (`profile.tsx:306`) | none | out of scope — separate feature |
| `app/support.tsx` | "Help & support" row (`profile.tsx:315`) | none | out of scope — separate feature |
| `(tabs)/tasks?filter=completed` | "Task history" row (`profile.tsx:264-266`) | `filter=completed` query param | yes — matches the `filterParam` handling already audited in [tasks.md](tasks.md); this row is just a deep-link into that same screen, not a new one |

**Edit profile (`profile/edit.tsx`)**: fetches its own copy of the rider profile via `GET /riders/me` on mount (`profile/edit.tsx:200-221`) rather than seeding its form from the `me` object the Profile tab already had in the shared context — a redundant round trip for data the caller already displayed a second ago. See Findings #1. It has its own independent loading/error/saving state, entirely separate from the shared context's `refreshing`.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Profile tab (no local fetch) | — | — | reads shared `RiderMe` from context | see [home.md](home.md) `GET /riders/me` |
| Edit profile — load | GET | `/riders/me` | `RiderMe` | `RidersController.getMe` → `RidersService.getMe` (same handler as home/context) |
| Edit profile — save | PATCH | `/riders/me` | inline body (firstName/lastName/phone/homeAddress/vehicleType/plateNumber/orCrNumber) | `RidersController.updateMe` → `RidersService.updateProfile` |

## Backend trace
`RidersService.updateProfile` (`riders.service.ts:547-589`): loads the rider doc and user doc by `userId` (from JWT, not a param), applies each provided field only if `!== undefined` (safe partial update, no accidental blanking of untouched fields), and for phone changes checks uniqueness (`userModel.findOne({phone, _id:{$ne:user._id}})`) before writing, throwing `ConflictException` on collision. Returns `this.getMe(userId)` so the response is always the freshly recomputed `RiderMe` (compliance gaps included) — the frontend's `refresh()` call after save (`profile/edit.tsx:257`) is technically redundant with what the PATCH response already contains, but harmless since it re-syncs the same context used across every tab.

One naming subtlety worth recording: the `firstName`/`lastName` shown everywhere in the app as `me.user.firstName`/`lastName` (home greeting, profile hero) are **not** the platform `User` document's name fields — `serializeMePayload` (`riders.service.ts:169-213`) computes `displayFirstName`/`displayLastName` from `rider.firstName`/`rider.lastName` (falling back to the email prefix), and nests them under the `user` key purely for frontend shape convenience. `updateProfile` correctly writes to `rider.firstName`/`lastName`, so this resolves consistently — flagged here only because the naming (`me.user.firstName` looking like it reads the `Users` collection) is a likely source of confusion for a future change, not because anything is currently broken.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Compliance banner + location banner | `compliance`, `locationDenied` | reused verbatim from home (see [home.md](home.md)) |
| Profile hero (avatar, name, contact, status) | `name` (context-derived), `email` (`authUser.email ?? me.user.email`), `phone` (`me.user.phone`), `shiftStatus` | `email` prefers the auth-store's email over the rider payload's — reasonable, since auth identity is the source of truth and `me.user.email` is only a fallback for a slow-loading `me` |
| Earnings summary (2 tiles) | `me.todayEarnings`, `me.totalEarnings` | same two fields shown again in the home dashboard's grid — duplication across screens is fine (same source of truth, no drift risk since both read the same `me` object) |
| Account section | `compliance.isCompliant`, `approvedDocs` (`compliance.approvedDocumentCount ?? 0`), `vehicleType` (fallback `'Motorcycle'`), `plateNumber` (fallback `'—'`) | hardcoded `'4'` in the "X of 4 documents approved" hint (`profile.tsx:241`) duplicates the document-count magic number that also lives in `RIDER_DOCUMENT_TYPES` (backend, 4 entries) — if a 5th document type is ever added, this hint silently becomes wrong without a compile-time link between the two. Minor, noting rather than fixing since introducing a shared constant across app/api boundaries is beyond this audit's scope. |
| Activity section | none beyond navigation | — |
| More section | `unreadCount` (badge) | reused verbatim from home context |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save profile (`profile/edit.tsx`) | no | n/a | yes — button disabled while `saving` (`profile/edit.tsx:438`) | yes — inline error banner + `setError`, doesn't clear on retry until resubmitted |
| Sign out (`handleLogout`) | soft-destructive (ends session; if on shift, silently goes offline first) | no confirmation dialog | no explicit guard, but logout + navigation is a coarse one-shot action, low risk of a meaningful double-fire | partially — `handleLogout` (`rider-operations.tsx:351-357`) swallows any `goOffline()` failure (`.catch(() => {})`) before logging out; if going offline fails, the rider is logged out from the app while the backend may still show them online/on-shift, with no error shown. This is the same silent-failure family already flagged for `goOffline` itself in [home.md](home.md) Findings #5 — one more caller hitting the same gap. |

## Authorization
Both `GET`/`PATCH /riders/me` resolve identity from `req.user.sub` (JWT), never a client param — no cross-rider access surface. Phone-uniqueness check on update queries across all users (`_id: {$ne: user._id}`), which is correct and necessary (phone likely doubles as a login/lookup key elsewhere) — no over-broad exposure since it only returns a boolean-shaped conflict, not the other user's data.

## Findings

1. **Redundant re-fetch on Edit Profile.** `profile/edit.tsx` fetches `GET /riders/me` fresh on mount (`profile/edit.tsx:200-221`) even though the Profile tab it was just launched from already has an up-to-date `me` object in the shared `RiderOperationsContext`. This means every time a rider taps "Edit profile" or "Vehicle info", there's a guaranteed network round trip (with a full-screen loading spinner, `DataLoadState`) before they see their own already-known data. Left unfixed: seeding the form from `useRiderOperations().me` immediately and only falling back to a fetch if `me` is null would remove the round trip and the loading flash, but this is a UX/perf call (does staleness matter enough here to skip a fresh fetch on an edit form?) rather than a correctness bug — flagging for a product decision rather than changing fetch behavior unilaterally on a form whose whole point is accurate current data.

2. **`handleLogout` swallows `goOffline` failures silently.** Same root cause as [home.md](home.md) Findings #5 (`goOffline`/`startBreak`/`endBreak` have no user-facing error path) — here it's additionally wrapped in an explicit `.catch(() => {})` (`rider-operations.tsx:353`), so a rider who signs out while on shift and offline momentarily gets logged out of the app with no indication that the backend might still consider them online. Not re-fixed here since the underlying fix belongs with the Findings #5 entry in home.md (touching the same function) — noting this second call site so a future fix covers both.

## Unused/dead fields
None found specific to this module — the Profile tab and Edit-profile sub-page consume all fields of `RiderMe` that are relevant to their surfaces (documents/employment/wage fields are intentionally left to their own dedicated screens — `documents.tsx`, not audited here).

## Loading/error/realtime behavior
The Profile tab itself has no independent loading state — like [profile.md]'s parent context in home.md, it renders whatever the shared context currently holds and relies on pull-to-refresh (`onRefresh`) for a manual resync; no realtime/socket-driven update specific to this screen beyond what the shared dispatch socket already provides (compliance/earnings changes propagate via the same `refresh()` used everywhere). `profile/edit.tsx` has its own independent loading/error state (`loading`, `error`, `DataLoadState`) that is not shared with any other screen, and correctly distinguishes "still loading" from "failed to load" (`error && !firstName` gate, `profile/edit.tsx:275`) rather than conflating them.
