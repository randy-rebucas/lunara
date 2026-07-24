# Audit: Partner-web — Order detail (processing) + Shop receiving

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/orders/[id]/page.tsx`
- Component(s): `InfoBanner` (inline), plus shared `ActionCard`/`Icon`/`StepIcon`/`ProcessingPhotoUpload`/`OrderHandoffQr`/`AuthenticatedImage`

This is the large, independent order-processing feature previously flagged
as out-of-scope for a thin trace across `customers.md`, `messages.md`,
`orders-queue.md`, `shelf-lookup.md`, `dashboard.md`, `orders-incoming.md`,
`orders-board.md`, and `orders-progress.md` — audited in full here as its own
module, per those docs' cross-references.

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/receiving/page.tsx` | "Open shop receiving" link, `page.tsx:284` (shown when `needsReceiving`) | `id` (same route param, passed through) -> `id` | yes |

`orders/[id]/receiving/page.tsx` is thin enough to cover in this same doc
rather than splitting out: it fetches `PartnerReceivingView` from
`GET /partner/orders/:id/receiving` and posts to three sibling
`receiving/*` actions (`receive`, `verify-weight`, `confirm-items`), all
routed through `ShopReceivingService`, which — unlike two methods found
broken in the main page below — correctly gates every action through
`getOrderForPartner` (verified to apply the same `assertOrderPortalAccess`
ownership pattern already confirmed correct in `orders-queue.md`). No
findings specific to the receiving sub-page.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load order processing view | GET | `/partner/orders/:id/processing` | `PartnerOrderDetailView` | `PartnerController.getProcessing` -> `ProcessingService.getOrderProcessing` |
| Assign staff | POST | `/partner/orders/:id/assign-staff` | — | `PartnerController.assignStaff` -> `PartnerOperationsService.assignStaff` |
| Accept processing job | POST | `/partner/orders/:id/processing/accept` | — | traced in `orders-queue.md` |
| Move to step (click a stage directly) | POST | `/partner/orders/:id/processing/move` | — | traced in `orders-queue.md` |
| Advance stage | POST | `/partner/orders/:id/processing/advance` | — | traced in `orders-board.md` |
| Save shelf slot | PATCH | `/partner/orders/:id/processing/shelf` | — | traced in `shelf-lookup.md`/`SHELF.md` |
| Confirm customer self-collected | POST | `/orders/:id/customer-pickup/complete` | — | `OrdersController.completeCustomerPickup` -> `OrdersService.completeCustomerPickup` |
| Notify delivery riders | POST | `/partner/orders/:id/delivery/dispatch` | — | `PartnerController.dispatchDelivery` -> `PartnerOperationsService.notifyDeliveryDispatch` |
| Realtime order updates | socket (`/tracking`, `joinOrder` -> `orderStatusUpdate`/`orderEvent`) | — | triggers `reload()` | `TrackingGateway` |

## Backend trace
`getOrderProcessing` branches into a pre-processing view or the full
processing view depending on status (already noted in `orders-queue.md`).
`assignStaff` and the customer-pickup pair had real, concrete authz gaps —
see Findings #1–#3, all now fixed. Every other mutation on this page
(`processing/accept`, `.../move`, `.../advance`) was already independently
verified to correctly call `assertOrderPortalAccess` in prior audits — this
page doesn't introduce any new, unverified path into those.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Header | `view.order.bookingType/status/total`, `socketLive` | |
| Pickup receipt strip | `view.order.pickup.receiptCode` (conditional) | |
| Pre-processing banner + handoff QR | `view.currentStep.label/description`, `view.order.pickup.receiptCode/droppedAtShop` | |
| "Shop receiving required" banner | `view.order.status` (`in_transit_to_shop`/`received_at_shop`) | links to the receiving sub-page |
| Assign staff card | `view.assignedStaffId`, `staffList[]` (from `GET /partner/staff`, already scoped correctly per `staff.md`) | partner-only, matches `assignStaff`'s `@Roles(PARTNER, ADMIN)` |
| "Accept this job" banner | `view.isJobAccepted` | |
| Pipeline progress + step list | `view.progress`, `view.steps[]`, `view.currentStep.id`, `view.processing.completedSteps[].photoUrl` (conditional per-step image) | clicking a non-active, non-done step calls `moveToStep` directly — a real "jump to any step" capability, intentionally described in the page's own copy |
| "Mark complete" card | `view.canSkipIroning`, `view.currentStep.id`, `tagCode` (conditional laundry-tag display), photo upload, notes | |
| Shelf slot card | shown when at `quality_check`/`ready_for_delivery`/complete/`customer_pickup` | already covered for its case-sensitivity fix in `shelf-lookup.md` (assignment side) |
| "Awaiting customer self-collection" banner | `view.order.status === 'customer_pickup'` | see Finding #2 — the confirm button's URL was wrong |
| "Ready for delivery" / "notify riders" banner | `view.isComplete`, `view.order.fulfillmentType`, `canDispatchDelivery` (`partner \|\| allowStaffDelivery`, sourced from a fresh `/partner/settings` fetch on mount) | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Assign/reassign staff | no | n/a | yes (`disabled={loading \|\| !assignStaffId}`) | yes (`error`) |
| Accept job | no | n/a | yes (`disabled={loading}`) | yes |
| Move to step (click any stage) | no | n/a | yes (`clickable` excludes `loading`/active/pre-accept states) | yes |
| Advance stage | no | n/a | yes | yes |
| Save shelf slot | no | n/a | yes | yes |
| Confirm customer collected | no, but terminal (moves order to `COMPLETED`) | no | yes (`disabled={loading}`) | yes — **but see Finding #2, this call was 100% broken (wrong URL) until this pass** |
| Notify delivery riders | no | n/a | yes | yes, plus a distinct success message (`dispatchMessage`) |

## Authorization
See Findings #1–#3 — three real gaps found and fixed in this pass. Every other route this page calls was already independently verified correct in prior audits (cross-referenced above) and unaffected by these fixes.

## Findings

1. **[FIXED] [authz] `assignStaff` never verified the order actually belonged to the calling partner.** `PartnerOperationsService.assignStaff` (pre-fix) checked that the chosen `staffId` belongs to the *order's own branch* (`staff.branchId === order.branchId`), but never checked that the order's branch/partner had anything to do with the *calling* partner — only the route's `@Roles(PARTNER, ADMIN)` gated it, with no ownership check at the data layer. A partner who somehow obtained a valid `orderId`/`staffId` pair belonging to a *different* shop (both belonging to that other shop, since the branch-match check does constrain the pairing) could reassign that other shop's order to that other shop's own staff, or worse, silently claim an unclaimed order as the caller's own via the pre-existing `if (!order.partnerId) order.partnerId = ...` auto-assign fallback.
   **Fix:** added a check that when `order.partnerId` is already set for a `PARTNER`-role caller, it must match the caller — mirroring the identical pattern already used in the sibling `acceptPartnerOrder` method — returning `NotFoundException` rather than a `403` to avoid confirming another shop's order id exists. `role` is now threaded from the controller through to the service (`partner-operations.service.ts:739-753`, `partner.controller.ts:482-490`). `ADMIN` callers are unaffected (check only applies to `PARTNER`). Typechecked `apps/api` clean; confirmed this method has exactly one caller.

2. **[FIXED] "Confirm customer collected" called a URL that doesn't exist.** The button (`page.tsx:516`, pre-fix) called `POST /partner/orders/${id}/customer-pickup/complete` — but that route only exists on a *different* controller, at `POST /orders/:id/customer-pickup/complete` (`OrdersController`, base path `/orders`, not `/partner/orders`). Every click of this button would 404, meaning **no partner or staff member could ever confirm a customer's in-store self-collection through this page** — the order would stay stuck in `CUSTOMER_PICKUP` status indefinitely from the shop's side.
   **Fix:** corrected the URL to `/orders/${id}/customer-pickup/complete` — `apps/partner-web/src/app/orders/[id]/page.tsx:516`. Verified the target route's `@Roles(PARTNER, STAFF, ADMIN)` matches this button's visibility (shown to any role that can view this page).

3. **[FIXED] [authz] `markCustomerPickup`/`completeCustomerPickup` had no branch/partner ownership check at all.** While fixing Finding #2, tracing the actual target endpoint (`OrdersService.completeCustomerPickup`, and its sibling `markCustomerPickup`) found neither method checked that the order belonged to the caller's shop — only the route's `@Roles(PARTNER, STAFF, ADMIN)` gated access, identical in shape to Finding #1's gap. Any partner or staff account could mark or complete *any* order's customer-pickup status, regardless of which shop it belonged to — more severe than Finding #1 since there's no staff/branch-matching side-constraint narrowing the exploit here at all.
   **Fix:** both methods now accept `role` and, for `PARTNER`/`STAFF` callers, resolve the caller's branch and call `assertOrderPortalAccess` — the exact same pattern already used by `OrdersService.findOne` in the same file (`orders.service.ts:274-289`) — `orders.service.ts:449-500` (both methods), `orders.controller.ts:121-137`. `ADMIN` callers are unaffected. Typechecked `apps/api` clean; confirmed both methods have exactly one caller each (this controller), and the check is skipped for `ADMIN`, so `admin-web`'s own caller of the sibling `markCustomerPickup` route (confirmed via grep) is unaffected.

No other issues found — every other mutation on this page was already
independently verified correct in prior audits, and every field
`PartnerOrderDetailView`/`PartnerReceivingView` return is rendered.

## Unused/dead fields
None found beyond what's already noted in `orders-incoming.md`
(`canRequestPickup`, unused across the whole app).

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook for the main processing view (fixed
for the "wipe on error" bug in `docs/audits/partner-web/inventory.md`), plus
`usePartnerOrderSocket` (the single-order variant of the pipeline socket
hook, already verified correct in `orders-queue.md`) for realtime updates
scoped to just this one order. The staff list and settings fetches use plain
`useEffect` + `.then/.catch`, not the shared hook — reasonable for
one-shot, non-primary-content fetches that already have their own dedicated
error state (`staffError`).
