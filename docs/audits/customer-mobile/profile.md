# Audit: Customer-mobile — Profile (tabs)

Date: 2026-07-23

## Entry point
- Screen: `apps/customer-mobile/app/(tabs)/profile.tsx`
- Component(s): `ProfileAvatar`, `AddressFormModal`, `ShareInviteCard`, `Card`, `Input`, `Button`, `DataLoadState`

## Sub-pages
None as detail routes — links out to `/support`, `/refunds`, `/scan-tag`, `/notifications` (separate modules, not yet audited) and external URLs (privacy/terms, Google Maps, `mailto:`).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Profile + addresses | GET | `/customers/me`, `/addresses` (parallel) | `CustomerProfile`, `CustomerAddress[]` | already traced in `docs/audits/customer-web/profile.md` |
| Update profile | PATCH | `/customers/me` | `{ firstName, lastName }` | same |
| Upload avatar | POST | `/customers/me/avatar` (multipart) | `CustomerProfile` | same |
| Create/update address | POST/PATCH | `/addresses`, `/addresses/:id` | see Finding #1 for the `line2` encoding | same |
| Delete address | DELETE | `/addresses/:id` | — | same |
| Set default address | PATCH | `/addresses/:id` (`{ isDefault: true }`) | — | same |

## Backend trace
Same endpoints already fully traced for customer-web's `/profile` — `AddressesService`'s every method scopes to `userId`, `UpdateCustomerDto` enforces `@MaxLength(80)` on both name fields. Nothing new server-side; the interesting behavior on this screen is entirely in how the **client** encodes address data before sending it — see Finding #1.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Hero card | `profile.avatarUrl`, `displayName` (same placeholder-name fallback chain as customer-web), `user.email`/`phone` | |
| Personal details form | `firstName`/`lastName` | **[FIXED]** — see Finding #2 |
| Saved addresses | per-address `label`, `addressType`, `isDefault`, `line1`, decoded `line2`/`landmark`/`notes` (via `addressToForm`/`parseLegacyLine2`), GPS pin + "Open in Google Maps" deep link when coordinates are set | see Finding #1 for the encoding this decode relies on; action chips **[FIXED]** — see Finding #3 |
| Help & account | Support tickets / Refund requests / Scan my laundry tag / Privacy policy / Terms of service / Delete account | Privacy/Terms rows are live `Linking.openURL` calls — see Finding #4 for the Terms link specifically |
| Preferences | Notifications link, static "Secure payments" info row (no action) | |
| Share/invite card | self-contained | |
| Sign out | none — calls `logout()` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save profile | no | n/a | yes (`disabled={profileSaving}`) | yes (`profileError`) |
| Upload avatar | no | n/a | yes (`uploading` passed into `ProfileAvatar`) | assumed yes via that component (not re-traced) |
| Add/edit address | no | n/a | yes (`saving` passed into `AddressFormModal`) | assumed yes via the modal |
| Delete address | yes | yes (`Alert.alert`, destructive style) | **[FIXED]** now yes (`actioningAddressId`) — previously none | yes (`Alert.alert`) |
| Set default address | no | n/a | **[FIXED]** now yes (same guard) — previously none | yes (`Alert.alert`) |
| Delete account | yes (opens a pre-filled support email — doesn't delete anything itself) | yes (`Alert.alert`, destructive style, requires tapping through to "Email support") | n/a — no direct API call, just composes a `mailto:` | n/a |

## Authorization
Same already-confirmed scoping as `docs/audits/customer-web/profile.md`. No `[authz]` issues.

## Findings

1. **Addresses created on mobile pack `landmark`/`notes` as a JSON string into the backend's plain-text `line2` field — and this screen is the only client in the audited apps so far that knows how to decode it back out, meaning the raw JSON blob leaks into the UI on every other client.** `encodeAddressLine2` (`lib/profile-types.ts:71-77`) serializes `{ line2, landmark, notes }` into a single JSON string and sends it as the address's `line2` — a deliberate workaround since the backend `Address` schema/`CreateAddressDto` only has a plain optional `line2: string`, with no dedicated `landmark`/`notes` fields. This mobile screen correctly round-trips it (`parseLegacyLine2`, with a graceful fallback to treating a non-JSON `line2` as plain legacy text). **Confirmed** customer-web's `/profile` page does *not* know about this encoding — `docs/audits/customer-web/profile.md`'s `CustomerAddress`/`addressToForm` just does `line2: address.line2 ?? ''` and renders it verbatim (`profile/page.tsx:245`, `` {address.line2 ? `, ${address.line2}` : ''} ``). A customer who sets a landmark/note while adding an address on mobile, then opens their address on the website, would see something like `, {"line2":"","landmark":"Near the blue gate","notes":"Ring the bell twice"}` rendered as their street address — not just cosmetically broken, but potentially shown downstream to whoever actually needs to find the address (the booking flow's own `AddressOption` type doesn't include `line2` at all, so this specific leak doesn't reach the booking wizard's shop-matching step, but the raw text is still visibly wrong on the customer's own profile page). Partner-web/admin-web/rider-mobile haven't been audited yet in this pass, so it's unconfirmed but likely that any pickup/delivery address display there would show the same raw JSON if it renders `line2`.
   **Left unfixed** — this needs a product/schema decision: either add real `landmark`/`notes` fields to the backend `Address` schema (a real backend + DTO change, plus a migration decision for existing JSON-packed `line2` values) or teach every other consumer to defensively parse the same packed format (spreads a fragile, undocumented convention further rather than fixing the root cause). Not a safe code-only fix within this audit pass; flagging prominently since it's a real, currently-live data-correctness bug, not a hypothetical.

2. **[FIXED] Name inputs had no `maxLength`, the same gap already found and fixed on customer-web's `/profile` and `/onboarding/*`** (backend enforces `@MaxLength(80)` via the same `UpdateCustomerDto`).
   **Fix:** added `maxLength={80}` to both `Input`s.

3. **[FIXED] Address action chips ("Set default", "Edit", "Delete") had no per-address busy/disabled state**, the identical gap already found and fixed on customer-web's `/profile` (`docs/audits/customer-web/profile.md`, Finding #1) — a fast double-tap could fire two mutations for the same address.
   **Fix:** added `actioningAddressId` state; all three chips for the address currently being acted on are now `disabled` (with "Set default"/"Delete" showing "Working…") while their request is in flight, mirroring the web fix exactly.

4. **The "Terms of service" row is a live, tappable link that opens a page confirmed not to exist.** `termsUrl` resolves from `Constants.expoConfig.extra.termsUrl` (set in `app.config.js:53` to `${websiteUrl}/terms`) with the same fallback pattern as `privacyUrl` — but customer-web has no `/terms` route (confirmed via directory listing; only `/privacy` exists). This is the same underlying content gap already flagged in `docs/audits/customer-mobile/signup.md`, Finding #1 (no Terms of Service page exists anywhere in the monorepo) — cross-referenced there. Unlike signup's inert text, this manifests as an actual dead link a customer can tap and land on a 404.
   **Left unfixed** — same reasoning as the signup finding: needs the actual ToS content to exist somewhere before either screen can link to it correctly. "Privacy policy" on this screen is fine — `/privacy` is a real customer-web page.

## Unused/dead fields
None beyond what's covered in Finding #1 (not a dead field so much as a field carrying data no other client can read).

## Loading/error/realtime behavior
Uses `DataLoadState` with a retry button, correctly gated on `loading && !refreshing`. No polling or realtime subscription; pull-to-refresh correctly scoped with its own `refreshing` boolean.
