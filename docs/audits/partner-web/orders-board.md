# Audit: Partner-web — Orders (staff board)

**RETIRED 2026-08-31.** `apps/partner-web/src/app/orders/board/page.tsx` has been
deleted from the codebase. Its two sub-pages (`orders/[id]/receiving`,
`orders/[id]/page.tsx`) are still live and reachable — the "Receive"/detail links
this board used to provide now come from `orders/incoming/page.tsx` and
`orders/[id]/page.tsx`'s own banner instead (see [receiving.md](receiving.md), newly
audited, and the already-audited [order-detail.md](order-detail.md)). Grepped the
whole app for `orders/board`/`/orders/board` — no remaining references, so nothing
links to a dead route. Left below for historical reference only; do not use this
doc to reason about current behavior.

---

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/orders/board/page.tsx`
- Component(s): `OrderCard` (inline in the page file)

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/receiving/page.tsx` | "Receive at shop"/"Continue receiving" link, `page.tsx:77` | `order._id` -> `id` route param | yes |
| `orders/[id]/page.tsx` | card link / "Open" link | `order._id` -> `id` route param | yes |

Same large, independent order-processing feature already flagged as
out-of-scope for a full trace across multiple prior audits — not re-traced
here.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List orders | GET | `/partner/orders/incoming` | `{ items: PartnerOrderSummary[] }` | same `PartnerController.getIncoming` -> `getIncomingOrders` already traced in `docs/audits/partner-web/orders-incoming.md` |
| Accept order | POST | `/partner/orders/:orderId/accept` | — | traced in `orders-incoming.md` |
| Accept processing job | POST | `/partner/orders/:orderId/processing/accept` | — | traced in `docs/audits/partner-web/orders-queue.md` |
| Advance processing stage | POST | `/partner/orders/:orderId/processing/advance` | — | `PartnerController.advance` -> `ProcessingService.advance` |
| Request delivery | POST | `/partner/orders/:orderId/request-delivery` | — | traced in `orders-incoming.md` |
| Realtime pipeline updates | socket (same `usePartnerPipelineSocket` hook verified correct in `orders-queue.md`) | — | triggers a full reload | `TrackingGateway` |

This page is a **unified alternative view** combining the Incoming-orders list
(`docs/audits/partner-web/orders-incoming.md`) and the Processing-queue
kanban (`docs/audits/partner-web/orders-queue.md`) into one 4-column board
covering the whole accept -> receive -> process -> deliver lifecycle from a
single fetch — not a distinct feature with its own backend surface. Every
endpoint it calls was already traced and verified in one of those two docs,
except `processing/advance`, traced fresh here.

## Backend trace
`ProcessingService.advance` (new to this trace) is gated the same way as the
already-verified `acceptJob`/`moveToStep` (`orders-queue.md`):
`assertOrderPortalAccess` for branch/partner ownership, plus an explicit
`STAFF`-only check that the caller is the order's `assignedStaffId` — this
exactly mirrors the frontend's own `jobIsMine` gate (`page.tsx:45-48`,
`disabled={busy || !jobIsMine}`), so a staff member can't advance a job
assigned to a coworker even if they somehow bypassed the disabled button
(defense in depth, not just a UI nicety). All fields in `AdvanceProcessingDto`
are optional (`note`, `verifiedWeightKg`, `skipIroning`, `photoUrl`), so this
page's bodyless `POST` (no weight/photo capture on this board — those exist
on the full order-detail page) is valid, not a validation-rejected request.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| 4 stage columns (Accept / Receive & verify / Process / Deliver) | client-derived `stageOf(order)` buckets each order by `canAccept` -> `status === 'ready_for_delivery'` -> `isPartnerLaundryProcessingStatus(status)` -> else `'receive'`, in that priority order | `INCOMING_STATUSES` (the query's status filter, traced in `orders-incoming.md`) spans the full pipeline from pre-processing through `READY_FOR_DELIVERY`, so all 4 columns are genuinely populated from this one fetch — confirmed not a status-filter mismatch |
| Order card | `order.bookingType`, `.total`, `.currentStepLabel`, `.receivingStepLabel` (only shown in the `receive` column), `.slaLabel`, `.assignedStaffId`/`.assignedStaffEmail` (drives the `jobIsMine` gate for `STAFF`) | action button shown per-stage matches exactly one of the four mutations above |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Accept order | no | n/a | coarse shared-`busyKey` guard (same pattern as `orders-incoming.md` — blocks all cards while any one action is in flight) | yes (`error`) |
| Accept processing job | no | n/a | same coarse guard, plus disabled once `jobAccepted` (button swaps to "Advance stage") | yes |
| Advance processing stage | no | n/a | same coarse guard, plus `!jobIsMine` for `STAFF` (backend independently enforces the same check) | yes |
| Request delivery | no | n/a | same coarse guard | yes |

## Authorization
Every route this page calls was already verified in `orders-incoming.md`/`orders-queue.md`, all matching this page's `useProtectedPage({ roles: [PARTNER, STAFF, ADMIN] })`. `processing/advance` is `@Roles(PARTNER, STAFF, ADMIN)`, matching too, with the `STAFF`-must-be-assigned check verified above. No `[authz]` issues.

## Findings
No issues found. This page correctly reuses already-verified endpoints and
mirrors their exact ownership/assignment checks client-side
(`jobIsMine`), rather than introducing any new, unverified authorization
logic of its own.

## Unused/dead fields
None beyond what's already noted in `orders-incoming.md` (`canRequestPickup`,
unused across the whole app, not specific to this page).

## Loading/error/realtime behavior
Same manual `useState` + `useEffect` pattern as `orders-incoming.md` (not
`usePartnerQuery`), which already independently avoids the "wipe data on
error" bug since `setItems` is only called on the success path. Realtime
updates use the same `usePartnerPipelineSocket` hook already verified
correct.
