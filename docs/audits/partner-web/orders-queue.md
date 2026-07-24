# Audit: Partner-web — Orders (processing queue / kanban)

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/orders/page.tsx`
- Component(s): `ProcessingKanbanBoard` (`components/processing-kanban-board.tsx`)

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/page.tsx` | kanban card `Link`, `processing-kanban-board.tsx:60` | `order._id` -> `id` route param | yes |

`orders/[id]/page.tsx` is a large, independent order-processing feature
(photo upload, QR handoff, realtime socket, staff-vs-partner views) — already
flagged in `docs/audits/partner-web/customers.md` and `messages.md` as
genuinely separate and out of scope for a thin-detail-view trace; it deserves
its own dedicated audit pass rather than being covered piecemeal here.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load queue | GET | `/partner/orders/queue?mine=` | `{ items: PartnerQueueOrder[]; counts: Record<string, number> }` | `PartnerController.getQueue` -> `ProcessingService.getQueue` |
| Accept job | POST | `/partner/orders/:orderId/processing/accept` | — | `PartnerController.acceptJob` -> `ProcessingService.acceptJob` |
| Move step (drag-and-drop) | POST | `/partner/orders/:orderId/processing/move` | — | `PartnerController.moveProcessingStep` -> `ProcessingService.moveToStep` |
| Realtime pipeline updates | socket (`/tracking`, `joinPartnerPortal`/`joinPartnerOperations`/`joinBranch` -> `partnerPipelineUpdated`/`branchPipelineUpdated`) | — | triggers `reload()` | `TrackingGateway` |

## Backend trace
`getQueue` filters orders to `PARTNER_PROCESSING_QUEUE_STATUSES` +
`dispatchStatus: 'dispatched'` + a non-null `branchId`, then scopes further
by role: `PARTNER` -> `partnerId` match, `STAFF` -> their resolved branch via
`resolvePortalBranchId`/`applyStaffBranchFilter` (the same helpers used
consistently elsewhere in this module — `docs/audits/partner-web/customers.md`
confirmed this pattern is correct), and `mineOnly` (the "My jobs" toggle)
additionally filters to `laundryProcessing.assignedStaffId` matching the
caller regardless of role. Both `acceptJob` and `moveToStep` load the order,
resolve the caller's branch, and call `assertOrderPortalAccess` before
mutating — the same ownership-check pattern already verified correct in
prior audits (`assertOrderPortalAccess` rejects a `PARTNER` whose `partnerId`
doesn't match, or a `STAFF` whose branch doesn't match). Both also reject a
job already assigned to a *different* staff member
(`assigned !== userId && role === STAFF`) before allowing the accept/move —
correctly prevents one staff member from grabbing a job another staff member
already claimed. Payment fields are attached via the shared
`buildOrderPaymentSummary` helper (also used by other partner endpoints) — a
single map lookup per order via `loadLatestOrderPaymentsByOrderId`, no N+1.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Header live badge | `socketLive` (client-derived from `usePartnerPipelineSocket`'s `connected`) | |
| "My jobs" / "All jobs" toggle | `mineOnly` (local state, drives the `mine` query param) | |
| Kanban columns (one per `LAUNDRY_PROCESSING_STEPS` entry) | `orders[].currentStepId` (client-side `.filter()` per column) | column set is a hardcoded, shared constant (`LAUNDRY_PROCESSING_STEPS`) — not fetched, correctly the same source used by `orders/[id]`'s own step display |
| Order card | `order.bookingType`, `.total` (via `formatPeso`), `.isAssigned` | drag handle moves the card between columns (calls `move`); "Accept job" button shown only when `!isAssigned` |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Accept job | no (claims an unassigned job) | n/a | no explicit guard, but the "Accept job" button disappears once `isAssigned` becomes true after a successful `reload()` — a very fast double-click could theoretically fire twice, and the backend's already-assigned check would just reject the second one with a clear error, so no real risk | yes (`actionError`) |
| Move step (drag-and-drop) | no | n/a | implicit — dragging is a discrete gesture, can't easily double-fire; optimistic update reverts to `previous` on failure | yes (`moveError`), and the optimistic column move reverts correctly on failure — verified `setLocalOrders(previous)` runs in the `catch` |

No destructive (delete/retire) actions on this page.

## Authorization
Both `GET /partner/orders/queue` and the accept/move mutations are `@Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)`, matching the frontend's `useProtectedPage({ roles: [PARTNER, STAFF, ADMIN] })`. Role-scoped filters (`partnerId`/`branchId` in `getQueue`, `assertOrderPortalAccess` in accept/move) are all derived server-side from `req.user`, never from a client-suppliable param — no way to widen scope by request param. No `[authz]` issues found.

## Findings

1. **[FIXED] Dead duplicate function call.** `ProcessingService.summarizeOrder` (pre-fix, `processing.service.ts:449-452`) computed `currentStepId` with `getInitialProcessingStepForOrder(order.status) ?? getInitialProcessingStepForOrder(order.status)` — the same pure function called twice in a row with identical arguments via `??`, which can never behave differently from calling it once (if the first call returns `undefined`, so does the second). Harmless (no behavior difference), but an obvious copy-paste artifact.
   **Fix:** removed the redundant second call — `apps/api/src/modules/partner/processing.service.ts:449-451`.

No other issues found — authorization, ownership checks, and optimistic-update rollback on the drag-and-drop move all check out correctly.

## Unused/dead fields
`summarizeOrder`'s response includes `estimatedWeightKg`, `verifiedWeightKg`,
and the full spread of `buildOrderPaymentSummary` (`paymentAmount`,
`paymentReceiptCode`, `cashTiming`, `paymentPaidAt`, `cashCollectedBy`,
`refundable`, beyond the `paymentMethod`/`paymentStatus`/`paymentLabel` the
frontend type declares) — none of these extra fields are declared on
`PartnerQueueOrder` (`packages/types/src/partner.ts:136-150`) or rendered on
this page. Not flagged as a Finding: `buildOrderPaymentSummary` is a shared
helper reused by other endpoints that *do* need the fuller payment detail
(e.g. the order detail sub-page), so this is inexpensive shared-code reuse
rather than a wasteful bespoke query — but `estimatedWeightKg`/`verifiedWeightKg`
being fetched and typed away is a small missed opportunity: the kanban card
could show order weight without any new backend work, if that's ever wanted.

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md` — this page benefits from that fix
too, confirmed by inspection, no separate issue here). Realtime pipeline
updates trigger a full `reload()` rather than an incremental patch — the
kanban board's own local optimistic state (`localOrders`, for the
in-flight drag) is correctly resynced from the parent's `orders` prop via a
`useEffect` keyed on the array reference, so a socket-triggered reload
doesn't fight with an in-progress drag update.
