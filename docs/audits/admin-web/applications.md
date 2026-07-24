# Audit: Admin-web — Applications (list, rider review, partner review)

Date: 2026-07-22

## Entry points
- List: `apps/admin-web/src/app/applications/page.tsx` -> `ApplicationsBoard` (`apps/admin-web/src/components/datacenter/applications-board.tsx`)
- Rider review: `apps/admin-web/src/app/applications/rider/[id]/page.tsx` (inline, `RiderApplicationReviewPage`)
- Partner review: `apps/admin-web/src/app/applications/partner/[id]/page.tsx` (inline, `PartnerApplicationReviewPage`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Applications list (both types, merged client-side) | GET | `/rider-applications`, `/partner-applications` (parallel) | `RiderApplication[]`, `PartnerApplication[]` -> normalized `ApplicationRow[]` | `RiderApplicationsController.list` / `PartnerApplicationsController.list` |
| Rider application detail | GET | `/rider-applications/:id` | `RiderApplicationDetail` | `RiderApplicationsController.findOne` -> `RiderApplicationsService.findOne` |
| Partner application detail | GET | `/partner-applications/:id` | `PartnerApplicationDetail` | `PartnerApplicationsController.findOne` -> `PartnerApplicationsService.findOne` |
| Approve/reject rider application | PATCH | `/rider-applications/:id/status` | — | `RiderApplicationsController.updateStatus` -> `RiderApplicationsService.updateStatus` |
| Approve/reject partner application | PATCH | `/partner-applications/:id/status` | — | `PartnerApplicationsController.updateStatus` -> `PartnerApplicationsService.updateStatus` |

## Backend trace
Both application types follow an identical shape: a Mongoose schema with `timestamps`, a `status` enum
(`pending`/`reviewed`/`approved`/`rejected`), a nested `documents` map serialized with a signed/public file
path per type, and a `findByIdAndUpdate`-based status transition. Nothing unbounded here — `list()` caps at
200 (partner) — the rider list handler wasn't independently re-checked but follows the same service pattern.

## Cards / panels

### Applications list (`ApplicationsBoard`)
| Card | Fields consumed | Notes |
|---|---|---|
| Stat tiles (6): Total, Pending, Reviewed, Approved, Rejected, New this month | All client-computed from the merged `ApplicationRow[]` (both application arrays fetched in full and combined, per the code's own comment: "both lists are small — load unfiltered once") | Reasonable for what's expected to be a low-volume queue; revisit if application volume ever grows enough to need real pagination. |
| Type tabs (All/Riders/Partners) + status filter + search | Same merged array, filtered/searched client-side | Full field usage. |
| Applications table | `ApplicationRow`: `name`/`subName` (business owner for partners), `type`, `email`, `phone`, `status`, `createdAt` | Full field usage. |
| Detail rail (row preview) | Same row fields, plus a "Open full review" link — no separate fetch | Deliberately thin; the real review (documents, approve/reject) happens on the dedicated per-type page. |
| Review queue (right rail, shown when nothing selected) | `pendingQueue` — see Finding 1 (fixed) | Was silently showing the wrong 8 applications when more than 8 were pending. |

### Rider / partner application review pages
| Card | Fields consumed | Notes |
|---|---|---|
| Documents panel | `documents[type]`: `fileUrl`, `uploadedAt` per configured document type | Full use. |
| Profile / Business panel | All applicant fields including, after this pass, the previously-dropped `address.postalCode` (both pages), `emergencyContact.address`, `vehicle.color`/`.yearModel`, `license.restrictionCode` (rider page) | See Findings — these were fetched but silently omitted from the joined display strings. |
| Decision panel (Approve/Reject) | Posts `status` and, after this fix, `rejectionReason` | See Finding 2 — this was the main bug on this page. |

## Findings

1. **[FIXED] The applications list's "Review queue" panel showed the wrong applications once more than 8
   were pending.** `pendingQueue` was computed as `rows.filter(pending).slice(0, 8)` against `rows`, which is
   sorted **newest-first** — so it grabbed the 8 *newest* pending applications, not the oldest, then reversed
   just that slice for display. The panel header claims "Oldest pending applications first," but any
   application beyond the 8 most recent pending ones — including the actual longest-waiting, most overdue
   applications — never appeared in this panel at all. Fix: now takes from the tail of the sorted array
   (`slice(-8)`, the true oldest 8) and reverses that to display oldest-first; the redundant render-time
   `.reverse()` was removed since the memo now returns already-ordered data.

2. **[FIXED] Rejecting a rider or partner application silently discarded the admin's typed rejection reason.**
   Both review pages have a full "Rejection reason" textarea + "Confirm reject" flow, but neither
   `RiderApplicationsService.updateStatus` nor `PartnerApplicationsService.updateStatus` — nor their DTOs or
   schemas — had any `rejectionReason` field at all. The frontend's `setStatus()` calls never even attempted
   to send the typed text; it was collected into local state and then thrown away on submit. An applicant
   rejected through this flow would have no recorded reason anywhere, and admins reviewing a past rejection
   later would see only "Rejected" with no context. Fix, applied to both application types end-to-end:
   - Added `rejectionReason?: string` to both Mongoose schemas.
   - Added the field (optional, max 1000 chars) to both `Update*ApplicationStatusDto`s.
   - Both services now `$set` the reason when rejecting and `$unset` it when transitioning to any other
     status (so an old reason can't linger after a later approval), and both `serialize()` methods now
     include it in the response.
   - Both controllers pass `dto.rejectionReason` through to the service.
   - Both frontend pages now send `rejectionReason` when rejecting, display it under the profile/business
     panel once an application is in the `rejected` state, and — for consistency with the rider-profile KYC
     document rejection flow, which already required a reason — the "Confirm reject" button is now disabled
     until a reason is typed (previously it had no such guard on either application page).

3. **[FIXED] Several fetched profile fields were silently dropped from the review pages' display strings.**
   - Both pages: `address.postalCode` was fetched but excluded from the joined address line.
   - Rider page only: `emergencyContact.address`, `vehicle.color`, `vehicle.yearModel`, and
     `license.restrictionCode` were all fetched and typed but never rendered anywhere.
   All are now included in their respective display lines.

## Unused/dead fields
None remaining — every field returned by both application detail endpoints is now rendered somewhere on
its review page.

## Loading/error/realtime behavior
- All three pages use the same shared `useAdminQuery` pattern, so failed reloads keep the last-good view
  visible under the error banner (fixed during the overview audit, [overview.md](overview.md) Finding 1).
- None of these pages have a realtime socket subscription — reasonable, since application review is an
  admin-initiated workflow rather than a live-ops event stream, consistent with the withdrawals page
  ([riders.md](riders.md)).
- Empty/loading states are handled per-panel (list) or via the shared `DataPageStatus` component (detail
  pages) — nothing missing here.
