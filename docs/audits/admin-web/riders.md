# Audit: Admin-web — Riders (fleet board, withdrawals, rider profile)

Date: 2026-07-22 (address fields wired up, Rider ID wired up, `remittedAt` removed 2026-07-22)

## Entry points
- Fleet board: `apps/admin-web/src/app/riders/page.tsx` -> `RidersBoard` (`apps/admin-web/src/components/datacenter/riders-board.tsx`)
- Withdrawals: `apps/admin-web/src/app/riders/withdrawals/page.tsx` -> `WithdrawalsBoard` (`apps/admin-web/src/components/datacenter/withdrawals-board.tsx`)
- Rider profile: `apps/admin-web/src/app/riders/[userId]/page.tsx` (`RiderProfileReviewPage`, inline — no separate board component)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Fleet roster + manual "Sync" + socket reload | GET | `/admin/riders` | `RiderRow[]` | `AdminController.getRiders` -> `AdminService.getRiders` |
| Pending KYC documents (separate `useAdminQuery`) | GET | `/admin/riders/documents/pending` | `PendingDocumentRow[]` | `AdminController.getPendingRiderDocuments` -> `RidersService.listPendingDocumentReviews` |
| Invite rider | POST | `/admin/riders` | `RiderRow` | `AdminController.createRider` -> `AdminService.createRider` |
| Broadcast announcement | POST | `/admin/riders/announcement` | `{ sent: number }` | (riders announcement handler, not re-traced) |
| Withdrawals queue | GET | `/admin/riders/withdrawals` | `{ items: WithdrawalRow[]; counts: WithdrawalCounts }` | `AdminController` -> (withdrawals handler) |
| Approve/reject withdrawal | POST | `/admin/riders/withdrawals/:id/approve` \| `/reject` | — | (withdrawals handler) |
| Rider profile + KYC docs + compliance + wallet fields | GET | `/admin/riders/:userId/profile` | `RiderProfileData` | (rider profile handler) |
| Cash remittances (separate manual fetch, not `useAdminQuery`) | GET | `/admin/riders/:userId/cash-remittances` | `CashRemittance[]` | (remittances handler) |
| Document review, wallet hold, earnings credit, employment save, remittance verify | PATCH/POST | `/admin/riders/:userId/documents/:type`, `/wallet/hold`, `/earnings/credit`, `/employment`, `/cash-remittances/verify` | — | (rider profile handlers) |

## Backend trace
`AdminService.getRiders` does one `find()` over all riders plus a batched user lookup (email/phone/isActive),
then two aggregates (grouped by rider) for active delivery and pickup counts — reasonable, bounded by rider
count rather than order volume. `RidersService.listPendingDocumentReviews` and the withdrawals/profile
handlers weren't re-traced line-by-line here since the frontend field usage against them checked out cleanly
(see Cards/panels).

## Cards / panels

### Fleet board (`RidersBoard`)
| Card | Fields consumed | Notes |
|---|---|---|
| Fleet state banner | `online`, `pendingCount`, `activeTasks`, `fleet.length` (all client-derived from the two fetched arrays) | `deriveFleetState()` — "no riders online but tasks active" is treated as critical, distinct from the dispatch/control-tower pages' own state derivations but following the same nominal/attention/critical pattern. |
| Stat tiles (6): Fleet size, Online now, Active tasks, Pending KYC, Verified, Earnings today | All client-reduced over the fetched `RiderRow[]` (no server aggregate fields used here at all) | Consistent with the users page's stat-tile pattern — full dataset fetched once, all summary numbers computed in the browser. |
| Roster table | `RiderRow[]` (searched/tab-filtered/`limit`-sliced): `_id`, `firstName`/`lastName`/`email` (via `riderDisplayName`), `isOnline`, `isActive`, `vehicleType`, `verificationStatus`, `activeTasks`, `todayEarnings`, `totalEarnings` | Full field usage. |
| Rider detail rail | Same `RiderRow` fields, plus `selectedPendingDocs` (cross-referenced from the separate pending-documents query by `userId`) | No fetch of its own — reuses the two already-loaded lists. |
| Invite rider form | Posts a new rider; response mapped through the same `riderDisplayName()` helper used for the roster | Full use of the create response. |
| Pending document reviews panel | `PendingDocumentRow[]` (capped to first 8 shown): `userId`, `firstName`/`lastName`/`email` (via `riderDisplayName`), `document.type` | `document.fileUrl`/`.status`/`.uploadedAt` are typed but intentionally not used in this summary list — reviewing the actual document (image, approve/reject) happens on the rider profile page, which fetches its own richer document list; this list is just a "who needs review" pointer. Not a dead-field bug. |
| Broadcast announcement form | Posts title/body; reads back `{ sent }` for the confirmation message | Full use. |

### Withdrawals board (`WithdrawalsBoard`)
| Card | Fields consumed | Notes |
|---|---|---|
| Queue state banner + stat tiles (6) | `counts.pending/.pendingAmount/.paid/.paidAmount/.rejected/.total`, client-derived `largestPending` | Full use of every `WithdrawalCounts` field; `largestPending` is the only client-computed stat (max pending amount), not sent by the backend. |
| Payout queue table | `WithdrawalRow[]`: `riderName`, `amount`, `methodLabel`, `status`/`statusLabel`, `createdAt`, `processedAt`, and the masked payout fields (`gcashNumber`/`mayaNumber`/`bankName`/`bankAccountName`/`bankAccountNumber` via `maskPayoutDetails()`) | Full field usage — every payout-method field feeds the masked summary shown in both the table and detail rail. |
| Detail rail + approve/reject | `selected.adminNote`, `.status`, `.amount`, `.method`/`.methodLabel` | Full use; approve/reject go through a shared `NoteModal` for an optional admin note. |

### Rider profile (`RiderProfileReviewPage`)
| Card | Fields consumed | Notes |
|---|---|---|
| Compliance state banner | `compliance.isCompliant`, `.verificationStatus` | `deriveComplianceState()` — same three-state pattern as every other admin-web ops page. |
| Metric row | `todayEarnings`, `totalEarnings`, `shiftStatus`, `isOnline`, `isActive` | Full use. |
| KYC Documents panel | `documents[]`: `type`, `status`, `uploadedAt`, `reviewedAt`, `fileUrl`, `rejectionReason` | Full use, including inline approve/reject with a required rejection-reason textarea. |
| Profile panel | `user.email`/`.phone`, `vehicleType`, `plateNumber`, `orCrNumber`, `homeAddress.*` (now including `province`/`postalCode`, see Findings), `compliance.profileGaps[]`/`.documentGaps[]` | Full use after the fix below. |
| Employment panel | `employmentType`, `fixedWageAmount`, `wageFrequency` | Synced from the loaded profile exactly once (`employmentSynced` guard) so in-progress edits survive unrelated reloads — a deliberate, well-commented pattern worth calling out as a good practice other pages could reuse if they ever need editable fields alongside a live-reloading query. |
| Wallet operations panel | Writes only (`walletHold`, `creditAmount`, `creditType`, `creditNote`) plus reads `data.employmentType`/`.fixedWageAmount`/`.wageFrequency` to label the "wage" credit option | Full use. |
| Cash remittances panel | `CashRemittance[]` (fetched and held in local state, not via `useAdminQuery`): `orderId`, `stage`, `cashAmount`, `earningOffset`, `netRemittance`, `remittanceMode`, `submittedAt`, `transactionId`, `proofImageUrl`, `status` | See Unused/dead fields for `remittedAt`. This panel intentionally loads outside the page's main `useAdminQuery` (triggered from within the profile loader, plus its own reload after verify actions) since it has its own loading/error state independent of the profile fetch. |

## Findings

1. **[FIXED] Rider home address dropped `province` and `postalCode` even though both were fetched.**
   The Profile panel's address line only joined `line1`, `line2`, and `city`
   (`apps/admin-web/src/app/riders/[userId]/page.tsx`), silently omitting the province and postal code the
   backend already returns in `homeAddress`. Fix: both are now appended to the same comma-joined address
   string.

## Unused/dead fields (resolved 2026-07-22)
- `RiderProfileData.riderId` — **wired up**. Added a "Rider ID" row to the Profile panel with a copy button,
  matching the "User ID" copy-row pattern already used on the users page ([users.md](users.md)).
- `CashRemittance.remittedAt` — **removed**. Structurally could never have a value for any row that reaches
  the UI: `loadRemittances()` filters the fetched array down to `status !== 'remitted'` before storing it, so
  every row shown is by definition not-yet-remitted. Rather than wire up a column that would always render
  "—", the dead field was dropped from the frontend type.

## Loading/error/realtime behavior
- Fleet board: standard `useAdminQuery` + `useAdminOperationsSocket` pattern (only `onDispatchQueueUpdated`
  triggers a reload here, not `onDispatcherAlert` — reasonable, since dispatcher alerts are about in-flight
  orders, not fleet roster changes). Benefits from the shared reload-keeps-stale-data fix
  ([overview.md](overview.md) Finding 1). The pending-documents query is a second, independent
  `useAdminQuery` with its own error banner — a failure there doesn't block the roster from rendering.
- Withdrawals board: same shared-hook pattern, no realtime socket subscription — reasonable, since payout
  review is an admin-initiated workflow, not a live-ops event stream.
- Rider profile: the main profile fetch uses `useAdminQuery`, but cash remittances are loaded via manual
  `useState`/`useCallback` plumbing instead, with their own loading/error state and their own reload after
  verify actions. This is a deliberate, reasonable choice (remittances need to reload independently of the
  full profile refetch when only a verify action happened) rather than an inconsistency to fix.
- None of these three pages layer a polling interval on top of their live-ops socket subscription — fine,
  since fleet/roster/payout data doesn't change as continuously as the dispatch/live-tracking pages' order
  positions.
