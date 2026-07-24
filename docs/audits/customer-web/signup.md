# Audit: Customer-web — Signup

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/signup/page.tsx` (`'use client'`)
- Component(s): `AuthShellWide`, `OnboardingProgress`, `FormError`, `Input`, `Button`; auth logic in `@lunara/hooks/auth-provider` (`useAuthContext`)

## Sub-pages
None — `/login` and `/register` are sibling auth pages, not detail views of this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Request phone OTP | POST | `/auth/otp/request` (via `requestOtp()`) | `{ phone: string }` | `AuthController.requestOtp` |
| Verify OTP / create account | POST | `/auth/login` (via `signupWithOtp()`, which is `loginWithOtp` under an alias — `auth-provider.tsx:270`) | `{ user: User; tokens: AuthTokens }` | `AuthController.login` -> `AuthService.login` |
| Onboarding status (post-signup redirect) | — (via `fetchOnboardingStatus(api)`) | `/customers/me/onboarding` | `OnboardingStatus` | `CustomersController.getOnboarding` -> `CustomersService.getOnboardingStatus` (already traced in `docs/audits/customer-web/login.md`) |

## Backend trace
`signupWithOtp` is a plain alias for `loginWithOtp` — this page and `/login`'s
OTP mode hit the exact same `/auth/login` endpoint with `{ phone, otp }`.
Traced `AuthService.login` (`auth.service.ts:127-188`) to confirm how a
brand-new phone number becomes a real account: when `dto.otp` is present and
the OTP verifies, if no existing user matches the phone it creates one
inline with **`role: UserRole.CUSTOMER`** (hardcoded, `auth.service.ts:144`)
and immediately creates a placeholder `Customer` profile
(`OTP_PROFILE_PLACEHOLDER_FIRST_NAME`/`_LAST_NAME`) plus a signup promo
grant — this is the actual "signup" that happens here, there's no separate
`/auth/register`-style creation path for the OTP flow. If the phone *does*
match an existing user, the same code path logs them in instead (no
distinction between "signup" and "login" once an OTP verifies) — meaning an
existing non-customer account's phone number hitting this page's flow goes
through the identical role-check gate already fixed in
`packages/hooks/src/auth-provider.tsx` for `loginWithOtp` (`docs/audits/customer-web/login.md`,
Finding #1). Since `signupWithOtp` is the same function reference, it
inherited that fix automatically — confirmed, not re-implemented here.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Onboarding progress indicator | `step` (`'phone'` -> `'phone'`, `'otp'` -> `'profile'`) | purely local UI state, not fetched |
| Phone entry form | `phone`, validated client-side via `isValidPhilippineMobile` before calling `requestOtp` | |
| OTP entry form | `otp` (digits-only, capped at 6), `verifiedPhone` (echoed from the request-OTP response, falls back to `formatPhone(phone)` if unset) | "Resend code" re-invokes `handleSendOtp()` with no event arg — `handleSendOtp` takes an optional `e?: React.FormEvent` and calls `e?.preventDefault()`, so this is actually cleaner than `/login`'s equivalent synthetic-event workaround (`login/page.tsx`'s Resend button passes a fake `{ preventDefault: () => {} }` object) — not a bug on either page, just noting the more direct pattern here |
| Error banner | `error` | |
| Footer links | static, -> `/login` and `/register` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Send OTP | no | n/a | yes (`disabled={submitting}`) | yes |
| Verify OTP / create account | no | n/a | yes (`disabled={submitting \|\| otp.length < 6}`) | yes |

## Authorization
Public, unauthenticated entry point by design. The account-creation path this page drives (`AuthService.login`'s inline user-creation branch) always assigns `UserRole.CUSTOMER`, and the pre-existing-account collision case is already covered by the role-check fix in `@lunara/hooks/auth-provider.tsx` (shared with `/login`). No new `[authz]` issues found on this page.

## Findings

1. **[FIXED] No redirect-away-if-already-authenticated check.** An already-signed-in customer visiting `/signup` directly saw the phone-entry form instead of being routed to their dashboard/onboarding step — the same gap found and fixed on `/login` and `/register` (`docs/audits/customer-web/login.md` Finding #2, `docs/audits/customer-web/register.md` Finding #3).
   **Fix:** added a `useEffect` (checks `isAuthenticated`, calls `fetchOnboardingStatus(api)` -> `router.replace(getOnboardingPath(status))`) — fixed together with `/login` in the same pass per the plan noted in `login.md`.

No other issues found: the shared OTP-login/signup unification is
deliberate (not a bug), and the role-check fix from the `/login` audit
already covers this page's `signupWithOtp` call since it's a direct alias
of `loginWithOtp`.

## Unused/dead fields
Not applicable — the frontend doesn't consume the login response body directly (persisted internally by `AuthProvider`).

## Loading/error/realtime behavior
`submitting` is set synchronously around each async call with try/catch/finally; failures surface via `error` -> `FormError`. No polling or realtime subscription; the new redirect-away effect runs once per `isAuthenticated` transition.
