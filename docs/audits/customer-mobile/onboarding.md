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
| Save address | POST | `/addresses` | `{ label: 'Home', line1, line2?, city, province, postalCode, latitude?, longitude?, isDefault: true }` | `AddressesController.create` -> `AddressesService.create` — same endpoint already traced in `docs/audits/customer-web/profile.md` |

## Backend trace
`CustomersService.updateProfile` (read in full) only ever touches `firstName`/`lastName` on the `Customer` document — it has no awareness of `email` at all, because email is a field on the separate `User` model (owned by `AuthService`/`UsersService`), not `Customer`. `UpdateCustomerDto` correspondingly declares only `firstName`/`lastName`. Confirmed the API's global `ValidationPipe` (`main.ts:30-32`) is configured with `whitelist: true, forbidNonWhitelisted: true` — meaning any request body property not declared on the target DTO causes the **entire request to be rejected with a 400**, not silently dropped. See Finding #1.

`AddressesService.create` is the same already-audited, correctly-scoped endpoint.

## Cards / panels

**Profile step:**
| Card | Fields consumed | Notes |
|---|---|---|
| Name fields | `firstName`, `lastName` | **[FIXED]** now `maxLength={80}` matching `UpdateCustomerDto` |
| Email field (optional) | `email` | **[FIXED]** — see Finding #1; no longer sent to the backend (kept in the UI, collected but not persisted, since removing the field is a product call and the backend fix needed to actually support it is out of this pass's scope) |

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

## Authorization
Both screens redirect unauthenticated visitors to `/(auth)/signup` before rendering anything. Underlying endpoints already confirmed scoped to `req.user.sub`. No `[authz]` issues.

## Findings

1. **[FIXED] Filling in the optional email field during profile onboarding caused the *entire* profile save to fail with a validation error, blocking a new customer from completing onboarding at all.** `handleSubmit` (pre-fix) conditionally included `email` in the `PATCH /customers/me` body whenever the field was non-empty — but `UpdateCustomerDto` has no `email` property (confirmed by reading `customers.service.ts`/`customer.dto.ts` in full: `updateProfile` only ever reads `dto.firstName`/`dto.lastName`), and the API's global `ValidationPipe` is configured with `forbidNonWhitelisted: true`, which rejects the whole request with a 400 the moment it sees an undeclared property — not a partial-success-minus-email outcome, a hard failure with no visible field-level error explaining *why* (the screen would just show a generic "Could not save profile" message). This is a first-run-experience bug of real severity: a brand-new customer who reasonably fills in the clearly-labeled, encouraged "Email address (optional)" field — with a hint promising order updates and promotions — would be silently blocked from finishing account setup, with the actual cause (an unsupported field) invisible to them.
   **Fix:** stopped sending `email` in the PATCH body — `firstName`/`lastName` only, matching what the DTO actually accepts. The input field itself was left in place (removing a visible, promised feature is a product call, not something to silently delete during an audit pass) but now collects a value that goes nowhere; this is flagged prominently rather than silently patched over.
   **Still needs a product/backend decision:** to make the email field actually functional, `email` would need to be added to the `User` model update path (a different module than `Customer`), including deciding on uniqueness validation against other accounts' emails (since email is also a login credential) and whether/how to verify it. Out of scope for a safe frontend-only fix.

2. **[FIXED] Both screens' mount-time `fetchOnboardingStatus(...).then(...)` had no `.catch` — and unlike the identical bug already fixed in `_layout.tsx`/`redirectAfterAuth` (`docs/audits/customer-mobile/login.md`, Finding #2), a failure here didn't just risk an unhandled rejection, it left the screen permanently blank.** `setChecking(false)` (the only thing that lets the screen render anything instead of returning `null`) was only called inside the success branch's final `else` — a thrown/rejected `fetchOnboardingStatus` call meant `checking` stayed `true` forever, so the customer would see a blank white screen with no error, no retry, and no way to proceed, for as long as they stayed on that screen. This is a strictly worse failure mode than the `_layout.tsx`/`redirectAfterAuth` instances of the same missing-catch pattern (those just risked a console warning or an incorrect redirect target), since this one can fully brick onboarding on a transient network blip.
   **Fix:** added `.catch(() => setChecking(false))` to both screens' status-check effects — a failed check now falls through to showing the form (consistent with the "assume incomplete, let a deeper check or the user's own submission catch it" philosophy already established for this exact function elsewhere in the app).

## Unused/dead fields
`email` (profile step) is now a genuinely dead field in the sense that it's collected but never transmitted — see Finding #1, which explains why removing vs. wiring it up is a product decision rather than something fixed silently here.

## Loading/error/realtime behavior
Both screens gate all rendering behind a `checking` boolean during the mount-time status check (now correctly resolved on both success and failure, see Finding #2) rather than using `DataLoadState` — reasonable for a screen with no list/detail content to show a partial-loading state for. No polling or realtime subscription.
