# Audit: Admin-web — Rider withdrawals

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/riders/withdrawals/page.tsx` -> `WithdrawalsBoard` (`apps/admin-web/src/components/datacenter/withdrawals-board.tsx`)

## Sub-pages
None — no outbound navigation into a detail route. Links to `/riders` (fleet
board, already a sibling top-level page) only; the review action happens
in-page via `NoteModal`, not a route.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Withdrawal queue + counts | GET | `/admin/riders/withdrawals` | `{ items: WithdrawalRow[]; counts: WithdrawalCounts }` | `AdminController.listRiderWithdrawals` -> `RiderWalletService.listWithdrawalsForAdmin` |
| Approve | POST | `/admin/riders/withdrawals/:id/approve` | — | `AdminController.approveRiderWithdrawal` -> `RiderWalletService.approveWithdrawal` |
| Reject | POST | `/admin/riders/withdrawals/:id/reject` | — | `AdminController.rejectRiderWithdrawal` -> `RiderWalletService.rejectWithdrawal` |

## Backend trace
`listWithdrawalsForAdmin(status?)` accepts an optional single-status filter
(unused by the frontend, same as `refunds.md`) and caps `items` to the 100
most-recently-created withdrawals, while `counts` comes from a separate,
unbounded `$group` aggregate over every status — so, same as the Refunds board,
`items` is a truncated window but `counts` is always accurate platform-wide (see
Finding 1). `approveWithdrawal` re-checks the rider's actual withdrawable
balance at approval time (not just at request time), atomically claims the
PENDING -> PAID transition via `findOneAndUpdate` (closing the same
double-approve race class already seen in `RefundsService.reviewRefund`'s
PROCESS step and `PartnerOperationsService.createSettlement`), debits the
rider's wallet with an atomic `$inc`, and posts a matching ledger entry.
`rejectWithdrawal` is a simple status flip with no wallet/ledger side effects,
appropriately.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Queue state banner | `counts.pending` (>0 -> attention) | Simple binary threshold, reasonable. |
| Stat tiles (6) | `counts.{total,pending,pendingAmount,paid,paidAmount,rejected}`, client `largestPending` (max `amount` among pending items in the loaded window) | All server-count fields are accurate/uncapped; `largestPending` is derived from the capped 100-row `items` window, so it shares the same blind spot as Finding 1 if a backlog of pending requests ever exceeds 100 — noted there, not a separate finding. |
| Status tabs (4) | Tab badge counts | **Fixed** — previously re-derived from the capped `items` array; see Finding 1 (same bug already found and fixed on the Refunds board). |
| Payout queue table | `riderName`, `amount`, `methodLabel`, `status` (via `statusBadgeClass`+`statusLabel`), `createdAt`, `processedAt`, masked payout details (`maskPayoutDetails`) in a `title` tooltip | `statusBadgeClass` (`withdrawals-board.tsx:57-62`) is a small hardcoded status map, same low-risk pattern noted elsewhere. |
| Right rail — withdrawal detail | `selected.{methodLabel,createdAt,processedAt,adminNote}`, masked payout details | See Finding 2 — full payout destination is never shown anywhere, even here. |
| Payout policy panel | Static copy only | Explicitly states the manual-transfer workflow this board supports — see Finding 2. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Approve | yes — debits the rider's wallet balance and posts an irreversible ledger entry; no "un-approve" action exists | yes — routes through `NoteModal` (title "Approve withdrawal", explicit note field, explicit confirm button), functionally equivalent to a confirm dialog | yes, `disabled={actionBusy}` on both the modal's confirm button and the triggering row action | yes, `actionError` |
| Reject | no (reversible in the sense that nothing financial has moved yet) | yes, same `NoteModal` pattern | yes | yes |

## Authorization
`AdminController` is class-level `@Roles(UserRole.ADMIN)` — matches the frontend
(admin-only page). No role-scoped filter to widen (platform-wide payout queue by
design) — no `[authz]` findings.

## Findings

1. **Status-tab badge counts disagreed with the stat tiles once withdrawal volume exceeds 100.**
   Same bug as `refunds.md` Finding 1, found again here: `STATUS_TABS`
   (pre-fix, `withdrawals-board.tsx:193-198`) computed every tab's count from
   the capped `items` array (`listWithdrawalsForAdmin` caps it to the 100
   most-recent, `rider-wallet.service.ts:387`), while the stat tiles directly
   above already read the accurate, uncapped `counts.{total,pending,paid,rejected}`
   from the same response.
   **Fix:** `STATUS_TABS` now reads `counts.total`/`counts.pending`/`counts.paid`/
   `counts.rejected` directly (`withdrawals-board.tsx:193-198`) — cross-module
   consistency check: grepped for the same `items.filter(...).length` pattern
   used for a tab/stat count elsewhere and found only these two occurrences
   (Refunds, now fixed there too, and this one) — no other board has this exact
   bug.

2. **Full payout destination (GCash/Maya number, bank account number) is never shown anywhere in the admin UI, only masked previews — yet the page's own copy instructs admins to "transfer GCash, Maya, or bank payouts manually."**
   `maskPayoutDetails()` (`lib/mask-pii.ts`) is applied consistently in both the
   list row and the per-request detail rail (`withdrawals-board.tsx:447,509`) —
   there is no reveal/copy affordance anywhere in this component, and the
   Riders profile page (`/riders/[userId]`) doesn't surface these fields either.
   Two readings are equally plausible from the code alone: (a) this is
   deliberate least-privilege masking, and admins already know/verify the full
   account details through a separate external process (matching name + last 4
   digits shown here against their own transfer tool), or (b) this is a UI gap
   that makes the described manual-transfer workflow impossible to complete
   correctly from this screen alone. Left unresolved: this is a PII-handling
   policy question for whoever owns the payout workflow, not a one-line bug fix
   — adding a "reveal full number" affordance unilaterally would be a security-
   relevant product decision, not something to guess at.

## Unused/dead fields
None — every field on `WithdrawalRow`/`WithdrawalCounts` is read somewhere
(payout-detail fields are read, just always through the masking function — see
Finding 2, not "unused").

## Loading/error/realtime behavior
Standard `useAdminQuery` behavior (spinner while `null`, failed reload keeps
prior data, `alert-error` on failure) — same pattern as every other audited
admin-web board. No realtime socket subscription and no polling interval (unlike
`refunds-board.tsx`'s 120s visibility-gated poll) — a manual "Sync" button is
the only refresh trigger; reasonable given rider payout requests are lower
volume/urgency than the customer refund queue.
