# Audit: Customer-mobile — Subscriptions

Date: 2026-08-23

## Entry point
- Screen: `apps/customer-mobile/app/subscriptions/index.tsx`
- Component(s): none beyond the screen itself — uses shared `Card`, `Button`, `DataLoadState`, `KeyboardSafeScrollView` from `apps/customer-mobile/src/components`.

## Sub-pages
None — no outbound navigation into a detail route. The screen is a single flat list of the customer's recurring pickups with inline pause/resume/cancel actions; there is no subscription creation screen reachable from here (subscriptions are created elsewhere, from the booking flow, per the service comment at `apps/api/src/modules/subscriptions/subscriptions.service.ts:23-27`).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load list | GET | `/subscriptions` | `SubscriptionRow[]` | `SubscriptionsController.findAll` -> `SubscriptionsService.findAll` |
| Pause/Resume | PATCH | `/subscriptions/:id` | `{ active: boolean }` -> unused response | `SubscriptionsController.update` -> `SubscriptionsService.update` |
| Cancel | DELETE | `/subscriptions/:id` | unused response | `SubscriptionsController.remove` -> `SubscriptionsService.remove` |

`apiFetch` (`apps/customer-mobile/src/store/auth.ts:193-207`, via `authRequest` at line 37-77) already unwraps the API's `{ success, data }` envelope and returns `body.data`, so the frontend's `SubscriptionRow[]` type correctly matches the array the service returns inside `data`.

## Backend trace
`SubscriptionsController` (`apps/api/src/modules/subscriptions/subscriptions.controller.ts`) is guarded by `JwtAuthGuard` + `RolesGuard` with `@Roles(UserRole.CUSTOMER)` at the class level — every route requires an authenticated customer. `findAll` queries `subscriptionModel.find({ userId })` sorted by `createdAt desc` — single indexed field (`userId` has `index: true` in the schema), no N+1. `update` and `remove` both scope their Mongo filter to `{ _id: id, userId }` together, so a customer cannot touch another customer's subscription via `:id` regardless of what id is passed — `NotFoundException` is thrown otherwise. `create` (not called from this screen, but part of the same service) reuses `BookingService.prepareOrderPayload` for pricing/availability validation before persisting.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Subscription row (`Card` per item) | `bookingType` (title, `_`->space, capitalized), `active` (pill color/text), `frequencyDays` (mapped through `FREQUENCY_LABELS`), `nextRunAt` (formatted `en-PH` short date), `lastError` (shown conditionally in red) | `FREQUENCY_LABELS` (`index.tsx:20`) is a hardcoded client-side map for 7/14/30 days with a `Every N days` fallback — matches the DTO's `IsIn([7,14,30])` constraint, so no drift risk today, but the two lists (frontend map, backend DTO enum) must be kept in sync manually if new frequencies are ever added. |
| Empty state (`Card muted`) | none (static copy) | Static text only. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Pause/Resume (PATCH) | no | n/a | yes — `Button disabled={actioningId === item._id}` | now yes (fixed) |
| Cancel (DELETE) | yes | now yes (fixed) | yes — same `actioningId` guard | now yes (fixed) |

## Authorization
`@Roles(UserRole.CUSTOMER)` on the controller matches the frontend, which only ever calls this route from an authenticated customer screen. `update`/`remove` filter by `{ _id, userId: req.user.sub }` together — a customer cannot widen scope by passing another customer's subscription id; the query simply returns no match and the service throws `NotFoundException`. No `[authz]` findings.

## Findings

1. **Cancel had no confirmation dialog for a destructive, irreversible action.** `cancelSubscription` (`apps/customer-mobile/app/subscriptions/index.tsx`, previously lines 68-76) called `DELETE /subscriptions/:id` directly from the button's `onPress` with no confirm step, unlike the equivalent delete flow in `apps/customer-mobile/app/(tabs)/profile.tsx:221-240` (`confirmDeleteAddress` uses `Alert.alert` with a destructive-style confirm action).
   **Fix:** Added `confirmCancelSubscription` using the same `Alert.alert(title, message, [Cancel, {style:'destructive', onPress}])` pattern as `profile.tsx`, wired to the Cancel button's `onPress`. `apps/customer-mobile/app/subscriptions/index.tsx`.

2. **Pause/Resume and Cancel swallowed failures — no error surfaced to the user.** Neither `toggleActive` nor `cancelSubscription` had a `catch` block; a failed request became an unhandled promise rejection (silently logged/ignored in RN, no user-facing feedback), unlike `profile.tsx:232-234` which shows `Alert.alert('Could not delete', ...)` on failure.
   **Fix:** Added `try/catch` with `Alert.alert('Could not update'/'Could not cancel', ...)` around both mutations in `apps/customer-mobile/app/subscriptions/index.tsx`.

3. **A failed refresh hides the previously-loaded list, not just a banner.** `{!loading && !error ? (...) : null}` (`index.tsx`) means that once `error` is set (e.g. pull-to-refresh fails after initial load succeeded), the entire items list unmounts and only the `DataLoadState` error banner shows — the user loses sight of subscriptions they already saw, not just a "couldn't refresh" notice. This is a shared pattern, not unique to this screen: the same `!loading && !error ?` gating appears in `apps/customer-mobile/app/(tabs)/profile.tsx`, `apps/customer-mobile/app/refunds/index.tsx`, `apps/customer-mobile/app/(tabs)/wallet.tsx`, and `apps/customer-mobile/app/support/index.tsx` — 4 other screens share this exact behavior.
   **Fix: left unresolved.** This is a cross-cutting UX pattern spanning 5 screens sharing no common hook (each screen re-implements its own `loading`/`error`/`items` state), so fixing it safely means changing the list-render condition to key off `items.length` instead of `!error` consistently across all 5 — a coordinated change outside this module's scope. Noted here for a follow-up pass across the affected screens.

## Unused/dead fields
`lastRunAt` and `lastOrderId` are present on the `Subscription` schema (`apps/api/src/modules/subscriptions/schemas/subscription.schema.ts:52-56`) and are returned as part of the raw Mongoose document in `findAll`'s `data` array, but the frontend's `SubscriptionRow` type doesn't declare or render them. Neither is sensitive (no PII/auth material), so this is dead payload only, not a security finding — worth trimming if the response is ever restructured to project explicit fields, but not urgent.

## Loading/error/realtime behavior
Initial load and pull-to-refresh both go through the same `load()` function and shared `DataLoadState` component (loading spinner, error text + retry button). No sockets or polling — refresh is purely user-triggered (pull-to-refresh) or after a mutation (`toggleActive`/cancel both call/rely on `load()` or local state update). See Finding 3 for the shared failed-refresh behavior affecting 4 other screens.
