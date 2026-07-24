# Audit: Customer-web — Onboarding: Address

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/onboarding/address/page.tsx` (`'use client'`)
- Component(s): `AuthShellWide`, `OnboardingProgress`, `Input`, `Button`

## Sub-pages
None as a detail route — this is the final onboarding step; on success it navigates directly to `/dashboard` rather than through the shared `getOnboardingPath` redirect helper the other auth pages use (reasonable here, since submitting this form is itself what completes onboarding — there's no status to re-check first).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Onboarding status (mount redirect check) | — (via `fetchOnboardingStatus(api)`) | `/customers/me/onboarding` | `OnboardingStatus` | already traced in `docs/audits/customer-web/login.md` |
| Save address | POST | `/addresses` | `{ ...form, isDefault: true }` | `AddressesController.create` -> `AddressesService.create` (already traced in `docs/audits/customer-web/profile.md`) |

## Backend trace
Same endpoints already traced elsewhere in this series — nothing new. `CreateAddressDto` (`address.dto.ts`) requires `label` (`@MaxLength(50)`), `line1`, `city`, `province`, `postalCode` as strings with no further length caps on the latter four; `line2`/`latitude`/`longitude`/`isDefault` are optional. This form always sends `isDefault: true`, which is correct for the very first address a customer adds during onboarding (the service's `create` unsets any other default first, but there won't be one yet).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Address form | `form.label` (defaults `'Home'`), `line1`, `line2` (optional), `city` (defaults `'Manila'`), `province` (defaults `'Metro Manila'`), `postalCode` | **[FIXED]** — see Finding #2 for the label field; the field set matches `CreateAddressDto` exactly (no `barangay`/`addressType` collected here, consistent with `CustomerAddress`'s shape used across the rest of the app — not a mismatch, this app's address model simply doesn't have a barangay field, unlike the partner/rider application forms audited earlier which do) |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save address & finish setup | no | n/a | yes (`disabled={submitting}`) | yes (`error`) |

## Authorization
Same deliberate exception to the shared `useProtectedPage` hook as `docs/audits/customer-web/onboarding-profile.md` (self-managed `isAuthenticated` gate to avoid a redirect loop) — same reasoning applies here, not re-explained. No `[authz]` issues; the underlying `/addresses` endpoint is already confirmed scoped to `req.user.sub`.

## Findings

1. **[FIXED] The mount-time onboarding-status redirect check had no `.catch`, the same gap already found and fixed on the sibling `/onboarding/profile` page** (`docs/audits/customer-web/onboarding-profile.md`, Finding #2) — an identical `fetchOnboardingStatus(api).then(...)` with no error handling, risking an unhandled promise rejection on a transient network failure.
   **Fix:** added `.catch(() => {})`, mirroring the `/onboarding/profile` fix exactly.

2. **[FIXED] The Label input had no `maxLength`, while the backend enforces `@MaxLength(50)` on `CreateAddressDto`/`label`.** The same gap was also found on `/profile`'s `AddressFormModal` (same DTO, same field) — fixed both together.
   **Fix:** added `maxLength={50}` here and to `components/profile/address-form-modal.tsx`'s Label field; see `docs/audits/customer-web/profile.md`, Finding #3 for the cross-referenced fix.

## Unused/dead fields
Not applicable — no list/detail payload to diff against on this page.

## Loading/error/realtime behavior
Manual `isLoading`/`isAuthenticated` gate, same pattern as `/onboarding/profile`. `submitting` guards the save action; a failed save surfaces `error` inline. No polling or realtime subscription.
