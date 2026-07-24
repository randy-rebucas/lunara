# Audit: Partner-web — Login

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/login/page.tsx`
- Component(s): inline in the page file, no separate component

## Sub-pages
None — no outbound navigation into a dynamic detail route.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Sign in | POST | `/auth/login` | inline `{ email, role, branchId }` -> `PortalUser` (`lib/partner-api.ts`'s `staffLogin`) | `AuthController.login` -> `AuthService.login` (shared with admin-web, customer-web, riders — see `docs/audits/admin-web/login.md`) |

## Backend trace
Same shared `/auth/login` endpoint traced in `docs/audits/admin-web/login.md`:
throttled (`AUTH_THROTTLE`, 10/min/IP), sets an `httpOnly` `portal_token`
cookie (7-day `maxAge`) alongside the JSON token pair. `AuthService.buildAuthResponse`
signs the access token with the app-wide default `expiresIn: '7d'`
(`auth.module.ts:25-28`) and a separate 30-day refresh token, persisted
server-side via `otpService.storeRefreshToken` (`auth.service.ts:301-313`).
The access token's real 7-day expiry lines up with the cookie's `maxAge`, so
the two don't disagree here (unlike a case where a cookie outlives its
token) — but see Finding #1 for what partner-web does with the refresh token
it's also handed.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Email / password fields | local `email`/`password` state, pre-filled with `partner@lunara.dev` / `password123` in development builds only (`isDev = process.env.NODE_ENV === 'development'`, build-time constant, not attacker-controllable in production) | |
| Dev credential hint | `isDev` | same pattern as `admin-web`'s dev login hint, text-only there vs. actually pre-filling the inputs here — equally harmless since both are gated on a build-time env check |
| Error banner | `error` (from thrown `Error.message`) | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Sign in | no | n/a | yes (`disabled={loading}`) | yes (`alert-error`, entered credentials preserved for retry) |

## Authorization
`POST /auth/login` itself has no role guard (shared across every client app). The partner-portal-specific gate is client-side in `staffLogin` (`lib/partner-api.ts:50-71`): it rejects (throws before persisting anything) unless the returned `role` is `staff`, `partner`, or `admin` — matching every downstream `/partner/*` route, which are all independently role-guarded server-side regardless of what this page does, so a bypass of this client check would still be turned away by the API. No `[authz]` gap.

## Findings

1. **Partner-web never captures or uses the refresh token — sessions can't silently renew and always require a full re-login after 7 days.** `staffLogin` (`lib/partner-api.ts:50-71`) reads `body.data.tokens.accessToken` and stores it, but never reads `body.data.tokens.refreshToken` at all — it's silently discarded. Contrast with `admin-web`'s `admin-api.ts`, which stores the refresh token, computes `expiresAt`, and proactively calls `/auth/refresh` shortly before the access token expires (`scheduleTokenRefresh`, `refreshAccessToken`) so an active admin session renews indefinitely without the user noticing. Partner-web has none of that: once the 7-day access token expires, `partnerFetch` gets a 401, clears the token, and hard-redirects to `/login` (`lib/partner-api.ts:104-109`) — a partner or shop-staff user who's been actively using the portal gets abruptly logged out with no warning, unlike their admin-web counterpart.
   Left unfixed: porting `admin-web`'s refresh-scheduling logic into `partner-api.ts` is a well-understood, mechanical change (the reference implementation already exists and works), but it touches the session model used by every authenticated call in this app (`partnerFetch`, `uploadShopLogo`, `uploadAvatar`, `uploadProcessingPhoto`, `fetchAuthenticatedMediaUrl`, plus whatever reads `getPartnerToken()` for socket auth) — too broad a change to make safely as a login-page-scoped fix without a dedicated pass over all of `partner-api.ts` and its consumers. Flagging as the highest-priority finding here since it's a real, everyday reliability gap (not a security hole), not deferring it silently.

2. **[FIXED] No redirect-away-if-already-signed-in check.** Unlike `admin-web`'s login page (`useEffect` that calls `router.replace(redirectTo)` when `getAdminToken()` is already set), this page had no equivalent — a signed-in partner/staff user navigating to `/login` directly (e.g. a stale bookmark, back-button) would see the login form again instead of being sent to their dashboard.
   **Fix:** added the same pattern, redirecting to `/orders` for `STAFF` and `/` otherwise, based on `getPartnerToken()`/`getPortalUser()` — `apps/partner-web/src/app/login/page.tsx:15-19`.

3. No open-redirect risk here (unlike `admin-web`'s login page before its fix, see `docs/audits/admin-web/login.md`) — this page has no `redirect` query param at all, so there's nothing to sanitize.

## Unused/dead fields
Not applicable — this page doesn't fetch a data payload beyond the login
response itself, and every field of that response it reads (`email`, `role`,
`branchId`) is used to build the stored `PortalUser` and decide the
post-login redirect.

## Loading/error/realtime behavior
No `usePartnerQuery`/data fetch on this page — the only async operation is
the login submission, which sets `loading` synchronously, disables the submit
button, and on failure shows `error` while preserving the entered
credentials. No polling or realtime subscription applies to a login form.
