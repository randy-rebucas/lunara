# Audit: partner-mobile — Orders app (tabs, order detail, receiving, scan, profile, login)

Date: 2026-08-23

The whole app is small (5 tabs + 2 stack screens + login), so it's audited as one module rather than split.

## Entry point
- Tabs root: `apps/partner-mobile/app/(tabs)/index.tsx` (redirects to `orders`)
- Orders list: `apps/partner-mobile/app/(tabs)/orders.tsx`
- Profile: `apps/partner-mobile/app/(tabs)/profile.tsx`
- Scan: `apps/partner-mobile/app/(tabs)/scan.tsx`
- Login: `apps/partner-mobile/app/login.tsx`

## Sub-pages

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `order/[id]/index.tsx` | `OrderRow` press, `orders.tsx:69-77` | `order._id` → `id`; also `canAccept`/`canRequestDelivery` as string route params | yes — fetches `/partner/orders/${id}/processing` |
| `order/[id]/receiving.tsx` | "Continue receiving" card, `order/[id]/index.tsx:266-267` | `id` from the parent route's own `id` param | yes — fetches `/partner/orders/${id}/receiving` |

**`order/[id]/index.tsx`**: re-fetches the full processing view rather than reusing anything from the list (correct — the list only has summary fields). It also re-fetches `/partner/orders/incoming` after every load solely to refresh `canAccept`/`canRequestDelivery` (`refreshFlags`, lines 43-53), because `/partner/orders/:id/processing` doesn't return those flags itself and the route params passed from the list are frozen at navigation time. This is a deliberate, documented workaround (see the file's top comment) rather than an oversight, but it means every visit to the order detail screen makes two backend calls where one (a processing-view that also returned the flags) would do — flagged in Findings as a cheap backend win, not a bug.

**`order/[id]/receiving.tsx`**: fetches its own `PartnerReceivingView`, independent loading/error state, no realtime/polling (relies on pull-to-refresh being absent — see Loading/error/realtime section). No issues with the param handoff.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Orders list | GET | `/partner/orders/incoming` | `{ items: PartnerOrderSummary[] }` | `PartnerController.getIncoming` → `PartnerOperationsService.getIncomingOrders` |
| Order detail | GET | `/partner/orders/:id/processing` | `PartnerProcessingView` | `PartnerController.getProcessing` → `ProcessingService.getOrderProcessing` |
| Order detail (flag refresh) | GET | `/partner/orders/incoming` | `{ items: PartnerOrderSummary[] }` | same as list |
| Accept order | POST | `/partner/orders/:id/accept` | — | `PartnerController.acceptOrder` → `PartnerOperationsService.acceptPartnerOrder` |
| Accept job | POST | `/partner/orders/:id/processing/accept` | — | `PartnerController.acceptJob` → `ProcessingService.acceptJob` |
| Advance step | POST | `/partner/orders/:id/processing/advance` | — | `PartnerController.advance` → `ProcessingService.advance` |
| Request delivery | POST | `/partner/orders/:id/request-delivery` | — | `PartnerController.requestDelivery` → `PartnerOperationsService.requestDelivery` |
| Receiving view | GET | `/partner/orders/:id/receiving` | `PartnerReceivingView` | `PartnerController.getReceiving` → `ShopReceivingService.getReceiving` |
| Receiving steps | POST | `/partner/orders/:id/receiving/receive` \| `/verify-weight` \| `/confirm-items` | — | `ShopReceivingService.{receiveLaundry,verifyWeight,confirmItems}` |
| Profile | GET | `/partner/profile` | `PartnerOwnProfile` | `PartnerController.getOwnProfile` → `PartnerProfileService.getOwnProfile` |
| Avatar upload/remove | POST/DELETE | `/partner/profile/avatar` | `PartnerOwnProfile` | `PartnerProfileService.{updateOwnAvatar,removeOwnAvatar}` |
| Own branch (profile tab) | GET | `/public/branches/:branchId` | `OwnBranch` | public branches endpoint (not partner-scoped) |
| Scan lookup | GET | `/laundry-tags/lookup?code=` | `TagLookupResult` (local interface) | laundry-tags module (not traced here — out of this app's scope) |
| Login | POST | `/auth/login` | `{ user: User; tokens: AuthTokens }` | auth module |

## Backend trace

`getIncomingOrders` filters orders by `status ∈ INCOMING_STATUSES`, `dispatchStatus: 'dispatched'`, `branchId` set, then scopes by role: `PARTNER` → own `partnerId`; `STAFF` → own branch via `resolvePortalBranchId`/`applyStaffBranchFilter`; `ADMIN` → unscoped. Per-order flags (`canAccept`, `canRequestDelivery`, etc.) are computed in `summarizeIncoming`/`summarizeIncomingBatch`, which is role-*blind* for `canAccept` (see Findings #1).

`ProcessingService.getOrderProcessing` / `ShopReceivingService.getReceiving` both call `assertOrderPortalAccess(order, userId, role, branchId)` for scoping, which is the shared helper in `partner-access.ts`.

## Cards / panels

**Orders list (`orders.tsx`)**

| Card | Fields consumed | Notes |
|---|---|---|
| Summary row | `items.length`, derived `needsAttention` (= count where `stageOf(o) === 'accept'`) | client-derived count |
| Filter chips | derived `stageCounts` per `Stage` | client-derived from `stageOf()`, a client-side classifier duplicated verbatim in `apps/partner-web/src/app/orders/board/page.tsx` (cross-module: same `stageOf` logic hand-maintained in 2 apps) |
| Order row | `bookingType`, `_id` (last 6 chars as short id), `total`, `stageOf(order)` (via `canAccept`, `status`), `paymentLabel`, `currentStepLabel`, `slaLabel` | `paymentLabel` and `slaLabel` are pre-formatted server-side; row's own short id (`_id.slice(-6)`) is a client-side derivation, not the same shortCode logic used elsewhere (`order.shortCode` doesn't exist on this type) — cosmetic only, not a bug |

**Order detail (`order/[id]/index.tsx`)**

| Card | Fields consumed | Notes |
|---|---|---|
| Status card | `currentStep.label`, `view.isComplete`, `view.progress`, `currentStep.description`, `nextStep.label` | progress bar width computed inline from `view.progress` |
| Booking/total card | `order.bookingType`, `order.total` | |
| Customer card | `order.customerName`, `order.customerPhone` | shown only to whichever role can reach this screen (PARTNER/STAFF/ADMIN, all shop-side) — reasonable, since shop staff need the contact for delivery/verification |
| Breakdown card (collapsible) | `order.items[]`, `order.subtotal`, `order.deliveryFee`, `order.discount`, `order.couponCode`, `order.total`, `order.scheduledPickupAt`, `order.scheduledDeliveryAt`, `order.estimatedWeightKg` | date formatting hardcoded to `'en-PH'` locale — fine, single-market app |
| Action buttons | `canAccept` (route param + `liveFlags`), `showReceiving`, `canAcceptJob`, `canAdvance`, `canRequestDelivery`, `showAssignedToOther` | see Findings #1 for the `canAccept` role gap |

**Receiving (`order/[id]/receiving.tsx`)**

| Card | Fields consumed | Notes |
|---|---|---|
| Header | `order.bookingType`, `order.status` | |
| Receipt card | `order.pickup.receiptCode` | |
| Workflow steps | `workflowSteps[]`, `workflowStep` | |
| Waiting-for-rider card | derived `!canReceive && !canVerifyWeight && !canConfirmItems && !isComplete` | client-derived gate name (`waitingForRider`), server doesn't send this as a single flag — fine, it's just the negation of the other three |
| Receive card | `canReceive` | |
| Verify weight card | `canVerifyWeight`, `order.estimatedWeightKg`, `order.pickup.actualWeightKg`, `order.pricingMode`, `order.finalTotal`, `order.total` | `variance > 0.5` kg is a hardcoded warning threshold, not server-configured |
| Confirm items card | `canConfirmItems` | |
| Complete card | `isComplete`, `shopReceiving.verifiedWeightKg`, `shopReceiving.itemCount` | |

**Profile (`profile.tsx`)**

| Card | Fields consumed | Notes |
|---|---|---|
| Hero (avatar/name/role) | `profile.displayName`, `profile.avatarUrl`, `user.email`, `user.role` | name falls back to email-local-part then `'Partner staff'` |
| Branch card | `branch.name`, `branch.city`, `branch.province` | from `useOwnBranch()`, a separate `/public/branches/:id` call keyed off `user.branchId` |
| Account card | logout action only | |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Accept order | no (reversible via ops) | no | yes — `busy` disables the button | yes — `error` state shown |
| Accept job | no | no | yes | yes |
| Advance processing step | no | no | yes | yes |
| Request delivery | no | no | yes | yes |
| Receive laundry | no | no | yes (`busy`) | yes |
| Verify weight | no | no | yes | yes |
| Confirm items | no | no | yes | yes |
| Upload avatar | no | no | yes (`uploading` disables the press target) | yes — `Alert.alert` |
| Remove avatar | mildly (deletes photo) | no — fires straight from the action-sheet tap | yes | yes |
| Sign out | yes (ends session) | yes — `Alert.alert` confirm | n/a | n/a |

No issues here — the destructive-adjacent "Remove photo" is a cheap-to-redo mutation (re-upload), and every busy-mutation disables its own trigger.

## Authorization

`[authz]` **Finding #1** (see below): `acceptOrder`'s route guard excluded `STAFF` while the `canAccept` flag the UI uses to show the "Accept order" button is computed without regard to role, so STAFF users could see and tap a button that always failed server-side. Fixed in this pass.

All other mutation endpoints used by this app (`processing/accept`, `processing/advance`, `request-delivery`, the three `receiving/*` steps) already gate with `@Roles(PARTNER, STAFF, ADMIN)` and scope via `assertOrderPortalAccess`, which correctly restricts STAFF to their own `branchId` and PARTNER to their own `partnerId`. `requestDelivery`'s service method had the same STAFF-branch-scoping gap as `acceptPartnerOrder` (checked only `PARTNER` ownership, no check at all for STAFF) — also fixed in this pass, since STAFF was already allowed to call it at the controller and could otherwise action any branch's order.

## Findings

1. **[authz] `acceptOrder`/`requestDelivery` let STAFF requests through inconsistently, and did not scope STAFF to their own branch.** `apps/api/src/modules/partner/partner.controller.ts` (`acceptOrder`, was `@Roles(PARTNER, ADMIN)`) excluded STAFF, but `PartnerOrderSummary.canAccept` (`partner-operations.service.ts:1741`, `!order.partnerAcceptedAt && order.dispatchStatus === 'dispatched'`) is computed with no role check at all — so a STAFF user's order list and `order/[id]/index.tsx` both show an "Accept order" button (`stageOf()` → `'accept'` whenever `canAccept` is true) that always 403'd for STAFF. Separately, `requestDelivery` in `partner-operations.service.ts` *was* allowed for STAFF at the controller but its service method only checked `role === PARTNER` ownership — a STAFF request for any branch's order (not just their own) would have gone through with no branch check at all.
   **Fix:** `partner.controller.ts` — added `UserRole.STAFF` to `acceptOrder`'s `@Roles`. `partner-operations.service.ts` — `acceptPartnerOrder` and `requestDelivery` both now call the shared `resolvePortalBranchId` + `assertOrderPortalAccess(order, userId, role, branchId)` helper (already used by `ProcessingService`/`ShopReceivingService` for the same purpose) instead of a partner-only ownership check, so STAFF is now both allowed and correctly scoped to their own branch. Typechecked clean (`npx tsc --noEmit` on `apps/api`). No other callers of `acceptPartnerOrder`/`requestDelivery` exist outside this controller, so no regression surface beyond the two endpoints changed.

2. Order detail screen makes 2 backend requests per load/action (`/processing` + `/orders/incoming` for `refreshFlags`) because `/partner/orders/:id/processing` doesn't return `canAccept`/`canRequestDelivery`. `apps/partner-mobile/app/order/[id]/index.tsx:43-59`. This is deliberate (documented in the file) rather than an oversight, and fixing it would mean widening `PartnerProcessingView`'s backend response — a contract change affecting `ProcessingService.getOrderProcessing` and any other consumer of that type. Left unfixed: out of this pass's scope (backend response shape change, not a bug fix).

3. `stageOf()` (the accept/receive/process/deliver classifier) is duplicated verbatim between `apps/partner-mobile/app/(tabs)/orders.tsx:44-49` and `apps/partner-web/src/app/orders/board/page.tsx:25-30`. Not a defect today, but the two copies can silently drift (e.g. one app's classifier changes without the other). Left unfixed: no obvious shared home for this logic without a larger `@lunara/utils` change touching both apps' import graphs — a refactor decision beyond this audit's scope, not a bug.

## Unused/dead fields

`PartnerOwnProfile.phone`, `PartnerOwnProfile.email`, and `PartnerOwnProfile.canManageSettings` (`packages/types/src/partner.ts:168-174`) are declared on the type but `PartnerProfileService.getOwnProfile`'s `formatProfile()` (`partner-profile.service.ts:13-18`) never populates them — the backend only ever returns `displayName`/`avatarUrl`. Not sensitive (they'd just be `undefined`, and the mobile screen sources `email`/`role` from the auth store instead), so this is dead-type-surface rather than a data-exposure finding.

## Loading/error/realtime behavior

Each screen manages its own `loading`/`error` state locally (no shared `useAsyncQuery`-style hook in this app, unlike the web apps). Orders list: shows skeleton cards while loading, keeps previously-loaded `items` on a *silent* poll failure (`load(true)` only sets `error` when `silent` is false — line 141-149), and polls every 25s via `useFocusEffect` + `setInterval`, cleared on blur. Pull-to-refresh (`RefreshControl`) is wired on the list only.

Order detail and receiving screens: full-screen spinner while loading, error text if `view` is null after a failed load, no polling/realtime and no pull-to-refresh — a user has to background/foreground the screen (re-triggering `useEffect`) or manually retry an action to see server-side changes made by someone else (e.g. another staff member accepting the same job). This matches `receiving.tsx`'s own "check back shortly or pull to refresh" copy (line 155) despite there being no `RefreshControl` on that screen — the hint text promises a pull-to-refresh gesture that doesn't exist. Minor, but worth noting: not fixed here since adding pull-to-refresh is a small UX feature addition rather than a bug fix to existing behavior, and is better paired with deciding whether polling should also be added (product call).
