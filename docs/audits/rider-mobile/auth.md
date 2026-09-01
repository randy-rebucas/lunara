# Audit: Rider-mobile — Auth module

Date: 2026-09-02

## Entry point
- Page: `apps/rider-mobile/app/login.tsx`
- Page: `apps/rider-mobile/app/forgot-password.tsx`
- Bootstrap: `apps/rider-mobile/app/index.tsx` (initial redirect based on stored tokens),
  `apps/rider-mobile/app/_layout.tsx` (session hydrate + route guard)
- Store/API: `apps/rider-mobile/src/store/auth.ts`, `apps/rider-mobile/src/auth.ts`

## Sub-pages
None — no outbound navigation into a detail route. `login.tsx` links to
`/forgot-password` (a sibling auth screen, covered in this same audit, not a
data-detail sub-page) and on success both screens `router.replace('/(tabs)')`
into the authenticated app shell, which is out of this module's scope.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Password login | POST | `/auth/login` (body: `email`,`password`) | `{ user: User; tokens: AuthTokens }` | `AuthController.login` -> `AuthService.login` |
| OTP request | POST | `/auth/otp/request` (body: `phone`) | `{ phone: string; message: string }` | `AuthController.requestOtp` -> `AuthService.requestOtp` |
| OTP login | POST | `/auth/login` (body: `phone`,`otp`) | `{ user: User; tokens: AuthTokens }` | `AuthController.login` -> `AuthService.login` |
| Forgot password | POST | `/auth/forgot-password` (body: `email`) | `{ message: string; phone: string \| null }` | `AuthController.forgotPassword` -> `AuthService.forgotPassword` |
| Reset password | POST | `/auth/reset-password` (body: `phone`,`otp`,`password`) | `{ message: string }` | `AuthController.resetPassword` -> `AuthService.resetPassword` |
| Logout | POST | `/auth/logout` (Bearer token) | `{ message: string }` | `AuthController.logout` -> `AuthService.logout` |
| Refresh (fixed) | POST | `/auth/refresh` (body: `refreshToken`) | `{ user?: User; tokens: AuthTokens }` | `AuthController.refresh` -> `AuthService.refreshTokens` |

## Backend trace
`AuthService.login` looks up the user by `email` or normalized `phone`, and
either verifies an OTP (via `OtpService.verify`, creating a placeholder
customer-role account if none exists — not reachable from rider login since the
rider app always sends a real `email`/`password` or a `phone`/`otp` for an
*existing* rider, but the service itself doesn't distinguish caller role) or
compares `bcrypt.compare(dto.password, user.passwordHash)`. Both branches build
a signed JWT access token (7d) + refresh token (30d, `JWT_REFRESH_SECRET` env,
persisted via `OtpService.storeRefreshToken`) and return `buildAuthResponse`,
which includes the user's `role`, `branchId`, `isActive`, timestamps — no
password hash or token secret leaked. `AuthController.login` additionally sets
an `httpOnly` cookie (`portal_token`) for browser-based clients; irrelevant to
the mobile app, which relies on the JSON `tokens` payload only.

`forgotPassword` looks up by email, and if found with a `phone` on file, calls
`requestOtp` to text a code to that phone; the HTTP response always returns the
same generic message regardless of whether the account exists, but conditionally
includes `phone` (or `null`) — the rider UI uses that field to decide whether to
advance to the OTP step. `resetPassword` verifies the OTP against the phone via
`OtpService.verify`, then rehashes and saves the new password.

Both `login` and `otp/request` are rate-limited per-IP via `@Throttle` (10/min
and 5/min respectively) — see `AUTH_THROTTLE`/`OTP_THROTTLE` in
`apps/api/src/modules/auth/auth.controller.ts:22-23`. `forgot-password` and
`reset-password` are also throttled (`OTP_THROTTLE` and `AUTH_THROTTLE`
respectively).

## Screens / fields

### `login.tsx`
| Field/widget | Source | Notes |
|---|---|---|
| Email/OTP mode tabs | local `mode` state | client-only toggle |
| Work email input | `email` state | `autoComplete="email"`, dev-only prefilled via `DEV_EMAIL` |
| Password input (+ show/hide) | `password` state | `secureTextEntry`, dev-only prefilled via `DEV_PASSWORD` |
| Remember me checkbox | `rememberMe` state | **dead control** — never read by `handlePasswordLogin`; toggling it has no effect (see Findings) |
| Forgot password link | static | navigates to `/forgot-password` |
| Error banner | `error` state, set from thrown `Error.message` | surfaces backend failure text (e.g. "Invalid credentials") |
| Start session button | `passwordDisabled` = `loading \|\| !email.trim() \|\| !password` | disabled while `loading`, i.e. has a double-submit guard |
| Mobile number input (OTP mode) | `phone` state | validated client-side via `isValidPhilippineMobile` before send |
| 6-digit code input | `otp` state, digits-only filter | `otpDisabled` gates on `loading` and (if sent) `otp.length < 6` |
| Send OTP / Verify & sign in button | same `loading` guard | double-submit guarded |
| Resend code / change number links | local state resets | no cooldown/rate-limit indicator client-side (server throttles at 5/min) |
| QR code button | static, `disabled` | "Coming soon" — inert, no backend call |
| Contact support | `Linking.openURL(mailto:)` | static |
| Dev credential hint | `__DEV__` only | not shown in production builds |

### `forgot-password.tsx`
| Field/widget | Source | Notes |
|---|---|---|
| Step indicator (1/2) | local `step` state | UI-only |
| Work email input (step 1) | `email` state | |
| Send verification code button | `loading \|\| !email.trim()` | double-submit guarded |
| Info banner "Code sent to {phone}" (step 2) | `result.phone` from `forgotPassword` response | phone comes straight from backend response |
| OTP input (step 2) | `otp` state, digits-only filter | |
| New password input (+ show/hide) | `password` state | client-side hint at `< 8 chars`, matches backend `@MinLength(8)` |
| Update password button | `loading \|\| !otp.trim() \|\| password.length < 8` | double-submit guarded |
| "Use a different email" link | resets `step` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Password login | no | n/a | yes (`passwordDisabled` includes `loading`) | yes — `error` banner shows caught message |
| Send/verify OTP login | no | n/a | yes | yes — `error` banner |
| Forgot-password request | no | n/a | yes (`loading \|\| !email.trim()`) | yes — `Alert.alert` on catch |
| Reset password | no | n/a | yes | yes — `Alert.alert` on catch |
| Logout | no (but ends session) | no confirmation dialog | n/a (single call site in store, not on this page) | failure swallowed intentionally (`.catch(() => {})`) so local session always clears — reasonable, not a bug |

## Authorization
`login`, `otp/request`, `forgot-password`, `reset-password`, and `refresh` are
public (no guard) by design — they're the entry points into auth. `logout` is
the only guarded route (`@UseGuards(JwtAuthGuard)`), matching the frontend
(`riderLogout`/`apiFetch` always sends the bearer token). `AuthService.login`
does not check the account's `role` server-side — any role (admin, customer,
partner, rider) can authenticate through this same `/auth/login` endpoint.
Role-gating happens client-side only: `useAuthStore.login`/`loginWithOtp` throw
`'This account is not a rider account.'` if `data.user.role !== UserRole.RIDER`
(`apps/rider-mobile/src/store/auth.ts:118-120`, `130-132`) — but by that point
the backend has already issued and returned valid tokens for that non-rider
account to the rider app before the client-side check discards them. This
matches customer-mobile's identical pattern (`role !== UserRole.CUSTOMER`), so
it's a shared, pre-existing design rather than a rider-specific regression — see
Findings #3 `[authz]`.

## Findings

1. **Rider app never sent the `x-lunara-client: mobile` header, breaking reCAPTCHA-gated OTP requests in production.** `apps/rider-mobile/src/store/auth.ts` `authRequest`/`authUpload` built their fetch headers without `x-lunara-client`, unlike `customer-mobile`'s identical helper which does send it (`apps/customer-mobile/src/store/auth.ts:52`). The backend uses that header to decide whether to skip reCAPTCHA (`AuthController.requestOtp`: `client === 'mobile'` -> `isMobileClient`, `apps/api/src/modules/auth/auth.controller.ts:83-85`). `RecaptchaService.assertHuman` no-ops only when `RECAPTCHA_SECRET_KEY` is unset (local dev); with it set (staging/prod), any rider OTP request or forgot-password-triggered OTP would hit `assertHuman(undefined, ...)` and throw `BadRequestException('reCAPTCHA verification required')`, since the rider app has no reCAPTCHA widget to produce a token. Net effect: OTP login and password-reset would be broken for real rider users in any environment with reCAPTCHA configured.
   **Fix:** added `'x-lunara-client': 'mobile'` to both `authRequest` and `authUpload` in `apps/rider-mobile/src/store/auth.ts`, matching customer-mobile. Verified customer-mobile's own consumer of the header is unaffected (this change is additive and rider-mobile-only).

2. **Rider app never used its refresh token — access-token expiry (7 days) forced an unnecessary hard logout instead of a silent refresh**, even though the backend already issues a 30-day `refreshToken` and exposes `POST /auth/refresh` (`apps/api/src/modules/auth/auth.controller.ts:99-116`), and `AuthTokens` already carries `refreshToken` (`packages/types/src/auth.ts:13-17`). `customer-mobile`'s store implements exactly this refresh-and-retry flow (`apps/customer-mobile/src/store/auth.ts:227-259`); rider-mobile's `apiFetch`/`apiUpload` instead called `get().logout()` unconditionally on any 401, discarding a still-valid session and forcing riders mid-shift to re-authenticate every 7 days for no reason.
   **Fix:** ported customer-mobile's `refreshAccessToken` helper (dedupes concurrent 401s behind one in-flight refresh) into `apps/rider-mobile/src/store/auth.ts`, wired into `authRequest`/`authUpload` via a `refreshAndGetToken` callback, and into `apiFetch`/`apiUpload`. Typechecked (`tsc --noEmit -p apps/rider-mobile/tsconfig.json`) — the only error reported is a pre-existing, unrelated missing-property error in `src/context/rider-operations.tsx:402`, not touched by this change.

3. **[authz] `/auth/login` doesn't scope by role — non-rider accounts can obtain valid tokens through the rider app before the client-side role check rejects them.** `AuthService.login` (`apps/api/src/modules/auth/auth.service.ts:155-218`) issues real, signed access/refresh tokens for whatever role the matched user has; `apps/rider-mobile/src/store/auth.ts:118-120` and `:130-132` only check `data.user.role !== UserRole.RIDER` *after* receiving valid tokens, and throws client-side without revoking them server-side (no logout/revoke call on this path). A customer or admin who mistakenly (or deliberately) logs into the rider app briefly holds a valid, usable access token for their own account via the rider app's storage before the check runs, and the token itself remains valid against any endpoint their real role can reach even though the rider UI immediately discards it locally.
   **Fix: left unfixed — shared backend contract change (adding a role parameter/guard to `/auth/login`) affecting customer-mobile, customer-web, and admin-web logins too; out of scope for a rider-mobile-only audit and needs a product decision on the desired multi-app login contract.**

4. **"Remember me" checkbox on `login.tsx` is a dead control.** `apps/rider-mobile/app/login.tsx:59` declares `rememberMe` state and renders a checkbox (`:224-239`) but no code path reads it — `handlePasswordLogin` (`:61-72`) always persists the session to `AsyncStorage` regardless, so unchecking it does nothing and checking it does nothing. Cosmetic but misleading — riders may believe unchecking it prevents the session from being remembered.
   **Fix: left unfixed — product decision needed (should unchecking it mean "don't persist tokens," i.e. sign out on app close? that changes session-persistence UX beyond this audit's scope, and no comparable pattern exists elsewhere in the app to copy).**

5. **Forgot-password response reveals account existence via the conditional `phone` field**, even though the message text is deliberately generic. `AuthService.forgotPassword` (`apps/api/src/modules/auth/auth.service.ts:238-251`) returns `phone: user?.phone ?? null`; the rider screen branches its whole UX on this (`apps/rider-mobile/app/forgot-password.tsx:26-32`) — a registered email advances to the OTP step and shows the phone number, while an unregistered one just shows a generic alert and stays on step 1. This is a real (if minor) email-enumeration side channel, but it's an intentional, shared design already used identically by customer-mobile/customer-web (same backend endpoint, same response shape) — not a rider-module-specific bug.
   **Fix: left unfixed — shared backend response contract; changing it (e.g. requiring an OTP-verify step before ever confirming a phone number) is a cross-app UX/product decision, out of scope here.**

No plaintext-password or token logging was found anywhere in the module (`apps/rider-mobile/src/store/auth.ts`, `apps/rider-mobile/src/auth.ts` — grepped for `console.log`/`console.warn`/`console.error`, no matches).

## Unused/dead fields
None found beyond the client-side dead `rememberMe` control noted in Finding #4 (not an API field).

## Loading/error/realtime behavior
Both screens use local `loading` state (not a shared hook) to disable/relabel
their submit buttons during the in-flight request and re-enable on success or
failure via `finally`. `login.tsx` surfaces errors inline via a banner;
`forgot-password.tsx` uses `Alert.alert`. Neither screen has a stuck-loading
risk — every `try` has a matching `finally { setLoading(false) }`. No
realtime/polling/socket behavior in this module (session hydration in
`_layout.tsx` runs once on mount via `hydrate()`, not on an interval). Token
storage is plain `AsyncStorage` (not `expo-secure-store`) — this matches
`customer-mobile`'s identical `AsyncStorage`-based `STORAGE_KEY` pattern
exactly (`apps/customer-mobile/src/store/auth.ts:16, 132-139`), so it is the
established, consistent convention across mobile apps in this repo rather than
a rider-specific weakness — not treated as a finding to fix in isolation here,
since doing so would create an inconsistency with customer-mobile rather than
resolve one. If tightening token storage is desired, it should be done for both
apps together as its own initiative.
