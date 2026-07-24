# Audit: Customer-web — Onboarding: Profile

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/onboarding/profile/page.tsx` (`'use client'`)
- Component(s): `AuthShellWide`, `OnboardingProgress`, `Input`, `Button`

## Sub-pages
None as a detail route — this page is itself step 1 of the onboarding flow, redirecting forward to `/onboarding/address` or `/dashboard` depending on `fetchOnboardingStatus` once the profile step is satisfied.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Onboarding status (mount + post-save redirect) | — (via `fetchOnboardingStatus(api)`) | `/customers/me/onboarding` | `OnboardingStatus` | `CustomersController.getOnboarding` -> `CustomersService.getOnboardingStatus` (already traced in `docs/audits/customer-web/login.md`) |
| Save profile | PATCH | `/customers/me` | `{ firstName, lastName }` | `CustomersController.updateMe` -> `CustomersService.updateProfile` (already traced in `docs/audits/customer-web/profile.md`) |

## Backend trace
Same endpoints already fully traced in `docs/audits/customer-web/profile.md` (`UpdateCustomerDto`, `@MaxLength(80)` on both fields) and `docs/audits/customer-web/login.md` (the onboarding-status endpoint). No new backend behavior to trace — this page is a different entry point into the same `PATCH /customers/me` mutation, used during first-time setup instead of later profile edits.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Profile form | `form.firstName`/`lastName` (local state) | **[FIXED]** — see Finding #1 |
| Email display | `user.email` (read-only, shown only if present — OTP-signup users have no email) | correctly non-editable here, matching the backend DTO which doesn't accept an email field on this endpoint at all |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save profile & continue | no | n/a | yes (`disabled={submitting}`) | yes (`error`) |

## Authorization
Requires an authenticated session (`isAuthenticated` check, redirects to `/signup` if not) — this page deliberately does **not** use the shared `useProtectedPage({ requireOnboarding: true })` hook the rest of the authenticated app uses, since that hook would itself redirect an incomplete-onboarding user *into* this very page, causing a loop; instead it implements its own narrower "authenticated but onboarding not required yet" gate plus a manual forward-redirect once the profile step is done. This is the correct, deliberate exception to the shared-hook convention, not an oversight. No `[authz]` issues — the underlying endpoints are the same ones already audited and confirmed correctly scoped.

## Findings

1. **[FIXED] Name inputs had no `maxLength`, matching the same gap already found and fixed on `/profile`** (`docs/audits/customer-web/profile.md`, Finding #2) — the backend enforces `@MaxLength(80)` on both `firstName`/`lastName` via the same `UpdateCustomerDto` this page's save action hits.
   **Fix:** added `maxLength={80}` to both `Input`s, mirroring the `/profile` fix exactly.

2. **[FIXED] The mount-time onboarding-status redirect check had no `.catch`, unlike the identical pattern in the shared `useProtectedPage` hook** (`hooks/use-protected-page.ts`, which does `.catch(() => setOnboardingChecked(true))`). A failed `fetchOnboardingStatus` call here (e.g. a transient network error) would become an unhandled promise rejection rather than failing gracefully — functionally low-impact (the user just stays on this page and can still submit the form), but inconsistent with the established pattern and noisy for error monitoring/unhandled-rejection tracking.
   **Fix:** added `.catch(() => {})` to the mount-time `fetchOnboardingStatus(api)` call, matching the shared hook's graceful-failure behavior.

## Unused/dead fields
Not applicable — no list/detail payload to diff against on this page.

## Loading/error/realtime behavior
Manual `isLoading`/`isAuthenticated` gate (via `AuthLoading`) rather than the shared `useCustomerQuery`/`useProtectedPage` pattern, for the reason described in Authorization above. `submitting` guards the save action's loading state; a failed save surfaces `error` inline. No polling or realtime subscription.
