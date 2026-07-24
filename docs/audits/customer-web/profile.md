# Audit: Customer-web — Profile

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/profile/page.tsx` (`'use client'`)
- Component(s): `PageShell`, `PageHeader`, `DataPageStatus`, `AuthLoading`, `ProfileAvatarUpload`, `AddressFormModal`, `ShareInviteCard`, `Card`/`CardBody`, `FormLabel`/`Input`, `Button`

## Sub-pages
None as detail routes — `/support`, `/refunds`, `/notifications` are linked as sibling feature entry points (own modules, not yet audited), not detail views of this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Profile + addresses | GET | `/customers/me`, `/addresses` (parallel) | `CustomerProfile`, `CustomerAddress[]` | `CustomersController.getMe` -> `CustomersService.getProfile`; `AddressesController.findAll` -> `AddressesService.findAll` |
| Update profile | PATCH | `/customers/me` | `{ firstName, lastName }` | `CustomersController.updateMe` -> `CustomersService.updateProfile` |
| Upload avatar | POST | `/customers/me/avatar` (multipart) | `CustomerProfile` | `CustomersController` avatar upload handler |
| Create/update address | POST/PATCH | `/addresses`, `/addresses/:id` | `AddressFormValues` -> `CustomerAddress` | `AddressesController.create`/`update` -> `AddressesService` |
| Delete address | DELETE | `/addresses/:id` | — | `AddressesController.remove` -> `AddressesService.remove` |
| Set default address | PATCH | `/addresses/:id` (`{ isDefault: true }`) | `CustomerAddress` | same `update` handler |

## Backend trace
`AddressesService`'s every method (`findAll`/`create`/`update`/`remove`) filters or matches by `userId: new Types.ObjectId(userId)` taken from `req.user.sub` — confirmed no request param can widen scope to another user's addresses; `update`/`remove` additionally match on `{ _id: id, userId }` together so passing someone else's address id 404s rather than leaking or mutating it. `create`/`update`'s "set as default" logic correctly unsets `isDefault` on the user's other addresses first (`updateMany` scoped to the same `userId`) before applying the new default, so there's no path to ending up with two defaults. `update` explicitly filters out `undefined` fields before `Object.assign` (commented, deliberate) to avoid a class-transformer footgun overwriting untouched fields — correct.

`CustomersService.updateProfile` validates `firstName`/`lastName` bounds via `UpdateCustomerDto` (`@MinLength(1)`/`@MaxLength(80)`, both optional) — the frontend's `Input`s previously had no `maxLength`, see Finding #2.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Avatar/identity card | `profile.avatarUrl`, `displayName` (derived: real name once `firstName !== 'Customer'` placeholder, else falls back to `user.email` local-part or `user.phone`), `profile.loyaltyPoints` (only shown if `> 0`), `user.email`, `user.phone` | the `!== 'Customer'` placeholder check doesn't match the actual OTP-signup placeholder constant (`OTP_PROFILE_PLACEHOLDER_FIRST_NAME`, confirmed elsewhere in this audit series as `'Customer'` — verified they do match by value, just not by importing the shared constant) — cosmetic coupling risk if the placeholder string ever changes on the backend without updating this literal, not fixed since it's a soft UX fallback, not a correctness bug today |
| Personal details form | `firstName`, `lastName` (local editable state, seeded from `profile` on load) | **[FIXED]** now capped at `maxLength={80}` matching the backend bound |
| Saved addresses list | per-address: `label` (via delete-confirm text), `addressType` (via `formatAddressTypeLabel`), `isDefault`, `line1`, `line2`, `city`, `province`, `postalCode` | |
| Help & account links | static, -> `/support`, `/refunds`, `/notifications` | |
| Share/invite card | self-contained, own data flow, not traced here | |
| Sign out button | none — calls `logout()` from `useAuthContext` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save profile | no | n/a | yes (`disabled={profileSaving}`) | yes (`profileError`) |
| Upload avatar | no | n/a | yes (`disabled={uploading}` in `ProfileAvatarUpload`) | yes (error surfaced in the upload component) |
| Add/edit address | no | n/a | yes (`saving` passed into `AddressFormModal`) | assumed yes via the modal — not re-traced here (modal not opened as part of this page's own audit scope) |
| Delete address | yes | yes (`window.confirm`) | **[FIXED]** now yes (`actioningAddressId`-based `disabled`) — previously none | yes (`window.alert`) |
| Set default address | no | n/a | **[FIXED]** now yes (same `actioningAddressId` guard) — previously none | yes (`window.alert`) |

## Authorization
No cross-tenant exposure — every endpoint this page calls is scoped to `req.user.sub` server-side (see Backend trace), with `update`/`remove` additionally requiring the address to belong to the caller. No `[authz]` issues.

## Findings

1. **[FIXED] Address row actions ("Set default", "Delete") had no per-item busy/disabled state**, unlike every other mutation on this page (profile save, avatar upload, address modal save all already guarded `submitting`-style). A fast double-click on "Delete" could fire two `DELETE` requests for the same address — the second would 404 and pop a confusing "Could not delete address" alert even though the first delete had already succeeded; a double-click on "Set default" would fire two redundant `PATCH` requests (harmless outcome, but still an unguarded in-flight mutation, inconsistent with the rest of the page).
   **Fix:** added `actioningAddressId` state; both buttons for the address currently being acted on are now `disabled` and show "Working…" while their request is in flight (`profile/page.tsx`).

2. **[FIXED] Name inputs had no `maxLength`, unlike every other free-text field audited elsewhere in this series (e.g. `partners/apply`, `riders/apply`), while the backend enforces `@MaxLength(80)` on both `firstName`/`lastName`.** A user typing a very long name would get a late server-side rejection instead of an immediate input cap.
   **Fix:** added `maxLength={80}` to both `Input`s, matching `UpdateCustomerDto`.

3. **[FIXED] `AddressFormModal`'s Label field had no `maxLength`, while the backend enforces `@MaxLength(50)` on `CreateAddressDto`/`label`.** Found while auditing `docs/audits/customer-web/onboarding-address.md`, whose own address form had the identical gap against the same DTO — fixed both together for consistency.
   **Fix:** added `maxLength={50}` to the Label `Input` in `components/profile/address-form-modal.tsx`.

## Unused/dead fields
None found — every field returned by `/customers/me` and `/addresses` is rendered somewhere on the page (loyalty points conditionally, avatar conditionally via `resolveMediaUrl`'s null-handling).

## Loading/error/realtime behavior
Uses the shared `useCustomerQuery` hook (see `docs/audits/customer-web/dashboard.md`, Finding #1 — the "wipes data on error" fix applies here too; this page's render logic already tolerates stale `data` alongside an `error`, no regression). `DataPageStatus` handles the initial loading/error display; there's no retry button on this page specifically (unlike `/wallet`), so a failed initial load leaves the user with just the error banner and no addresses/profile UI until they navigate away and back — a minor UX gap, not fixed here since adding a retry affordance is a small scope expansion beyond what was flagged, and every mutation already triggers its own `reload()` on success which would recover the page regardless. No polling or realtime subscription.
