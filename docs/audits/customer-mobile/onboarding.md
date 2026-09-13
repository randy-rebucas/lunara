# Audit: Customer-mobile — Onboarding (profile + address)

Date: 2026-07-24

## Entry point
- Screens: `apps/customer-mobile/app/onboarding/profile.tsx`, `apps/customer-mobile/app/onboarding/address.tsx`
- Component(s): `BrandMark`, `OnboardingProgress`, `Card`, `Input`, `Button`, `MapPickerModal` (address screen only)

## Sub-pages
Not detail routes — the two screens form a linear flow (`profile` -> `address` -> `(tabs)`), each redirecting forward/backward based on `fetchOnboardingStatus`. Each screen also redirects to `/(auth)/signup` if there's no access token at all.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Onboarding status (mount redirect check, both screens) | — (via `fetchOnboardingStatus`) | `/customers/me/onboarding` | `OnboardingStatus` | already traced in `docs/audits/customer-mobile/login.md` |
| Save profile | PATCH | `/customers/me` | `{ firstName, lastName }` | `CustomersController.updateMe` -> `CustomersService.updateProfile` |
| Save email (optional field, only sent if filled in) | POST | `/auth/email` | `{ email }` | `AuthController.setEmail` -> `AuthService.setEmail` |
| Save address | POST | `/addresses` | `{ label: 'Home', line1, line2?, city, province, postalCode, latitude?, longitude?, isDefault: true }` | `AddressesController.create` -> `AddressesService.create` — same endpoint already traced in `docs/audits/customer-web/profile.md` |

## Backend trace
`CustomersService.updateProfile` (read in full) only ever touches `firstName`/`lastName` on the `Customer` document — it has no awareness of `email` at all, because email is a field on the separate `User` model (owned by `AuthService`/`UsersService`), not `Customer`. `UpdateCustomerDto` correspondingly declares only `firstName`/`lastName`. Confirmed the API's global `ValidationPipe` (`main.ts:30-32`) is configured with `whitelist: true, forbidNonWhitelisted: true` — meaning any request body property not declared on the target DTO causes the **entire request to be rejected with a 400**, not silently dropped. See Finding #1 (now resolved via a dedicated endpoint, see below).

`AuthService.setEmail(userId, email)` (new) is the wiring for Finding #1's previously-open product/backend decision: it looks up the user by id, no-ops if the email is unchanged, checks the new email isn't already used by another account (`ConflictException` if so), then sets `email`, resets `isEmailVerified` to `false`, saves, and reuses the existing `sendVerificationEmail` private helper (same one `register()` and `resendVerification()` call) to send the verification link. Exposed via `POST /auth/email` (`JwtAuthGuard`, same throttle bucket as `change-password`). Deliberately lives in `AuthModule`, not `CustomersModule` — `CustomersService` already depends on nothing from `AuthModule` and `AuthService` already depends on `CustomersService` (for registration), so adding email logic to `CustomersService` would have required a circular module dependency.

`AddressesService.create` is the same already-audited, correctly-scoped endpoint.

## Cards / panels

**Profile step:**
| Card | Fields consumed | Notes |
|---|---|---|
| Name fields | `firstName`, `lastName` | **[FIXED]** now `maxLength={80}` matching `UpdateCustomerDto` |
| Email field (optional) | `email` | **[FIXED]** — see Finding #1; now sent to `POST /auth/email` (separately from the `PATCH /customers/me` name save) and triggers a verification email |

**Address step:**
| Card | Fields consumed | Notes |
|---|---|---|
| Method selector (Manual / My location / Pin on map) | local `method` state | |
| "My location" flow | `expo-location` foreground permission, `Location.getCurrentPositionAsync`, `reverseGeocodeAddress(lat, lng)` to prefill fields | falls back to manual entry with a clear message if permission is denied or geocoding fails — good degrade-gracefully behavior, not a bug |
| "Pin on map" flow | `MapPickerModal` (not separately re-traced), same reverse-geocode prefill on confirm | |
| Address form fields | `line1`, `line2` (optional), `city`, `province`, `postalCode` (digits-only, capped at 4, validated against `/^\d{4}$/` before submit) | field set and bounds match `CreateAddressDto` exactly (no `maxLength` gaps here — the DTO itself only constrains `label`, which this screen hardcodes to `'Home'` and never exposes as an input) |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save profile & continue | no | n/a | yes (`disabled={submitting}`) | yes (`error`) — **[FIXED]** no longer spuriously fails when the optional email field is filled in, see Finding #1 |
| Save address & finish setup | no | n/a | yes (`disabled={submitting \|\| locating}` — also correctly blocks submission while a location fetch is in progress) | yes (`error`) |
| Switch input method | yes, destructive (clears typed fields on entry to Manual) — **[FIXED]**, see Finding #2: no longer fires on a redundant tap of the already-active Manual tab | n/a | n/a | n/a |

## Authorization
Both screens redirect unauthenticated visitors to `/(auth)/signup` before rendering anything. Underlying endpoints already confirmed scoped to `req.user.sub`. No `[authz]` issues.

## Findings

1. **[FIXED, fully wired] Filling in the optional email field during profile onboarding caused the *entire* profile save to fail with a validation error, blocking a new customer from completing onboarding at all.** `handleSubmit` (pre-fix) conditionally included `email` in the `PATCH /customers/me` body whenever the field was non-empty — but `UpdateCustomerDto` has no `email` property (confirmed by reading `customers.service.ts`/`customer.dto.ts` in full: `updateProfile` only ever reads `dto.firstName`/`dto.lastName`), and the API's global `ValidationPipe` is configured with `forbidNonWhitelisted: true`, which rejects the whole request with a 400 the moment it sees an undeclared property — not a partial-success-minus-email outcome, a hard failure with no visible field-level error explaining *why* (the screen would just show a generic "Could not save profile" message). This is a first-run-experience bug of real severity: a brand-new customer who reasonably fills in the clearly-labeled, encouraged "Email address (optional)" field — with a hint promising order updates and promotions — would be silently blocked from finishing account setup, with the actual cause (an unsupported field) invisible to them.
   **First pass:** stopped sending `email` in the `PATCH /customers/me` body, unblocking onboarding but leaving the field dead (collected, never persisted) pending a product/backend decision on uniqueness + verification.
   **Follow-up (this pass):** added `AuthService.setEmail` + `POST /auth/email` (`JwtAuthGuard`) — checks the email isn't already used by another account, sets it on the `User` model, marks it unverified, and sends the same verification-link email the register/resend flows use. `profile.tsx` now calls this endpoint right after the `PATCH /customers/me` name save, only when the field is non-empty, and surfaces any error (e.g. "Email already in use") inline instead of silently discarding it. A customer who fills this in during onboarding now gets a real account email, pending their clicking the verification link — same as the register-with-email flow.

2. **[FIXED] Tapping the already-active "Manual" method tab on the address step silently wiped every field the customer had typed.** `selectMethod('manual')` unconditionally called `clearAddressFields()` whenever `manual` was selected — including when `method` was already `'manual'`, i.e. the customer is mid-typing and taps the (already-highlighted) "Manual" button by mistake. The method-selector row sits directly above the form fields as three large, equal-width touch targets, making an accidental re-tap of the currently-active one a realistic mis-tap, and there is no confirmation before the wipe.
   **Fix:** `selectMethod` now no-ops when `m === 'manual' && method === 'manual'` — re-tapping "Manual" while already in manual mode does nothing. Re-tapping "My location" or "Pin on map" while already active is left as-is (intentionally re-triggers a fresh location fetch / reopens the map modal), since those aren't destructive in the same way.

3. **[FIXED] Both screens' mount-time `fetchOnboardingStatus(...).then(...)` had no `.catch` — and unlike the identical bug already fixed in `_layout.tsx`/`redirectAfterAuth` (`docs/audits/customer-mobile/login.md`, Finding #2), a failure here didn't just risk an unhandled rejection, it left the screen permanently blank.** `setChecking(false)` (the only thing that lets the screen render anything instead of returning `null`) was only called inside the success branch's final `else` — a thrown/rejected `fetchOnboardingStatus` call meant `checking` stayed `true` forever, so the customer would see a blank white screen with no error, no retry, and no way to proceed, for as long as they stayed on that screen. This is a strictly worse failure mode than the `_layout.tsx`/`redirectAfterAuth` instances of the same missing-catch pattern (those just risked a console warning or an incorrect redirect target), since this one can fully brick onboarding on a transient network blip.
   **Fix:** added `.catch(() => setChecking(false))` to both screens' status-check effects — a failed check now falls through to showing the form (consistent with the "assume incomplete, let a deeper check or the user's own submission catch it" philosophy already established for this exact function elsewhere in the app).

## Unused/dead fields
None remaining — `email` (profile step) is now wired end-to-end, see Finding #1.

## Loading/error/realtime behavior
Both screens gate all rendering behind a `checking` boolean during the mount-time status check (now correctly resolved on both success and failure, see Finding #2) rather than using `DataLoadState` — reasonable for a screen with no list/detail content to show a partial-loading state for. No polling or realtime subscription.
