# Audit: Partner-web — Shop receiving

Date: 2026-08-31

## Entry point
- Page: `apps/partner-web/src/app/orders/[id]/receiving/page.tsx`
- Component(s): inline in the page file (`ActionCard`/`StepIcon`/`Icon` shared UI components)

Linked from `orders/incoming/page.tsx:130` ("Receive"/"Continue receiving" button,
passing `o._id` as the `[id]` route param) and from `orders/[id]/page.tsx:376`
("Open shop receiving" banner link, same order id). Previously also linked from the
now-deleted `orders/board/page.tsx` — that route was removed and both remaining
entry points still resolve correctly, no dangling links found anywhere in
`apps/partner-web`.

## Sub-pages
None from this page's own perspective — it's the terminal step before an order moves
into laundry processing (`orders/[id]/page.tsx`, already audited in
[order-detail.md](order-detail.md)); "Start laundry processing" on completion links
there.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load receiving state | GET | `/partner/orders/:id/receiving` | `PartnerReceivingView` | `PartnerController.getReceiving` -> `ShopReceivingService.getReceiving` |
| Mark laundry received | POST | `/partner/orders/:id/receiving/receive` | — | `PartnerController.receiveLaundry` -> `ShopReceivingService.receiveLaundry` (`ReceiveLaundryDto`) |
| Verify weight (+ load/piece count) | POST | `/partner/orders/:id/receiving/verify-weight` | — | `PartnerController.verifyShopWeight` -> `ShopReceivingService.verifyWeight` (`VerifyShopWeightDto`) |
| Confirm item count | POST | `/partner/orders/:id/receiving/confirm-items` | — | `PartnerController.confirmShopItems` -> `ShopReceivingService.confirmItems` (`ConfirmShopItemsDto`) |

## Backend trace
`getOrderForPartner` (shared by all four handlers) loads the order, resolves the
caller's portal branch, and calls `assertOrderPortalAccess` — the same ownership
check already vetted for the sibling processing endpoints in
[order-detail.md](order-detail.md); a partner/staff account can't act on another
shop's order via this flow. The three-step state machine (`receive` ->
`verify-weight` -> `confirm-items`) is enforced with explicit guard checks at each
step (can't verify weight before receiving, can't confirm items before verifying
weight, can't re-receive/re-verify/re-confirm once already done, `canTransitionOrderStatus`
gates the final status flip to `RECEIVED_AT_SHOP`). `verifyWeight` finalizes real
pricing for `PER_KG`/`PER_LOAD`/`PER_PIECE` orders using the *booking-time* rate
snapshot (`order.pricingSnapshot`), not the branch's possibly-since-changed live
rates — correct, avoids a partner's later price change silently altering an
in-flight order's total. `confirmItems` transitions status, records `statusHistory`,
and best-effort deducts inventory (`deductInventoryForOrder`, wrapped in
`.catch(() => {})` so an inventory hiccup can't block the order).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Step progress list | `view.workflowSteps`, `view.workflowStep` (index into the list, drives done/current/upcoming styling) | server-computed via `getShopReceivingStepIndex`, not re-derived client-side |
| "Waiting for rider" banner | shown when none of `canReceive`/`canVerifyWeight`/`canConfirmItems`/`isComplete` are true | correctly covers the one state (order not yet `IN_TRANSIT_TO_SHOP`) where no action is available |
| Receive laundry card | optional `note` (local input) | |
| Verify weight card | `est`/`riderWt` (declared vs rider-weighed, for a variance comparison — `> 0.5kg` highlighted amber), `view.order.pricingMode` (drives whether load-count/piece-count inputs appear), `view.order.total`/`.finalTotal` (estimated vs finalized total, shown once available) | client only computes the *display* variance (`Math.abs`); the authoritative final price is entirely server-computed in `verifyWeight` |
| Confirm items card | local `itemCount` | copy states the resulting status literally (`received_at_shop`) — accurate |
| Complete banner | `view.shopReceiving.verifiedWeightKg`/`.itemCount` | links to `orders/[id]` to continue |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Receive laundry | no | n/a | yes — `disabled={loading}`, and re-entrancy is also blocked server-side (`receivedAt` already set -> 400) | yes — `error` banner |
| Verify weight | no | n/a | yes — same pattern, plus server-side re-entrancy guard (`weightVerifiedAt` already set -> 400) | yes |
| Confirm items | no (advances order status, not deletion) | n/a | yes — same pattern, plus server-side re-entrancy guard | yes |

## Authorization
All four routes are `@Roles(PARTNER, STAFF, ADMIN)`, matching the page's
`useProtectedPage` gate, with ownership independently re-verified per-request via
`assertOrderPortalAccess` (no request param can widen scope past the caller's own
branch). No `[authz]` issues.

## Findings

1. **The "Require weight verification on receive" setting had no effect — weight
   verification was always mandatory regardless of the toggle.** Partner Settings
   (`apps/partner-web/src/app/settings/page.tsx:1010-1017`) exposes a toggle labeled
   "Require weight verification on receive" / "Staff must verify weight during shop
   receiving before continuing," backed by
   `branch.portalSettings.requireWeightVerificationOnReceive` (`branch.schema.ts:36`,
   defaults `true`). But `ShopReceivingService.confirmItems` (pre-fix) unconditionally
   required `order.shopReceiving.verifiedWeightKg != null` before allowing item
   confirmation, and `buildView`'s `canConfirmItems` flag (which controls whether this
   page even shows the "Confirm items" card) had the identical unconditional check —
   neither read the setting at all. A partner who turned this toggle **off** (expecting
   staff to be able to skip straight to confirming items) saw no behavior change
   whatsoever: the "Confirm items" card still never appeared until weight was verified,
   and the confirm-items endpoint still rejected the request if called directly. The
   setting was pure UI with zero backend wiring.
   **Fix:** `confirmItems` now looks up the order's branch (`branchesService.getActivePartnerShop`,
   the same helper already used two lines below it for payout calculation) and only
   enforces the weight-verified gate when `portalSettings.requireWeightVerificationOnReceive`
   is not explicitly `false`; `buildView` was made `async` and given the same
   branch-derived `weightVerificationRequired` flag, so `canConfirmItems` now also
   allows confirming items with no weight recorded when the setting is off —
   `apps/api/src/modules/partner/shop-receiving.service.ts` (`buildView`,
   `confirmItems`, and their four call sites, each updated to `await` the now-async
   `buildView`). `canVerifyWeight` is unchanged — a partner with the setting off can
   still optionally record weight if they want to, just isn't forced to. Typechecked
   `apps/api` clean. `buildView` has no other callers besides this file's own four
   handlers, so no regression risk elsewhere.

## Unused/dead fields
None — every field on `PartnerReceivingView` is rendered somewhere on this page.

## Loading/error/realtime behavior
No `usePartnerQuery` here — a local `load()`/`useEffect` pair with `error` state
(preserves the error banner rather than crashing) and a "Loading…" fallback while
`view` is null. Each mutation (`run()`) re-fetches the full view on success via the
same `load()` function, so the page always reflects authoritative server state after
every step. No sockets/polling on this page itself; the backend does emit
`trackingGateway` events (`laundryReceivedAtShop`, `shopWeightVerified`,
`receivedAtShop`, plus a pipeline-wide update) for other surfaces (customer-facing
tracking, the partner pipeline dashboard) to pick up in real time — this page doesn't
need to since it re-fetches synchronously after its own actions.
