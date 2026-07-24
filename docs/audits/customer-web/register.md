# Audit: Customer-web — Register

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/register/page.tsx` (`'use client'`)
- Component(s): `AuthShell`, `Input`, `FormError`, `Button`; auth logic in `@lunara/hooks/auth-provider` (`useAuthContext`)

## Sub-pages
None — `/login` is a sibling auth page, not a detail view of this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Register | POST | `/auth/register` (via `register()`, `@lunara/hooks/auth-provider.tsx:236-255`) | `{ user: User; tokens: AuthTokens }` | `AuthController.register` -> `AuthService.register` |
| Onboarding status (post-register redirect) | — (via `fetchOnboardingStatus(api)`, shared helper) | `/customers/me/onboarding` | `OnboardingStatus` | `CustomersController.getOnboarding` -> `CustomersService.getOnboardingStatus` (already traced in `docs/audits/customer-web/login.md`) |

## Backend trace
`AuthService.register` (`auth.service.ts:66-`) hardcodes `role = UserRole.CUSTOMER` for every account created through this endpoint regardless of any client input — confirmed by direct read, this is what makes it safe that (unlike `login`/`loginWithOtp`) this flow needed no client-side role check when the auth-role gap was fixed for this page's sibling (`docs/audits/customer-web/login.md`, Authorization section). It checks for an existing user by `email`/`phone` via `$or` (only including whichever fields are actually present) and throws `ConflictException` on a match, then creates the `User` and — for the customer role — a `Customer` document plus a signup promo grant and optional referral-code resolution.

`RegisterDto` (`auth.dto.ts:3-26`) marks **`email`, `phone`, and `password` all `@IsOptional()`** — only `firstName`/`lastName` are required server-side. This is intentional at the DTO level (the same DTO/endpoint likely needs to tolerate OTP-first-signup-adjacent flows), but it exposed a real gap on this specific page — see Finding #1.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Name row | `form.firstName`, `form.lastName` (both `required` client-side) | |
| Email field | `form.email` | not marked `required` |
| Phone field | `form.phone` | not marked `required` |
| Password field | `form.password` (`required` client-side) | no client-side strength/length hint despite backend enforcing `@MinLength(8)` when present — minor UX gap, not flagged as a bug since the backend error message surfaces via `error` if too short |
| Error banner | `error` | |
| "Already have an account?" link | static, -> `/login` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Register | no | n/a | **[FIXED]** now yes (`disabled={submitting}`) — previously no guard at all | yes (`error`) |

## Authorization
No role-scoped access on the page itself (public registration form). The
account-creation endpoint always assigns `UserRole.CUSTOMER` server-side
regardless of input, so there's no cross-role gap analogous to the one found
on `/login` — confirmed via direct read of `auth.service.ts:86`. No
`[authz]` issues.

## Findings

1. **Neither email nor phone was required, so a user could register with only a name and password and end up with an account they could never sign back into.** `RegisterDto` allows both `email` and `phone` to be omitted, and the frontend form (`register/page.tsx`, pre-fix) didn't mark either `Input` as `required` — only `firstName`/`lastName`/`password` were required. Since every login path (`/auth/login` password or OTP) requires an email or phone to identify the account, a user who left both blank would have a real, saved account with no way to authenticate again.
   **Fix:** `handleSubmit` in `register/page.tsx` now rejects the submission client-side with `'Enter an email address or phone number so you can sign in later.'` if both `form.email` and `form.phone` are blank, before calling `register(...)`.

2. **No double-submit guard on the Register button** — unlike every other mutation-triggering form audited in this series (including this page's sibling `/login`, which already had `submitting`-based disabling), the submit button had no `disabled` state and no in-flight indicator, so a fast double-click (or a slow network causing an impatient re-click) could fire two concurrent `POST /auth/register` calls. The backend's existing-user `$or` check would likely catch the second as a `ConflictException`, but the user would see a confusing error rather than the expected "already submitting" state.
   **Fix:** added `submitting` state, `disabled={submitting}` on the submit button, and a `"Creating account…"` label while in flight — mirrors the exact pattern already used on `/login` and `/partners/apply`.

3. **No redirect-away-if-already-authenticated check** — an already-signed-in customer visiting `/register` directly would see the registration form and could (accidentally) create a second account rather than being routed to their dashboard/onboarding step. Confirmed the established pattern for this exists elsewhere in the codebase (e.g. `admin-web`'s `/login`, `admin-web/src/app/login/page.tsx:51-55`, redirects via a mount-time check against the stored session) but was missing here — and is also still missing on this page's sibling `/login` (not fixed in this pass; out of scope for `register`, tracked as an existing gap on that page).
   **Fix:** added a `useEffect` that, when `isAuthenticated` is true, calls `fetchOnboardingStatus(api)` and `router.replace(getOnboardingPath(status))` — same redirect target already used after a successful register/login, so an already-authenticated visitor lands exactly where they'd land after actually completing the form.

## Unused/dead fields
Not applicable — the frontend doesn't consume the register response body directly (persisted internally by `AuthProvider`).

## Loading/error/realtime behavior
`submitting` is now set synchronously around the register call with try/catch/finally (previously absent — see Finding #2); a failed registration surfaces `error` via `FormError`. No polling or realtime subscription — the new redirect-away effect runs once per `isAuthenticated` transition, not on an interval.
