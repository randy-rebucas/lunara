# Audit: Customer-mobile — Splash (root marketing/entry screen)

Date: 2026-07-24

## Entry point
- Page: `apps/customer-mobile/app/index.tsx` (`SplashScreen`) — the app's root route (`/`).
- Component(s): shared `BrandMark`, `Button`, `Card`, `Screen` UI primitives. No data-fetching component of its own.

## Sub-pages
None — this screen only links (via `<Link>`, not a data-carrying navigation) to `/(auth)/signup` and `/(auth)/login`, both static auth entry points already covered elsewhere ([login.md](login.md), [signup.md](signup.md)).

## Data flow
None — fully static marketing content (feature cards, payment-method logos, a promo banner), no network calls of its own.

## Backend trace
Not applicable — no endpoint involved from this screen directly. However, this screen's *reachability* is gated by global auth-redirect logic in `apps/customer-mobile/app/_layout.tsx`, which is the actual subject of this audit's one real finding.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Hero (brand, title, tagline) | `appConfig.name`, `appConfig.tagline` (from `@lunara/config`) | correctly centralized, not hardcoded |
| Actions card (Get started / Sign in) | static | trust-row and payment-method logos (`PAYMENT_METHODS`, `index.tsx:17`) are hardcoded display copy — reasonable for marketing content, not data that needs a backend source |
| Feature cards (×3) | static | — |
| Promo banner ("Get 20% off") | static | a hardcoded promo claim with no backend/promotions-service check behind it — if the "20%" first-order promo is ever changed or retired, this screen's copy has to be manually updated in code rather than reflecting a real, configurable promotion. Not fixed here: making this data-driven (reading from `@lunara/utils`'s promotions config or an API) is a product/feature decision, not a bug — the copy isn't currently wrong, just not backed by a live source. |

## Mutations
None.

## Authorization
Not applicable in the usual sense (no protected data), but see Findings #1 — this screen's *visibility* to already-authenticated users was the actual authorization-adjacent bug here (not a data leak, but a navigation-state bug: showing a "please sign up/sign in" screen to someone already signed in).

## Findings

1. **A signed-in user relaunching the app could land back on the marketing/sign-up splash instead of their tabs home — `[fixed]`.** `apps/customer-mobile/app/_layout.tsx`'s `isPublicRoute` (`_layout.tsx:67-77`, pre-fix) treats `segments[0] === 'index'` as a public route — necessary so a signed-out user isn't force-redirected to `/login` while viewing the marketing splash. But the root auth-redirect effect (`_layout.tsx:123-181`) only ran its "signed in → send onward" logic (`redirectAfterAuth`, which checks onboarding completion and routes to `/onboarding/*` or `/(tabs)`) for `segs[0] === '(auth)'` — it never checked for `segs[0] === 'index'`. Since Expo Router's root path on a fresh app launch is always `/` regardless of stored auth tokens, **every signed-in customer relaunching the app after a full app close would see this "Get started / Sign in" splash screen first**, rather than being sent straight to their tabs (or the correct onboarding step) — a customer with a perfectly valid session would appear logged out until they noticed and manually navigated away, or would be confused into re-signing-in unnecessarily. This is the single most consequential thing this audit found in this file, precisely because the file itself is otherwise inert (static marketing copy) — the bug lived entirely in the surrounding layout's routing logic, not in `index.tsx`.
   **Fix:** extended the signed-in redirect condition in `_layout.tsx` from `segs[0] === '(auth)'` to `segs[0] === '(auth)' || segs[0] === 'index'` (`apps/customer-mobile/app/_layout.tsx`), reusing the exact same `redirectAfterAuth` call already used for the post-login/signup case — so a signed-in user hitting `index` now gets the same onboarding-aware redirect a fresh login would produce, while a signed-out user still sees the splash normally (unaffected, since the `!signedIn` branch above it is untouched and index remains in `isPublicRoute` for that path). No other consumer of `isPublicRoute`/this effect needed re-checking — it's the single root layout for the whole app, not a shared hook used elsewhere.

## Unused/dead fields
Not applicable — no API payload.

## Loading/error/realtime behavior
Not applicable to this screen directly — global auth hydration/loading state (`isLoading` from `useAuthStore`) is handled once in `_layout.tsx` before any route (including this one) renders, showing a loading gate rather than flashing the splash before tokens are known.
