# Audit: rider-mobile — Home dashboard

Date: 2026-09-02

## Entry point
- Page: `apps/rider-mobile/app/(tabs)/index.tsx`
- Component(s): `apps/rider-mobile/src/components/active-assignment-card.tsx`,
  `apps/rider-mobile/src/components/compliance-banner.tsx`,
  `apps/rider-mobile/src/components/offline-banner.tsx`,
  `apps/rider-mobile/src/components/ui/location-permission-banner.tsx`,
  `apps/rider-mobile/src/components/ui/shift-panel.tsx`,
  `apps/rider-mobile/src/components/route-guide-carousel.tsx`,
  `apps/rider-mobile/src/context/rider-operations.tsx` (all data + mutations live here, shared by
  every rider-mobile tab, not just Home)

## Sub-pages
Home navigates into several detail routes, all of which are covered by other in-progress module
audits — noted here only as cross-references, not re-audited:

| Link | Linked from | Target | Covered by |
|---|---|---|---|
| "View earnings history" | `index.tsx:423` | `/earnings` | Earnings module audit |
| Active assignment "View task" | `ActiveAssignmentCard` → `openTask()` | `/pickup/[id]` or `/delivery/[id]` | Tasks module audit |
| Pickup offer "Accept" | `acceptPickupOffer()` | `/pickup/[id]` | Tasks module audit |
| Delivery offer "Accept" | `previewDeliveryQueue()` | `/delivery/[id]` | Tasks module audit |
| "See all (N)" | `index.tsx:472` | `/(tabs)/tasks` | Tasks module audit |
| Compliance banner links | `ComplianceBanner` | `/profile/edit`, `/documents` | Profile / Documents module audits |

## Data flow
All calls go through `riderFetch<T>()` (`apps/rider-mobile/src/api.ts`), which for GET delegates to
`useAuthStore.apiFetch`, and for POST/mutations goes through the offline-queue-aware
`offlineFetch`. `authRequest` unwraps the backend's `{ success, data }` envelope, so the frontend
type below is the `data` shape.

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load profile | GET | `/riders/me` | `RiderMe` | `RidersController.getMe` → `RidersService.getMe` |
| Load pickup offers | GET | `/riders/pickup-offers` | `PickupOffer[]` | `RidersController.getPickupOffers` → `PickupService.getPickupOffers` |
| Load delivery offers | GET | `/riders/delivery-offers` | `DeliveryOffer[]` | `RidersController.getDeliveryOffers` → `DeliveryService.getDeliveryOffers` |
| Load tasks (badge count only) | GET | `/riders/tasks` | `Task[]` | `RidersController.getTasks` → `RidersService.getTasks` |
| Load active assignment | GET | `/riders/active-assignment` | `ActiveAssignment \| null` | `RidersController.getActiveAssignment` → `RidersService.getActiveAssignment` |
| Load earnings | GET | `/riders/earnings` | `EarningsData` | `RidersController.getEarnings` → `RidersService.getEarnings` |
| Load notifications (badge only) | GET | `/riders/notifications?limit=50` | `{read:boolean}[]` | `RidersController.listNotifications` |
| Go online | POST | `/riders/online` | `{isOnline, shiftStatus}` | `RidersController.goOnline` → `RidersService.setOnline` |
| Go offline | POST | `/riders/offline` | `{isOnline, shiftStatus}` | `RidersController.goOffline` → `RidersService.setOnline` |
| Start break | POST | `/riders/break/start` | `{isOnline, shiftStatus}` | `RidersController.startBreak` → `RidersService.startBreak` |
| End break | POST | `/riders/break/end` | `{isOnline, shiftStatus}` | `RidersController.endBreak` → `RidersService.endBreak` |
| Accept pickup offer | POST | `/riders/pickup-offers/:orderId/accept` | pickup summary | `RidersController.acceptPickup` → `PickupService.acceptPickup` |
| GPS tick (active task only) | socket emit `riderLocation` + `queueGps` | — | — | `TrackingGateway` |

All eight `refresh()`-driving loads fire in parallel on mount/token-change and again on
pull-to-refresh (`onRefresh`); a live socket event also triggers the same `refresh()`.

## Backend trace
- `getMe` builds `RiderMe` from `Rider` + `User` (email/phone) + `UserProfile` (avatarUrl), computing
  `compliance` via `isRiderCompliant()` and only attaching `feeRates` for a non-employee,
  platform-pooled rider. It also fires `syncOverduePickupReminders` as a non-blocking side effect.
- `getPickupOffers`/`getDeliveryOffers` query unassigned, dispatched orders city-wide (no geo
  filter, `limit(20)`), and build each item via `buildPickupSummary`/`buildDeliverySummary`, which
  in turn call the shared `buildRiderTaskDetails()` (see Findings #1).
- `getActiveAssignment` finds the rider's own in-flight order (`pickupRiderId`/`deliveryRiderId`
  matches `req.user.sub`) among a fixed set of active statuses, and builds distance/ETA/workflow
  fields plus a `navigateTarget` from the pickup/delivery/shop addresses.
- `getEarnings` computes `weekEarnings`/`monthEarnings` via `RiderWalletService.sumCreditsSince`,
  `todayEarnings`/`totalEarnings` from the `Rider` document directly, and `todayPickups`/
  `todayDeliveries` via two `countDocuments` calls — 5 independent queries run via `Promise.all`,
  no N+1.
- `setOnline(true)` re-checks `isRiderCompliant()` server-side before flipping `isOnline`/
  `shiftStatus` — this matches (and is authoritative over) the frontend's own compliance gate in
  `goOnline()`.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Greeting + online pill | `name`, `online` | `online` derived from `shiftStatus === 'online'`; pill toggles `goOnline`/`goOffline` |
| Earnings grid (4 tiles) | `me.todayEarnings`, `weekEarnings`, `monthEarnings`, `me.totalEarnings` | All formatted via shared `formatCurrency`; no client math |
| "View earnings history" link | — | static nav link to `/earnings` |
| `ComplianceBanner` | `me.compliance.{isCompliant, profileGaps, documentGaps, approvedDocumentCount}` | `totalDocs` is hardcoded to `RIDER_DOCUMENT_TYPES.length` (4) client-side — must stay in sync with the backend's document-type list, which it currently does since both import the same constant |
| `LocationPermissionBanner` | `locationDenied && online` | client-derived visibility gate |
| `ShiftPanel` | `shiftStatus`, `me.compliance.isCompliant` (→`canGoOnline`), `complianceHint` (client-composed string) | shift duration/timer is entirely client-side (`Date.now()` diff), resets on unmount — not persisted, so backgrounding the app loses the "shift started" timestamp shown in the UI (cosmetic only, not used for payroll) |
| `ActiveAssignmentCard` | `orderId`, `orderNumber`, `customerName`, `bookingType`(unused — see Unused fields), `serviceType`, `status`, `leg`, `distanceKm`(unused, only `distanceLabel` rendered), `etaMinutes`(unused, only `etaLabel` rendered), `workflowStep`, `workflowTotal`, `workflowLabel`, `navigateTarget`, `me.feeRates` | Only rendered when `online && activeAssignment` truthy; fee tile only shown when `feeAmount != null` |
| `OfflineBanner` (embedded) | own hook (`useOfflineSync`) — not part of the Home fetch graph | independent state, unrelated to `refresh()` |
| Available tasks section | `visiblePickups`/`visibleDeliveries` (client-filtered by locally-dismissed IDs), `totalTaskCount` | "See all (N)" count is `visiblePickups.length + visibleDeliveries.length`, i.e. excludes items the rider dismissed this session (dismissal is in-memory only, not persisted or sent to backend — reappears on next `refresh()`) |
| `PickupOfferCard` | `offer.scheduledPickupAt` (→formatted time), `offer.pickupAddress.{label,city}`, `shopName` | `offer.status`, `offer.bookingType` fetched but not rendered on this card (see Unused fields) |
| `DeliveryOfferCard` | `offer.deliveryAddress.{label,city}`, `shopName` | same unused fields as pickup card |
| `RouteGuideCarousel` | `routeProgressIndex` (client-derived 1-4 via `getRouteProgressIndex`) | hardcoded step thresholds in `route-progress.ts`, cosmetic only |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Go online | no | no (immediate) | **yes (fixed)** | yes |
| Go offline | no | no | **yes (fixed)** | **yes (fixed)** |
| Start break | no | no | **yes (fixed)** | **yes (fixed)** |
| End break | no | no | **yes (fixed)** | yes |
| Accept pickup offer | no (claims a job, but rejectable later) | no | **yes (fixed)** | yes (already handled) |
| Decline pickup/delivery offer (local dismiss) | no — client-only, not a backend call | n/a | n/a | n/a |

## Authorization
No `[authz]` issues found. Every endpoint Home calls is `@UseGuards(JwtAuthGuard, RolesGuard)` +
`@Roles(UserRole.RIDER)` at the controller (`apps/api/src/modules/riders/riders.controller.ts`),
and every service method scopes its query/update to `req.user.sub` (or, for the offer lists,
returns orders with no rider assigned yet — appropriate for a browse-before-claim list). The pickup
accept path (`PickupService.acceptPickup`) does an atomic `findOneAndUpdate` re-checking
`pickupRiderId: { $exists: false }` at write time, so two riders can't both claim the same offer.
No request parameter widens any of these queries past the caller's own `userId`.

## Findings

1. **Full customer address and name are sent to every online rider for every open, unclaimed
   pickup/delivery offer — before they've accepted it.** `PickupService.buildPickupSummary`
   (`apps/api/src/modules/riders/pickup.service.ts:508-540`) and
   `DeliveryService.buildDeliverySummary` (`apps/api/src/modules/riders/delivery.service.ts:582-`)
   both call `buildRiderTaskDetails()` (`apps/api/src/modules/riders/rider-task-summary.ts:102-116`),
   which always returns `customerName` and the customer's full `line1`/`line2`/`latitude`/
   `longitude` regardless of whether the requesting rider has claimed the order — only the
   *phone number* is gated by `includeDialablePhone`. `getPickupOffers()`/`getDeliveryOffers()`
   have no geo-scoping (any online rider system-wide sees the same 20 offers), so this is full
   street-level address + customer name broadcast to every online rider browsing offers, not just
   the one who eventually accepts. The Home page's own cards (`PickupOfferCard`/`DeliveryOfferCard`)
   only read `pickupAddress.label`/`.city` — matching the frontend `PickupOffer`/`DeliveryOffer`
   types, which correctly declare only `{label, city}` — so this over-broad payload is unused here.
   However, the pickup detail sub-page (`apps/rider-mobile/app/pickup/[id].tsx:399,430-484`) *does*
   render `customerName` and `pickupAddress.line1` unconditionally, including while an order is
   still in the unassigned "offer" state reachable from that page — so the same backend fields are
   legitimately relied on outside this module.
   **Fix (2026-09-02, applied after the Tasks module audit completed so both were consistent):**
   `buildRiderTaskDetails()` (`apps/api/src/modules/riders/rider-task-summary.ts`) now takes an
   explicit `isAssigned` option, separate from `includeDialablePhone` (the two aren't always equal
   — `RidersService.getMe`'s active-assignment summary passes `includeDialablePhone: false` for an
   already-assigned rider, so phone-gating and PII-gating needed independent flags). When
   `isAssigned` is false, `customerName` is masked to first-name + last-initial (`maskName`) and
   `customerAddress` drops `line1`/`line2`/`latitude`/`longitude`, keeping only `city`/`province`
   (`maskAddressLine`) — enough for a rider to judge a job's general area without full street-level
   PII pre-accept. All three call sites updated: `pickup.service.ts`'s and `delivery.service.ts`'s
   `buildPickupSummary`/`buildDeliverySummary` now pass `isAssigned` (same value already computed
   for `includeDialablePhone`), and `riders.service.ts`'s active-assignment summary passes
   `isAssigned: true` (that caller is always for the rider's own claimed task). `apps/api`
   typechecks clean. The pickup/delivery detail sub-pages inherit this automatically since they
   read the same `buildRiderTaskDetails()` response — verified they already handle an
   undefined/partial address gracefully (optional chaining throughout), so no frontend change was
   needed for the pre-accept masked state.**

2. `acceptPickupOffer` in `rider-operations.tsx` had no error handling — a failed accept (e.g.
   "Pickup no longer available" from the atomic claim, or a network drop) would leave an unhandled
   promise rejection with no user feedback, unlike `goOnline` which already wraps its POST in
   try/catch + `Alert.alert`.
   **Fix: already present in the codebase at the time of this audit** (`apps/rider-mobile/src/context/rider-operations.tsx:338-350`) — `acceptPickupOffer` now wraps the accept call in try/catch and shows `Alert.alert('Could not accept pickup', …)` on failure, matching the `goOnline` pattern. No further change needed.

3. No double-submit guard on any shift-toggle button (online pill, `ShiftPanel`'s Go
   offline/Take a break/End shift/Resume shift/Start shift) or the pickup offer Accept button — a
   fast double-tap could fire two `POST /riders/online` (etc.) or two accept requests before the
   first resolves. The backend mutations are idempotent-ish for shift toggles (just overwrite the
   same two fields) but the duplicate network traffic and inconsistent in-flight UI state (pill
   flickers, `Alert` could fire twice) are still real. `goOffline`/`startBreak` additionally had no
   error handling at all before this fix, unlike `goOnline`/`endBreak`.
   **Fix:** added `shiftBusy`/`acceptingOfferId` state to `RiderOperationsProvider`
   (`apps/rider-mobile/src/context/rider-operations.tsx`), guarding re-entry at the top of
   `goOnline`/`goOffline`/`startBreak`/`endBreak`/`acceptPickupOffer` and wrapping
   `goOffline`/`startBreak` in try/catch + `Alert.alert` (bringing them in line with
   `goOnline`/`endBreak`). Wired `shiftBusy` into `ShiftPanel` (new `busy` prop, disables all five
   shift buttons — `apps/rider-mobile/src/components/ui/shift-panel.tsx`) and into the header
   online/offline pill (`apps/rider-mobile/app/(tabs)/index.tsx`); wired `acceptingOfferId` into
   `PickupOfferCard` (new `accepting` prop, disables Accept/Decline and shows "Accepting…" —
   `apps/rider-mobile/app/(tabs)/index.tsx`). `ShiftPanel` is only used on this Home screen, so no
   other page is affected by the new prop.

4. `ActiveAssignment.bookingType` and `ActiveAssignment.distanceKm`/`etaMinutes` are fetched but
   `ActiveAssignmentCard` only renders the pre-formatted `distanceLabel`/`etaLabel` (`bookingType`
   isn't rendered at all). Low severity — none of these are sensitive, and `distanceKm`/`etaMinutes`
   are the raw numbers behind the labels the backend already formats, plausibly kept for a future
   sort/threshold use.
   **Fix: left unfixed — cosmetic/dead-field only, not worth a backend contract change for 3
   numeric fields with no sensitivity.**

5. Dismissing a pickup/delivery offer card (`setDismissedPickup`/`setDismissedDelivery` in
   `index.tsx:345-350`) is purely local/in-memory state — it isn't a backend call (matches the
   Mutations table's "not a real mutation" note) and isn't persisted, so a dismissed offer
   reappears on the next `refresh()` (pull-to-refresh, socket-triggered refresh, or app foreground).
   **Fix: left unfixed — this is a product/UX call (should "decline" persist across refreshes,
   and should it call `POST /riders/pickup-offers/:id/reject` instead of just hiding locally?);
   out of scope for a data-flow audit to decide unilaterally.**

## Unused/dead fields
- `RiderMe.fixedWageAmount` / `RiderMe.wageFrequency` — returned by `serializeMePayload`
  (`apps/api/src/modules/riders/riders.service.ts:197-198`) but absent from the frontend `RiderMe`
  type and not read anywhere in `rider-operations.tsx` or `index.tsx`. Not sensitive (it's the
  rider's own wage data), just dead payload on this screen — likely intended for a wage-display
  page not yet built, or already covered by the Profile module.
- `PickupOffer.status` / `PickupOffer.bookingType`, `DeliveryOffer.status` / `.bookingType` — sent
  by the offers-list endpoints and declared on the frontend type, but not read by
  `PickupOfferCard`/`DeliveryOfferCard` on this Home screen (the "PICKUP"/"DELIVERY" pill text is
  a hardcoded literal in each card, not derived from `bookingType`). Low severity — same type is
  shared with the Tasks tab, which may use these fields there.
- `ActiveAssignment.bookingType`, `.distanceKm`, `.etaMinutes` — see Finding #4.
- See Finding #1 for the higher-severity case (`customerName` + full address on the offers list) —
  that one is unused **and** sensitive, unlike the fields above.

## Loading/error/realtime behavior
- Each of the 7 `load*` functions in `rider-operations.tsx` independently try/catches its own
  fetch and falls back to an empty/null value on failure (`setMe(null)`, `setOffers([])`, etc.) —
  a failed refresh silently wipes previously-shown data rather than preserving the last-good state
  and surfacing an error banner. There's no shared `useAsyncQuery`-style hook here; each loader is
  hand-rolled with the same catch-and-reset shape. This means a single flaky request (e.g. earnings
  timing out) resets that one card to its zero/empty state on the next `refresh()`, even though the
  rest of the screen keeps working — inconsistent partial-failure UX, but not incorrect per se.
  Flagged as an observation, not fixed: changing 7 call sites' error-recovery behavior is a larger
  UX decision (show stale data + toast vs. reset to empty) better made once, consistently, possibly
  in a shared hook — out of scope for a single-page fix.
- Initial loading state: `Screen`'s `RefreshControl` only reflects `refreshing` (set during
  pull-to-refresh / `onRefresh`), not the very first mount fetch — there's no skeleton/spinner for
  the first render, so the screen briefly shows zeroed earnings cards and no offers until the
  initial `refresh()` (fired from the `accessToken` effect) resolves. Consistent with how the rest
  of the app appears to handle first-load (no loading skeleton pattern found elsewhere in this
  file), so not flagged as a regression, just noted.
- Empty state: when `totalTaskCount === 0`, the "Available tasks" section is omitted entirely
  (`index.tsx:467`) rather than showing an explicit empty message — acceptable given the rest of
  the dashboard (earnings, shift panel) still renders.
- Realtime: `useRiderDispatchSocket` connects once per `accessToken`/`userId` change, joins
  `joinRider`/`joinRiders`/per-order rooms, and calls the same `refresh()` used by pull-to-refresh
  on every dispatch event (`pickupOffer`, `deliveryOffer`, `pickupAssignment`, `deliveryAssignment`,
  `riderNotification`, `orderStatusUpdate`, `orderEvent`) plus on `AppState` foreground — correctly
  scoped (doesn't refetch on unrelated events) and doesn't double-fetch (single `refresh()` call
  per event, no overlapping interval polling). The GPS location tick (`RIDER_GPS_UPDATE_INTERVAL_MS`)
  is scoped to `activeOrderId && online`, so it doesn't run when idle.
