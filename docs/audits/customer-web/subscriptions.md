# Audit: Customer-web — Subscriptions

Date: 2026-08-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/subscriptions/page.tsx` (`'use client'`)
- Component(s): `PageShell`, `PageHeader`, `DataPageStatus`, `Card`/`CardBody`, `Button`

## Sub-pages
None — no outbound navigation into a detail route. Each subscription is managed inline on the list (pause/resume, cancel).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List subscriptions | GET | `/subscriptions` | `SubscriptionRow[]` | `SubscriptionsController.findAll` -> `SubscriptionsService.findAll` |
| Toggle active/paused | PATCH | `/subscriptions/:id` | `{ active: boolean }` body, response unused | `SubscriptionsController.update` -> `SubscriptionsService.update` |
| Cancel | DELETE | `/subscriptions/:id` | response unused | `SubscriptionsController.remove` -> `SubscriptionsService.remove` |

## Backend trace
`SubscriptionsController` is class-level gated with `@Roles(UserRole.CUSTOMER)` plus `JwtAuthGuard`/`RolesGuard`. All three service methods scope by `{ userId: new Types.ObjectId(userId) }` (or `_id + userId` for update/remove) taken from `req.user.sub`, so a customer can't touch another customer's subscription by guessing an `_id`. `findAll` sorts by `createdAt: -1` and returns the raw Mongoose documents (no field projection). `create` (not used by this page — subscriptions are created from the checkout flow, not from this page) reuses `BookingService.prepareOrderPayload` to validate the same pricing/availability rules as a one-off booking, and re-books only the first (`dto.services[0]`) selected service on each recurring run. `update` only ever applies `dto.active`, ignoring any other field the DTO doesn't declare (`UpdateSubscriptionDto` only has `active`). `remove` does a straight `deleteOne` scoped by owner — no soft-delete/audit trail on cancellation, but that matches other one-shot destructive deletes in this app (e.g. `orders/page.tsx`'s pending-order delete).

A `SubscriptionsSchedulerService` (`subscriptions-scheduler.service.ts`, not traced in depth here since it isn't reached from this page) presumably runs `nextRunAt`-due subscriptions and would be the source of `lastError`/`lastRunAt`/`lastOrderId`.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Subscription row | `bookingType` (formatted via `.replace(/_/g, ' ')` + `capitalize`), `active` (-> "Active"/"Paused" pill, client-derived color classes), `frequencyDays` (-> `FREQUENCY_LABELS` lookup, falls back to `Every N days`), `nextRunAt` (formatted `en-PH` short date), `lastError` (shown as inline red text if present) | `FREQUENCY_LABELS` is a small hardcoded client map (`{7,14,30}`) that must stay in sync with the `IsIn([7,14,30])` constraint in `CreateSubscriptionDto` — low risk since both are effectively fixed enums, but noted per the audit template's "hardcoded/unconfigurable values" guidance |
| Pause/Resume button | `item.active` (for label), toggles via PATCH | |
| Cancel button | none rendered beyond the label, deletes via DELETE | |
| Empty state | none | shown when `!loading && !error && list.length === 0` |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Pause/Resume (`toggleActive`) | no | n/a | yes — `disabled={actioningId === item._id}` while in flight | yes, after fix (see Findings #2) |
| Cancel (`cancelSubscription`, DELETE) | yes — permanently deletes the subscription document, no undo | yes, after fix (see Findings #1) | yes — same `actioningId` guard | yes, after fix (see Findings #2) |

## Authorization
All three endpoints are `@Roles(UserRole.CUSTOMER)`-gated and every service method filters by the authenticated `userId`, so a subscription id can't be used to read/mutate another customer's data. No `[authz]` issues.

## Findings

1. **Cancel had no confirmation dialog for a destructive, irreversible delete.** `subscriptions/page.tsx`'s `cancelSubscription` called `api.delete(...)` directly from the button's `onClick`, with no `window.confirm` — a single misclick permanently deletes a recurring pickup schedule with no undo, unlike this app's established pattern for destructive deletes (`window.confirm` is used for the equivalent action in `orders/page.tsx:122` and `profile/page.tsx:166`).
   **Fix:** added a `window.confirm(...)` guard before the delete call, matching the existing app convention. `apps/customer-web/src/app/(authenticated)/subscriptions/page.tsx` (`cancelSubscription`).

2. **Mutation failures were silently swallowed.** Both `toggleActive` and `cancelSubscription` had a `try { ... } finally { setActioningId(null) }` with no `catch` — a failed PATCH/DELETE (network error, 404 because the item was already removed elsewhere, etc.) left the button re-enabled but gave the customer no indication anything went wrong; the list would just look unchanged with no explanation.
   **Fix:** added `catch (e) { setActionError(...) }` to both handlers and render the message via a new `actionError` state under `DataPageStatus`, matching the error-surfacing pattern already used in `orders/page.tsx`'s `cancelOrder`. `apps/customer-web/src/app/(authenticated)/subscriptions/page.tsx`.

3. **`update`'s response and `remove`'s response are fetched but never used.** After a successful PATCH/DELETE the page calls `reload()` instead of using the mutation's own response body, causing a redundant `GET /subscriptions` round-trip on every pause/resume/cancel. This is a minor inefficiency, not a bug — the `SubscriptionsService.update`/`remove` responses (`{ success, data: subscription }` / `{ success, data: { deleted: true } }`) don't include the full updated list anyway, so a full reload is arguably the simplest correct approach here (same pattern as `rewards/page.tsx`'s `redeem` -> `reload()`). Left as-is — not worth adding local list-splicing logic for a low-traffic page with normally very few rows.

## Unused/dead fields
The backend's `findAll` returns full Mongoose documents including `branchId`, `bagSizeId`, `enteredWeightKg`, `enteredLoadCount`, `enteredPieceCount`, `addonIds`, `couponCode`, `pickupAddressId`, `deliveryAddressId`, `lastRunAt`, `lastOrderId`, `createdAt`, `updatedAt` — none of these are in the frontend's `SubscriptionRow` type or rendered. None are sensitive (all are the customer's own order-configuration data, no PII/auth material), so this is dead payload rather than a security finding — flagged for awareness only. A customer might reasonably want to see which branch/bag size/addons a recurring pickup re-books (e.g. to remember what they subscribed to), so exposing `bagSizeId`/`addonIds`/`branchId` as human-readable labels could be a legitimate future UX improvement, but that's a product decision outside this audit's fix scope.

## Loading/error/realtime behavior
Uses the shared `useCustomerQuery` hook (same as `rewards`/`refunds`) — a failed `reload()` sets `error` without clearing previously-loaded `data`, so a transient refresh failure doesn't blank out the list. `DataPageStatus` handles the loading/error display for the initial/reload fetch; mutation-specific errors now surface separately via the new `actionError` state (see Findings #2) since they're a different failure mode than the list fetch itself. No polling or realtime subscription — the list only updates on manual pause/resume/cancel or a full page reload; `lastError`/`lastRunAt` (set by the scheduler running in the background) won't appear until the customer manually reloads the page.

## UI/UX notes
- Pause/Resume and Cancel are both rendered as equal-weight `variant="outline"` buttons side by side (`page.tsx:117-136`) — Cancel is a destructive, irreversible action but has no visual distinction (e.g. a `text-red-600`/danger variant) from the non-destructive Pause/Resume toggle, so the two are easy to confuse at a glance despite very different consequences. Left as a note rather than fixed inline since `@lunara/ui`'s `Button` doesn't appear to expose a "danger" variant elsewhere in this codebase to reuse consistently (a new variant would need design-system buy-in beyond this audit's scope).
- The "Active"/"Paused" status pill and the frequency/next-run line are good use of existing conventions (matches the badge-pill pattern used on `/refunds` and `/orders`).
- Empty state message is clear and actionable ("After placing an order, you'll be offered the option to repeat it automatically"), consistent with other modules' empty-state tone.
- No visual indicator differentiates "this subscription's toggle is currently loading" beyond the button becoming disabled — a brief inline spinner or label change (e.g. "Pausing…") like `rewards/page.tsx`'s `redeemingId === item.id ? 'Redeeming…' : ...` pattern would give clearer in-flight feedback; left as a minor polish note, not fixed given it's cosmetic only and the disabled state already prevents double-submit.
