# Audit: Rider-mobile — Documents (KYC upload/verification)

Date: 2026-07-24

## Entry point
- Page: `apps/rider-mobile/app/documents.tsx`
- Component(s): inline `ProgressBar`, `DocCard` — no sub-components in other files.

## Sub-pages
None — no outbound navigation into a detail route. This screen is itself the sub-page linked from `(tabs)/profile.tsx`'s "Documents" row (see [profile.md](profile.md) Sub-pages table), and is deep enough (per-document upload/status/rejection flow across 4 document types) to warrant its own doc rather than being folded into profile.md, per the audit scope rule.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load documents | GET | `/riders/me` | `RiderMe` | `RidersController.getMe` → `RidersService.getMe` (same handler as home/profile) |
| Upload document | POST (multipart) | `/riders/me/documents/:type` | returns `RiderMe` | `RidersController.uploadDocument` → `RidersService.uploadDocument` |

This screen fetches its own `RiderMe` copy via `GET /riders/me` (`documents.tsx:359-369`) rather than reading the shared `RiderOperationsContext`'s `me` — the same redundant-refetch pattern already flagged for `profile/edit.tsx` in [profile.md](profile.md) Findings #1. Here it's more defensible: the screen needs the freshest `documents[]`/`compliance` state right as the rider is about to act on rejection reasons or upload status, so showing stale cached data would be a worse trade-off than on a plain edit form. Noting the pattern for cross-reference, not re-flagging as a new finding.

## Backend trace
`RidersService.uploadDocument` (`riders.service.ts:602-628`): validates the document `type` against a fixed list, loads the rider (`findOrCreate` by JWT `userId`), replaces any existing document of that `type` in the `documents[]` array with a new entry (`status: 'pending'`, fresh `uploadedAt`, clearing any prior `reviewedAt`/`reviewedBy`/`rejectionReason`), saves, then best-effort deletes the previous file from Cloudinary. Returns the recomputed `RiderMe` via `getMe(userId)`, so `compliance.approvedDocumentCount`/`documentGaps`/`verificationStatus` are always in sync with the just-completed upload. Controller-level upload handling (`riders.controller.ts:242-265`) validates the type again, requires a file, uploads it to Cloudinary (`lunara/rider-documents`, private), then calls the service with the resulting `public_id`.

Multer's `FileInterceptor` + `riderDocumentUploadOptions` presumably enforce file-size/type limits at the framework level (not re-verified in this pass — out of scope for a data-flow audit, but worth a quick check in a security-focused pass since this accepts arbitrary rider-uploaded images).

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Progress bar | `me.compliance.approvedDocumentCount`, `RIDER_DOCUMENT_TYPES.length` (frontend constant, currently `4`) | see Findings #1 — the "4" comes from a frontend-local array duplicated from the backend's own list, not a computed/fetched total |
| Document card (×4, one per `RIDER_DOCUMENT_TYPES` entry) | `doc.status`, `doc.fileUrl`, `doc.rejectionReason` | status pill/upload-button copy derived entirely client-side from `resolveStatus()`; rejection reason only shown when `status === 'rejected'` and present — correct guard, no dangling banner for docs that were never rejected |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Upload/replace document | soft-destructive (replaces the existing file and resets status to `pending`, discarding any prior `approved`/`rejected` review) | no confirmation before replacing an already-approved document — a rider could accidentally tap "Replace document" on an approved doc and silently lose their approved status, needing re-review | yes — button disabled while `uploadingType === type` (`documents.tsx:218,222`), and `pickUploadSource` only fires once per tap via the `Alert` action sheet | yes — `Alert.alert('Upload failed', ...)` on error (`documents.tsx:402`); see Findings #2 for a server-side false-failure this masked until now |

## Authorization
`GET /riders/me` and `POST /riders/me/documents/:type` both resolve identity from `req.user.sub` (JWT) — no rider can upload or view another rider's documents by manipulating a request param. `isValidRiderDocumentType` guards against arbitrary `type` values reaching the documents array (validated both in the controller and again in the service).

## Findings

1. **Duplicated `RIDER_DOCUMENT_TYPES`/`RIDER_DOCUMENT_LABELS` list across frontend and backend.** The exact same 4-entry array (`drivers_license`, `or_cr`, `nbi_clearance`, `selfie`) and label map is independently hand-maintained in `apps/api/src/modules/riders/rider-compliance.ts:3-16` and `apps/rider-mobile/src/lib/rider-types.ts:79-93`, despite a shared `@lunara/types` package already existing in the monorepo (used elsewhere for `OrderStatus`, etc.) that could hold a single source of truth. If a document type is ever added, removed, or renamed on the backend without updating this frontend copy (or vice versa), the progress bar's "X of 4" math, the document-type validation, and the actual set of upload buttons shown would silently drift out of sync — a rider could see "0 of 5 approved" required by the backend while the app only offers 4 upload buttons, permanently blocking them from going online. Left unfixed: moving this into `@lunara/types` is a cross-package refactor (touching a built/versioned package, `packages/types/dist`, and every consumer) that's a coordinated change beyond a single-module audit's scope — flagging for a dedicated pass rather than doing a package-boundary refactor unilaterally.

2. **Cleanup-delete failure could mask a successful upload as failed — `[fixed]`.** `RidersService.uploadDocument` (`riders.service.ts:602-628`, pre-fix) awaited `cloudinaryStorageService.deleteFile(...)` for the superseded file *after* already saving the new document — if that delete threw (e.g. a transient Cloudinary error, or the old file already gone), the exception propagated up through the controller, and the rider would see `Alert.alert('Upload failed', ...)` (`documents.tsx:402`) even though their new document was already saved and is now the active one. On the next screen load, they'd see it correctly present as `pending` despite having been told the upload failed — confusing, and it could prompt an unnecessary re-upload attempt.
   **Fix:** wrapped the cleanup delete in `.catch(() => {})` since it's best-effort housekeeping, not part of the operation's success criteria — `apps/api/src/modules/riders/riders.service.ts:610-616`. No other caller of `uploadDocument` exists in the codebase, so no regression surface beyond this one path.

3. **No confirmation before replacing an approved document.** Tapping "Replace document" on a card already showing `Approved` (`documents.tsx:236`, label only changes to "Replace document" once `doc.fileUrl` is set — it doesn't distinguish "replace a pending/rejected doc" from "replace an approved one") immediately opens the camera/library picker and, on completion, overwrites the approved document and resets it to `pending` with no undo. A misplaced tap on an already-verified document could cost the rider their approval status and force a wait for re-review. Left unfixed: this needs a UX decision (should approved documents require an extra confirmation step, or be locked behind an explicit "this will require re-review" warning?) rather than a code-only fix.

## Unused/dead fields
None found — every field on `RiderKycDocument` (`type`, `fileUrl`, `status`, `rejectionReason`) is read by `DocCard`; `uploadedAt`/`reviewedAt`/`reviewedBy` are returned by the backend but not rendered here, which is reasonable since this is a self-service upload screen, not an admin review view (an admin-web audit would be the place to check those are surfaced somewhere).

## Loading/error/realtime behavior
Independent `loading`/`error`/`refreshing` state (`documents.tsx:353-356`), correctly distinguishing initial load from pull-to-refresh, and showing a retry-capable error state (`DataLoadState`, `onRetry={load}`) rather than silently defaulting to empty — better than the silent-catch pattern flagged elsewhere in this app (home.md, tasks.md). No realtime/socket subscription on this screen; a document being approved/rejected by an admin while the rider has this screen open would only be reflected after a manual pull-to-refresh or re-navigation, not automatically — acceptable for a review-status screen that isn't expected to update sub-second, but worth knowing if riders report "my approval doesn't show up" support tickets that are actually just a stale screen.
