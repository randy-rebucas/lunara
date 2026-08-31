# Audit: Customer-Web — Auth, Onboarding, Profile & Settings

Date: 2026-08-30 (re-verified 2026-08-31 — Finding 1 had regressed, re-fixed; see note below)

**2026-08-31 re-verification note:** re-reading `packages/hooks/src/auth-provider.tsx` fresh found
that Finding 1's fix (a `role !== UserRole.CUSTOMER` check in `verifyEmail`) was **no longer present**
in current source — `verifyEmail` (`auth-provider.tsx:264-276`) persisted any successful
`/auth/verify-email` response unconditionally again, while `login`/`loginWithOtp` right above it
still correctly had the check. Re-applied the identical fix (`auth-provider.tsx:272-274`). Root
cause of the regression wasn't investigated (no git-blame trace run as part of this audit pass) —
flagging that this specific file/check is worth a lightweight regression test (assert `verifyEmail`
rejects a non-customer role) given it's now been lost once already. `packages/hooks` `tsc --noEmit`
passes clean after the re-fix.

This is a combined verification/consolidation pass over an area that already has five
per-page audits from the 2026-07-23/2026-08-23 series: `login.md`, `signup.md`,
`register.md`, `onboarding-profile.md`, `onboarding-address.md`, `profile.md`, and
`settings.md`. All seven were re-read in full this pass and their fixes were
spot-checked against the current source rather than re-documented — see each doc for
its own full entry-point/data-flow/cards/mutations/authorization tables. This doc's own
new tracing focuses on the one entry point in the module that had **no prior audit**:
`/verify-email`, plus a fresh full read of the shared `packages/hooks/src/auth-provider.tsx`
against the module's "raw-serializer/sensitive-field" bug class and the mutation-safety
checklist (password-change, logout) called out in this pass's brief.

## Entry point
- Pages: `apps/customer-web/src/app/(marketing)/login/page.tsx`,
  `apps/customer-web/src/app/(marketing)/signup/page.tsx`,
  `apps/customer-web/src/app/(marketing)/register/page.tsx`,
  `apps/customer-web/src/app/(marketing)/verify-email/page.tsx` (new to this pass),
  `apps/customer-web/src/app/(authenticated)/onboarding/profile/page.tsx`,
  `apps/customer-web/src/app/(authenticated)/onboarding/address/page.tsx`,
  `apps/customer-web/src/app/(authenticated)/profile/page.tsx`,
  `apps/customer-web/src/app/(authenticated)/settings/page.tsx`
- Shared logic: `packages/hooks/src/auth-provider.tsx` (`AuthProvider`/`useAuthContext`,
  shared across every Lunara web app — currently the only consumer of `verifyEmail` is
  customer-web, confirmed by grep; see Cross-module consistency below),
  `apps/customer-web/src/lib/customer-settings.ts`, `apps/customer-web/src/lib/profile-types.ts`

## Navigation trace
`login` <-> `signup` <-> `register` (sibling marketing pages, cross-linked, no dynamic
params) -> successful auth lands on `getOnboardingPath(status)` from
`@lunara/hooks/onboarding`, which routes to `/onboarding/profile` -> `/onboarding/address`
-> `/dashboard` depending on `OnboardingStatus`. `verify-email?token=...` is reached only
from the link inside the verification email (`sendVerificationEmail`,
`auth.service.ts:302-309`), not from any in-app `<Link>`/`router.push` — confirmed via grep,
no page links to it. `profile` links out to `/support`, `/refunds`, `/notifications`
(sibling modules, already audited separately) and to `settings` via the shared nav shell,
not a direct in-page link — both are top-level authenticated routes, not parent/child.

## Sub-pages
None of these eight pages are a "list -> detail" pair in the sense the audit template
means (dynamic `[id]` routes) — this module is a linear auth/onboarding funnel plus two
flat account-management pages. Treating the funnel step order as the equivalent
structure:

| Step | Linked from | Param/state passed | Matches next step's expectation? |
|---|---|---|---|
| `signup`/`login`/`register` -> onboarding | `router.replace(getOnboardingPath(status))` after auth persists | `OnboardingStatus` (`needsProfile`/`needsAddress`) computed server-side from `GET /customers/me/onboarding` | yes — see Finding 2 below for the one case this doesn't hold |
| `onboarding/profile` -> `onboarding/address` | same `getOnboardingPath` helper, re-called after profile save | same `OnboardingStatus` shape | yes |
| `onboarding/address` -> `/dashboard` | direct `router.push('/dashboard')` after address save (no re-check) | none needed — this is the last step | yes, reasonable since submitting *is* what completes onboarding |
| `verify-email?token=` -> onboarding | `router.replace(getOnboardingPath(status))` after `verifyEmail` succeeds | same `OnboardingStatus` shape | yes |

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Password login | POST | `/auth/login` | `{ user: User; tokens: AuthTokens }` | `AuthController.login` -> `AuthService.login` |
| Phone OTP request | POST | `/auth/otp/request` | `{ phone: string }` | `AuthController.requestOtp` |
| OTP login/signup | POST | `/auth/login` (`{ phone, otp }`) | same as password login | same `AuthService.login` |
| Register | POST | `/auth/register` | `{ user, tokens } \| { requiresEmailVerification, email }` | `AuthController.register` -> `AuthService.register` |
| Verify email (new to this pass) | POST | `/auth/verify-email` | `{ user: User; tokens: AuthTokens }` | `AuthController.verifyEmail` -> `AuthService.verifyEmail` |
| Resend verification (new to this pass) | POST | `/auth/resend-verification` | `{ message: string }` | `AuthController.resendVerification` -> `AuthService.resendVerification` |
| Onboarding status | GET | `/customers/me/onboarding` | `OnboardingStatus` | `CustomersController.getOnboarding` -> `CustomersService.getOnboardingStatus` |
| Save onboarding profile | PATCH | `/customers/me` | `{ firstName, lastName }` | `CustomersController.updateMe` -> `CustomersService.updateProfile` |
| Save onboarding address | POST | `/addresses` | `{ ...form, isDefault: true }` | `AddressesController.create` -> `AddressesService.create` |
| Profile + addresses fetch | GET | `/customers/me`, `/addresses` | `CustomerProfile`, `CustomerAddress[]` | `CustomersController.getMe`, `AddressesController.findAll` |
| Profile update | PATCH | `/customers/me` | `{ firstName, lastName }` | same as onboarding profile save |
| Avatar upload | POST | `/customers/me/avatar` | `CustomerProfile` | `CustomersController` avatar handler |
| Address create/update/delete/set-default | POST/PATCH/DELETE | `/addresses`, `/addresses/:id` | `AddressFormValues -> CustomerAddress` | `AddressesController`/`AddressesService` |
| Logout | POST | `/auth/logout` | — (fire-and-forget) | `AuthController.logout` |
| Settings (notification prefs, distance hints) | — | `localStorage` only, no backend | `CustomerSettings` (`lib/customer-settings.ts`) | n/a |

## Backend trace
`AuthService.verifyEmail` (`auth.service.ts:272-287`, newly traced this pass) consumes a
single-use token via `otpService.consumeEmailVerificationToken`, sets
`isEmailVerified`/`emailVerifiedAt`/`lastLoginAt`, and returns a full
`buildAuthResponse(user)` — i.e. verifying an email also logs the user in, matching the
frontend's expectation of a session it can `persist()`. `buildAuthResponse`
(`auth.service.ts:353-`) hand-picks the returned `user` fields (`id`, `email`, `phone`,
`role`, `branchId`, `isActive`, `lastLoginAt`, `createdAt`, `updatedAt`) — **no
`passwordHash`, no raw verification token, no internal-only field** is ever included; this
is a proper allow-list serializer, not the raw-doc pattern this audit series keeps finding
elsewhere, and it's shared correctly across `register`/`login`/`loginWithOtp`/`verifyEmail`/
`refreshTokens`. `resendVerification` (`auth.service.ts:289-300`) deliberately returns the
same generic "if an account exists…" message regardless of whether the email matched a
real account — correct, avoids email-enumeration.

All other backend behavior (login/register/onboarding-status/profile/address endpoints)
was already fully traced in `login.md`, `signup.md`, `register.md`, `onboarding-profile.md`,
`onboarding-address.md`, and `profile.md` — re-verified by reading each service method
again this pass, no drift found from what those docs describe (the fixes those docs
record are still in place in the current source).

**Non-customer account creation never sets `isEmailVerified: false`.** Grepped every
`userModel.create(...)` call site (`admin.service.ts:738,798`, `users.service.ts:161`,
`partner-operations.service.ts:730,963`, `auth.service.ts:102,170`) — only
`AuthService.register`'s email-registration branch (`auth.service.ts:114`) explicitly sets
`isEmailVerified: false`; every other creation path (admin invites, partner/rider
onboarding, phone OTP signup) omits the field and gets the schema default of `true`
(`user.schema.ts:31`, with an explicit comment documenting this is deliberate). This means
`/auth/verify-email` is, today, only ever reachable for a `CUSTOMER`-role account — but see
Finding 1 for why that wasn't enforced in code and the defensive fix applied.

## Cards / panels
Card-by-card detail for login/signup/register/onboarding-profile/onboarding-address/profile/
settings is already fully enumerated in each page's own doc (see links in the header) —
not re-transcribed here. New this pass, `verify-email/page.tsx`:

| Card | Fields consumed | Notes |
|---|---|---|
| "Verifying…" state | none (transient, shown while the mount-effect's `verifyEmail(token)` call is in flight) | |
| "Email verified" state | none — pure success message before the redirect fires | |
| "Link expired or invalid" state | `error` (from `verifyEmail`'s thrown message) | |
| Resend form | local `resendEmail` state | posts to `resendVerification`; success shows a static "check your email" message rather than looping back to a fresh token automatically (correct — the old token remains consumed/invalid either way) |

## Mutations
One row per create/update/delete/toggle action across the whole module, including the
ones already covered and fixed in the per-page docs (carried forward for a single
checklist view per this pass's brief), plus the two new to this pass (verify-email
mutations) and the two explicitly asked about (password-change, logout):

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Password sign in | no | n/a | yes | yes |
| Send/verify OTP (login+signup) | no | n/a | yes | yes |
| Register | no | n/a | yes (fixed in `register.md`) | yes |
| Verify email | no | n/a | n/a — fires once on mount, no user-triggered retrigger | yes (`error` state -> "Link expired or invalid" panel) |
| Resend verification email | no | n/a | yes (`disabled={resending}`) | yes (falls back to `resent` success state or `error`) |
| Save onboarding profile / save profile | no | n/a | yes | yes |
| Save onboarding address / add/edit address | no | n/a | yes | yes |
| Delete address | yes | yes (`window.confirm`) | yes (fixed in `profile.md`) | yes |
| Set default address | no | n/a | yes (fixed in `profile.md`) | yes |
| Upload avatar | no | n/a | yes | yes |
| Toggle a setting | no | n/a | n/a (synchronous localStorage write) | n/a |
| **Password change** | n/a — **no password-change UI exists anywhere in customer-web.** Grepped the whole app for `change-password`/`changePassword`/`reset-password`/`forgot-password` — no matches. `settings/page.tsx` is confirmed purely `localStorage` toggles (`settings.md`), and `profile/page.tsx` only edits `firstName`/`lastName` plus addresses/avatar. There is a backend `AuthService` OTP-based password-reset path (`auth.service.ts:255-267`, sets a new password after OTP verification, no *current*-password check needed since OTP already proves phone ownership) but customer-web has no page wired to it. Not a finding — no in-scope UI to audit — but noted since the brief specifically asked about it. |
| **Logout** | yes (ends the session) | n/a (not typically confirmed, matches convention elsewhere) | n/a — single fire-and-forget POST, `persist(null)` runs regardless of the request's outcome | n/a by design — `logout()` (`auth-provider.tsx:303-312`) swallows the `/auth/logout` request's failure with `.catch(() => {})` and unconditionally clears local state; see Findings for whether this fully clears client state |

## Authorization
`[authz]` review across the module, re-verified this pass against current source (all
previously confirmed clean, re-checked not re-discovered):
- `CustomersService.updateProfile`/`getProfile` and every `AddressesService` method filter
  by `userId`/`req.user.sub` taken from the JWT, never a client-supplied id
  (`profile.md`'s Backend trace, re-confirmed) — a customer cannot view or edit another
  customer's profile or addresses by guessing an id.
- `AuthService.verifyEmail` resolves the account purely from the single-use token
  (`otpService.consumeEmailVerificationToken`) — no id/email is client-supplied, so there's
  no id-guessing surface here either.
- `login`/`loginWithOtp` in the shared `auth-provider.tsx` reject any non-`CUSTOMER` role
  before persisting a session (fixed in `login.md`, re-confirmed still present at
  `auth-provider.tsx:214`/`231`). `verifyEmail` did **not** have the same check — Finding 1.
- `GET /customers/me/onboarding` still has no `@Roles` guard of its own (only
  `JwtAuthGuard`) — `login.md` already flagged this as a defense-in-depth follow-up, left
  unfixed there since the login-page-level role check makes it unreachable by a
  non-customer session today. Re-confirmed still the case; not re-opened as a new finding
  since nothing changed here.

## Findings

1. **[authz] `verifyEmail` in the shared `auth-provider.tsx` persisted any successful
   `/auth/verify-email` response without checking `user.role`, unlike `login`/`loginWithOtp`
   in the same file, which both reject a non-`CUSTOMER` role before persisting (fixed in
   `login.md`).** Traced whether this is live-exploitable: `/auth/verify-email` only
   succeeds for a token created by `sendVerificationEmail`, which is only ever called from
   `AuthService.register`'s email branch (always `role: CUSTOMER`, `auth.service.ts:100`)
   and from `resendVerification`, which looks up by email with no role filter
   (`auth.service.ts:289-291`) and would resend a link for *any* role's account **if** that
   account's `isEmailVerified` were `false`. Grepped every `userModel.create(...)` call site
   across `admin.service.ts`, `users.service.ts`, `partner-operations.service.ts`, and
   `auth.service.ts` — confirmed only the customer self-registration path ever sets
   `isEmailVerified: false`; every other role's creation path relies on the schema default
   of `true` (`user.schema.ts:27-32`, comment confirms this is deliberate). So today this
   gap is **not live-exploitable** — but it's a silent gap in a shared file this exact audit
   series has already fixed the sibling pattern for twice (`login`/`loginWithOtp`), and it
   would silently reopen the moment any future non-customer creation path started setting
   `isEmailVerified: false` (e.g. an admin-invite-by-email flow), with no test or type error
   to catch it.
   **Fix:** added the identical role check to `verifyEmail` in
   `packages/hooks/src/auth-provider.tsx:264-281` — throws `'This account is not a customer
   account...'` instead of persisting when `body.data.user.role !== UserRole.CUSTOMER`,
   matching `login`/`loginWithOtp` exactly. Grepped every consumer of `verifyEmail` — only
   `apps/customer-web/src/app/(marketing)/verify-email/page.tsx` calls it (no other app uses
   this shared hook function), so no cross-app regression surface; the page's existing
   `.catch` already renders the thrown message into its "Link expired or invalid" panel, so
   no page-level change was needed. `packages/hooks` `tsc --noEmit` passes clean.
   **[REGRESSED, RE-FIXED 2026-08-31]** — see the note at the top of this doc; the check was
   found missing again on re-verification and has been re-applied.

2. **No auth-response endpoint (login, register, verify-email, refresh) ever returns
   `passwordHash` or a raw verification/OTP token to the client — checked directly against
   the known bug class for this app.** `buildAuthResponse` (`auth.service.ts:353-`) is a
   hand-built allow-list object (`id`, `email`, `phone`, `role`, `branchId`, `isActive`,
   `lastLoginAt`, `createdAt`, `updatedAt`), not a raw Mongoose-doc passthrough — confirmed
   by direct read, and shared identically across every one of these endpoints (unlike the
   refunds/support/reviews modules' `createRequest`-style endpoints, which each had their
   own ad-hoc raw-serializer call site that could drift). No finding here; recorded because
   the brief specifically asked this module be checked against that pattern and it came back
   clean.

No other issues found in this pass's fresh reads. All findings from the prior seven
per-page audits remain fixed and unregressed as of this pass (spot-checked by reading the
current source at each cited file:line, not just trusting the docs).

## Unused/dead fields
None found in the newly-traced `/auth/verify-email`/`/auth/resend-verification` flows — the
frontend only reads `res.data.user`/`res.data.tokens` (verify-email, persisted internally,
not directly rendered) and the resend endpoint's response is a message the frontend doesn't
even inspect beyond `success`. See each per-page doc for that page's own unused-field notes
(all already resolved or explicitly noted as non-issues).

## Loading/error/realtime behavior
`verify-email/page.tsx` uses a local `Status` union (`'verifying' | 'success' | 'error'`)
set synchronously around the mount-effect's `verifyEmail` call, plus an independent
`resending`/`resent` pair for the resend form — same manual-`useState` pattern as
login/signup/register rather than the shared `useCustomerQuery` hook, appropriate here
since this is a one-shot token-consumption flow, not a list/detail view. No polling or
realtime subscription anywhere in this module; the only background "refresh" is the shared
`AuthProvider`'s access-token refresh timer (`auth-provider.tsx:169-188`), which runs
independently of any of these pages and was re-confirmed still correctly implemented
(single in-flight refresh guard via `refreshInFlightRef`, scheduled `REFRESH_BUFFER_MS`
before expiry, falls back to `handleUnauthorized()` on failure).
