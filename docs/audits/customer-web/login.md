# Audit: Customer-web — Login

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/login/page.tsx`
- Component(s): shared `AuthShell`, `FormError`, `Input`, `Button`; auth logic lives entirely in `@lunara/hooks/auth-provider` (`useAuthContext`)

## Sub-pages
None — no outbound navigation into a dynamic detail route. Links to
`/signup` and `/register` are sibling marketing pages, not detail views of
this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Password login | POST | `/auth/login` (via `login()`, `@lunara/hooks/auth-provider.tsx:199-215`) | `{ user: User; tokens: AuthTokens }` | `AuthController.login` -> `AuthService.login` (shared across every app — same endpoint already traced in `docs/audits/admin-web/login.md`, `docs/audits/partner-web/login.md`) |
| Request phone OTP | POST | `/auth/otp/request` (via `requestOtp()`) | `{ phone: string }` | `AuthController.requestOtp` |
| Verify OTP / login | POST | `/auth/login` (via `loginWithOtp()`, body `{ phone, otp }`) | same as password login | same shared `/auth/login` |
| Onboarding status (post-login redirect) | GET | `/customers/me/onboarding` (via `fetchOnboardingStatus(api)`) | `OnboardingStatus` | `CustomersController.getOnboarding` -> `CustomersService.getOnboardingStatus` |

## Backend trace
`/auth/login` and `/auth/otp/request` are the same shared, throttled
endpoints already traced in the admin-web and partner-web login audits — no
new backend behavior there. `GET /customers/me/onboarding` is new to this
trace: `CustomersController` (`customers.controller.ts:22-23`) is guarded
only by `@UseGuards(JwtAuthGuard)` — **no `RolesGuard`, no `@Roles(...)`
anywhere on the controller or this route** — so any authenticated account of
*any* role can call it. `getOnboardingStatus` handles a missing `Customer`
document gracefully (`findByUserId` returns `null`, `needsProfileCompletion(null)`
returns `true`), so a non-customer account wouldn't error here — it would
just be told `needsProfile: true` and routed into the customer onboarding
flow. See Finding #1 for what this combination meant before the fix in this
pass.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Email/Phone OTP mode tabs | local `mode` state | |
| Password form | `email`, `password` | |
| OTP phone-entry form | `phone`, validated client-side via `isValidPhilippineMobile` before calling `requestOtp` | |
| OTP code-entry form | `otp` (digits-only, capped at 6 via `.replace(/\D/g, '').slice(0, 6)`), `verifiedPhone` (echoed back from the request-OTP response) | "Resend code" re-invokes `handleSendOtp` with a synthetic event object providing just `preventDefault` — functionally fine since that's the only property the handler reads, if unconventional |
| Error banner | `error` (thrown `Error.message` from any of the above calls) | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Password sign in | no | n/a | yes (`disabled={submitting}`) | yes (`error`) |
| Send OTP | no | n/a | yes (`disabled={submitting}`) | yes |
| Verify OTP / sign in | no | n/a | yes (`disabled={submitting \|\| otp.length < 6}`) | yes |

## Authorization

**[authz] [FIXED] Any authenticated account — partner, staff, admin, or rider — could sign into customer-web with their own credentials and get silently routed into the customer onboarding flow, with nothing rejecting the mismatch.** `/auth/login` is role-agnostic by design (shared across every Lunara client), and unlike `admin-web`'s `adminLogin` (`admin-api.ts:213-215`, throws `'Admin account required'` if `role !== 'admin'`), `@lunara/hooks/auth-provider`'s `login`/`loginWithOtp` (pre-fix) persisted *any* successful login response regardless of role. Combined with `GET /customers/me/onboarding` having no role guard at all and gracefully treating a non-customer account as "no customer profile yet, needs onboarding," a partner/staff/admin/rider logging in here would land on `/onboarding/profile` looking exactly like a brand-new customer — and completing that form would actually *create* a real `Customer` document tied to their existing account id, letting one login blur into two account "personas" with no product decision behind it.

**Fix:** `login`/`loginWithOtp` in `packages/hooks/src/auth-provider.tsx` now check `body.data.user.role !== UserRole.CUSTOMER` after a successful `/auth/login` response and throw a clear error instead of persisting the session — mirroring the exact pattern already used by `admin-web`'s `adminLogin`. Fixed in the shared hook (not just this page) since `loginWithOtp` is also reused as `signupWithOtp` (`auth-provider.tsx:261`) for the OTP-based signup flow on `/signup` — both benefit from the same fix. Left `register` (`/auth/register`) unchanged: confirmed server-side it always hardcodes `role = UserRole.CUSTOMER` (`auth.service.ts:86`) regardless of input, so there was nothing to fix there. Grepped every consumer of `@lunara/hooks/auth-provider` (32 files, all within `apps/customer-web` — no other app currently uses this shared hook) to confirm the fix has no cross-app blast radius to regression-check. Typechecked `packages/hooks` and `apps/customer-web` clean.

The underlying `GET /customers/me/onboarding` route still has no role guard of its own — left as defense-in-depth follow-up rather than a required fix here, since the login-page-level check now prevents a non-customer session from ever being persisted in the browser in the first place, so this route can no longer actually be reached by a non-customer session originating from this login flow.

## Findings
See Authorization section above for the primary (fixed) finding. In
addition:

2. **[FIXED] No redirect-away-if-already-authenticated check.** An
   already-signed-in customer visiting `/login` directly saw the login form
   instead of being routed to their dashboard/onboarding step. The
   established pattern for this exists elsewhere in the codebase (e.g.
   `admin-web`'s `/login`, `admin-web/src/app/login/page.tsx:51-55`) and was
   applied to this app's `/register` page first (`docs/audits/customer-web/register.md`,
   Finding #3).
   **Fix:** added the same `useEffect` (checks `isAuthenticated` from
   `useAuthContext`, calls `fetchOnboardingStatus(api)` and
   `router.replace(getOnboardingPath(status))`) to both `/login` and
   `/signup` (`docs/audits/customer-web/signup.md`, Finding #1) together in
   this pass, since both are auth entry points sharing the same redirect
   target.

No other issues found: every field the login responses return is used
correctly, and the shared `AuthProvider`'s token refresh scheduling
(confirmed present and correctly implemented, unlike the gap found in
`docs/audits/partner-web/login.md` for a *different* app's auth client)
means customer-web sessions do renew silently rather than requiring
re-login on every access-token expiry.

## Unused/dead fields
Not applicable — no list/detail payload to diff against on this page.

## Loading/error/realtime behavior
No `usePartnerQuery`-style hook here — `submitting` is set synchronously per
form submission and each async call has its own try/catch/finally setting a
shared `error` string. No polling or realtime subscription; the only
"refresh" behavior is the shared `AuthProvider`'s background access-token
refresh timer, which runs independently of this page.
