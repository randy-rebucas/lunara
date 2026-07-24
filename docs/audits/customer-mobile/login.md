# Audit: Customer-mobile — Login

Date: 2026-07-23

## Entry point
- Screen: `apps/customer-mobile/app/(auth)/login.tsx` — Expo Router screen, dual-mode (Phone OTP / Email+password)
- Component(s): `Screen`, `Card`, `Input`, `Button`, `BrandMark`; auth logic in `src/store/auth.ts` (`useAuthStore`, Zustand)

## Sub-pages
None as a detail route — links to `/(auth)/signup` (sibling auth screen). A country-picker `Modal` is presented in-place, not a separate route.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Request OTP | POST | `/auth/otp/request` (via `requestOtp()`) | `{ phone: string }` | `AuthController.requestOtp` — same shared endpoint already traced in `docs/audits/customer-web/login.md` |
| Verify OTP / login | POST | `/auth/login` (via `loginWithOtp()`, body `{ phone, otp }`) | `{ user: User; tokens: AuthTokens }` | `AuthController.login` -> `AuthService.login` |
| Email/password login | POST | `/auth/login` (via `loginWithEmail()`, body `{ email, password }`) | same as above | same shared `/auth/login` |
| Onboarding status (post-login redirect) | GET | `/customers/me/onboarding` (via `redirectAfterAuth` -> `fetchOnboardingStatus`) | `OnboardingStatus` | already traced in `docs/audits/customer-web/login.md` |

## Backend trace
Same shared `/auth/login`/`/auth/otp/request`/`/customers/me/onboarding` endpoints already fully traced for customer-web — no new backend behavior to re-derive. The mobile auth store (`store/auth.ts`) already implements the role-check fix that was needed on customer-web's `AuthProvider`: both `loginWithEmail` and `loginWithOtp` check `data.user.role !== UserRole.CUSTOMER` and throw before persisting the session (`auth.ts:124-126, 136-138`) — confirmed this was already present here, not something this pass needed to add.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Mode tabs (Phone OTP / Email) | local `mode` state | |
| Email form | `email`, `password` | dev-only prefill via `DEV_EMAIL`/`DEV_PASSWORD`, gated behind `__DEV__` so it's stripped from production bundles — correct pattern, not a leaked-credential risk |
| Phone entry form | `country` (from `detectCountry()`/country picker modal), `localPhone` (digits-only, leading zero stripped client-side) | `isValidLocalNumber`/`buildE164` handle per-country validation and E.164 formatting before calling `requestOtp` |
| OTP entry form | `otp` (digits-only, capped at 6), `verifiedPhone` (echoed from the request-OTP response), `resendCooldown` (30s client-side throttle with a live countdown) | resend button correctly reuses `handleSendOtp` directly (no synthetic-event workaround needed, since this is React Native `onPress`, not a DOM form submit) |
| Country picker modal | `COUNTRIES` (static list), filtered client-side by name/dial code/ISO code | |
| Error banner | `error` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Send OTP | no | n/a | yes (`disabled={submitting \|\| !localPhone.trim()}`) | yes (`error`) |
| Verify OTP / sign in | no | n/a | yes (`disabled={submitting \|\| otp.length < 6}`) | yes |
| Resend OTP | no | n/a | yes (`disabled={submitting \|\| resendCooldown > 0}`, plus a visible 30s countdown) | yes |
| Email/password sign in | no | n/a | yes (`disabled={submitting}`) | yes |

## Authorization
Same shared, role-agnostic `/auth/login` endpoint as every other Lunara client — already guarded correctly on the mobile side (see Backend trace). No `[authz]` issues.

## Findings

1. **[FIXED] The auth store had no token-refresh mechanism at all — a 401 immediately logged the user out, even with a valid 30-day refresh token sitting unused.** Unlike `customer-web`'s `AuthProvider` (which proactively schedules a refresh before the access token's `expiresIn` elapses), `apps/customer-mobile/src/store/auth.ts`'s `apiFetch`/`apiUpload` called `logout()` on any 401 with no attempt to use the stored `refreshToken` first. Confirmed server-side that access tokens are actually long-lived (7 days, `auth.module.ts:27` `signOptions: { expiresIn: '7d' }`) against a 30-day refresh token (`auth.service.ts:303-309`) — so this wasn't catastrophic (a mobile session would silently survive a week), but every 7 days a customer would be logged out and forced to re-authenticate from scratch despite holding a refresh token valid for another 23 days, which is a materially worse experience than the web app gets from the identical backend.
   **Fix:** added a `refreshAccessToken` helper (dedupes concurrent 401s behind a single in-flight refresh via a module-level promise, same pattern as `AuthProvider`'s `refreshInFlightRef`) and threaded it into `authRequest`/`authUpload` — on a 401, both now attempt one `/auth/refresh` call and retry the original request with the new access token before falling back to logout. Regression-checked: `logout()` itself calls `authRequest('/auth/logout', ...)` without going through `apiFetch`/`apiUpload` (passes `token` positionally as `undefined`, so the 401 branch never triggers there), so this change doesn't affect the logout call path.

2. **[FIXED] `redirectAfterAuth` (`src/lib/onboarding.ts`) didn't catch a failed onboarding-status fetch, so a transient network error *after* a successful login/signup surfaced as a false "Invalid or expired OTP" / login-failure message** — the actual `loginWithOtp`/`loginWithEmail` call had already succeeded and persisted tokens by the time `redirectAfterAuth` ran, but its thrown error was caught by the *login* screen's `catch` block and shown as if the login itself had failed, leaving an already-authenticated user stuck on the login screen with a misleading error. This function has 3 call sites — `login.tsx`, `signup.tsx` (identical pattern), and `_layout.tsx` (app-start redirect, called via `void redirectAfterAuth(...)` with no `.catch` of its own, so a throw there would have been an unhandled promise rejection).
   **Fix:** `redirectAfterAuth` now catches internally and falls back to `router.replace('/(tabs)')`, matching the same "assume complete, let a deeper check catch it later" philosophy already used by `useProtectedPage` on customer-web. Regression-checked all 3 consumers: `login.tsx`/`signup.tsx` benefit directly (no more false failure message); `_layout.tsx`'s usage (redirect signed-in users away from the auth stack) is unaffected in the success case and now degrades gracefully instead of leaving the user stranded on the auth screen with an unhandled rejection in the console.
   While in `_layout.tsx` for this fix, also added a missing `.catch(() => {})` to a **separate, sibling instance of the same bug** — the layout's own periodic re-check (`fetchOnboardingStatus(apiFetch).then(...)` with no catch, used on every authenticated route change to re-verify onboarding completeness) had the identical unhandled-rejection risk, just not routed through `redirectAfterAuth`.

## Unused/dead fields
Not applicable — no list/detail payload to diff against on this screen.

## Loading/error/realtime behavior
`submitting` is set synchronously per action with try/catch/finally. No loading state needed before the form renders (nothing to fetch on screen mount). No polling or realtime subscription — the resend cooldown is a plain local `setInterval`, correctly cleared on unmount (`useEffect` cleanup) and on mode switch.
