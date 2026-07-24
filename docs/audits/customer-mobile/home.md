# Audit: Customer-mobile — Home (tabs index)

Date: 2026-07-23

## Entry point
- Screen: `apps/customer-mobile/app/(tabs)/index.tsx` — thin composition screen, all data via `useHomeDashboard`
- Component(s): `HomeWelcomeBanner`, `HomeQuickActions`, `DealsCarousel`, `HomeReferralPromo`, `HomeActiveOrders`, `HomeRecommendedServices`

## Sub-pages
Not detail routes in the audit sense, but the widgets navigate into several other screens: `/book` (booking, not yet audited), `/(tabs)/orders` (order list), `/orders/:id` (order detail), `/rewards`. None of these are traced further here — each is its own module.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Profile + orders | GET | `/customers/me`, `/orders` (parallel, via `useHomeDashboard`) | `CustomerProfile`, `{ items: HomeOrderRow[] }` | `CustomersController.getMe`, `OrdersController.findAll` — same endpoints already traced in `docs/audits/customer-web/dashboard.md` |
| Deals (via `DealsCarousel`) | GET | `/deals` | `Deal[]` | not re-traced here — self-contained widget with its own loading/error/retry |
| Referral code (via `HomeReferralPromo`) | GET | `/rewards/me/referral-code` | `{ referralCode: string }` | `RewardsController.getReferralCode` — already traced in `docs/audits/customer-web/rewards.md` |

## Backend trace
`/customers/me` and `/orders` are the same endpoints already fully traced for customer-web's dashboard — no new backend behavior. `useHomeDashboard`'s `load()` correctly does **not** wipe `profile`/`orders` on a fetch error (no `setProfile(null)`/`setOrders([])` in the catch, `use-home-dashboard.ts:34-36`) — this mobile hook already follows the "preserve data on error" convention that had to be *fixed* into several of customer-web's hooks during this audit series; confirmed correct here without needing a fix.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Welcome banner | `profile.firstName/lastName`, `user.email/phone` (via `getDisplayName` fallback chain), time-of-day greeting (client-computed) | |
| Quick actions | static 4-tile grid; "Track Order" routes to `activeOrders[0]._id` if one exists, else the orders tab | |
| Deals carousel | self-contained (`/deals`), own loading/error/retry, tap-to-retry on failure | |
| Referral promo | `referralCode` (optional — falls back to a generic share payload if the fetch fails or hasn't resolved yet) | fetch error is silently swallowed (`.catch(() => {})`) — acceptable here since this is non-critical promotional content with a sensible fallback, unlike the core dashboard fetch (see Finding #1) |
| Active orders | `activeOrders` (derived: `orders.filter(isActiveOrderStatus)`), sliced to 3; per-order `_id`, `bookingType`, `status`, `scheduledDeliveryAt` | |
| Recommended services | static `RECOMMENDED_SERVICES` catalog, routes to `/book` with a pre-selected service type | |

## Mutations
None — this screen is entirely read-only/navigational. Pull-to-refresh (`RefreshControl`) re-runs `useHomeDashboard`'s `load()`.

## Authorization
Both core endpoints (`/customers/me`, `/orders`) are already confirmed scoped to the authenticated user in `docs/audits/customer-web/dashboard.md`; this screen calls the same backend. No `[authz]` issues.

## Findings

1. **[FIXED] `useHomeDashboard`'s `error` was computed and returned by the hook but never read by the screen at all** — `(tabs)/index.tsx` destructured `{ user, profile, activeOrders, loading, refresh }`, dropping `error` on the floor. A failed initial load (or a failed realtime-triggered reload) left the customer looking at an empty/stale dashboard with zero indication anything had gone wrong and no way to retry beyond guessing to pull-to-refresh — the exact "silently swallowed error" bug class flagged repeatedly across this audit series, except here the error wasn't even swallowed in the hook (it's tracked correctly), just never surfaced by the screen consuming it.
   **Fix:** the screen now reads `error` from the hook and renders it via the existing shared `DataLoadState` component (`components/data-load-state.tsx` — the mobile equivalent of customer-web's `DataPageStatus`, confirmed already used by 15+ other mobile screens/components, e.g. `DealsCarousel`'s own error box) with `onRetry={refresh}`, placed right below the welcome banner so it doesn't block the rest of the (possibly stale-but-still-useful) dashboard content underneath.

## Unused/dead fields
None beyond the `error` field covered in Finding #1.

## Loading/error/realtime behavior
`useHomeDashboard` also reloads on `useOrderRealtimeStore`'s `tick` (a socket-driven counter bumped elsewhere in the app on order events) — confirmed this reload path is wrapped in `.catch(() => {})` at the call site (`use-home-dashboard.ts:47`), which is fine since a failed realtime-triggered reload now surfaces through the same `error` state the initial load uses, rather than needing its own handling. Pull-to-refresh is a separate `refreshing` boolean local to the screen, correctly scoped so the `RefreshControl` spinner doesn't stay stuck if `refresh()` throws (wrapped in try/finally).
