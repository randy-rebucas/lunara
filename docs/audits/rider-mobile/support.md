# Audit: Rider-mobile — Help & Support (static FAQ + contact)

Date: 2026-07-24

## Entry point
- Page: `apps/rider-mobile/app/support.tsx`
- Component(s): inline `FaqCard`, `ContactCard` — no sub-components in other files.

## Sub-pages
None — no outbound navigation into a detail route; a fully static screen with two `Linking.openURL` actions. Reached from `(tabs)/profile.tsx`'s "Help & support" row (see [profile.md](profile.md) Sub-pages table).

## Data flow
None — this screen makes no network calls. All FAQ content is a hardcoded array (`support.tsx:9-30`); the two contact actions open the device's mail/phone app via `Linking.openURL`, not an in-app request.

## Backend trace
Not applicable — no backend endpoint involved.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| FAQ cards (×4) | hardcoded `q`/`a`/`icon` | static copy, no data dependency, nothing to verify against a backend source |
| Email support | `appConfig.supportEmail` (from `@lunara/config`) | correctly centralized — matches the pattern of pulling shared contact info from config rather than hardcoding it in the component |
| Dispatch hotline | previously a phone number hardcoded directly in this file | see Findings #1 |
| Emergency SOS | static informational card, `disabled` (no `onPress`) | correctly signals via `hint`/`actionLabel` that the real SOS action lives on task screens (`SosButton`, already covered in [home.md](home.md) pickup/delivery sub-page trace) rather than duplicating that control here — appropriate design, not a bug |

## Mutations
None — no create/update/delete actions; the two "actions" (`contactSupport`, `callDispatch`) just hand off to the OS mail/phone app, with no in-app state change or request to track for double-submit/failure-visibility concerns.

## Authorization
Not applicable — static screen, no data endpoints, no role-scoped access to check.

## Findings

1. **Dispatch phone number was hardcoded in the component instead of centralized config — `[fixed]`.** `support.tsx` (pre-fix) called `Linking.openURL('tel:+63281234567')` directly, while the adjacent "Email support" card correctly sourced its contact info from `appConfig.supportEmail` (`@lunara/config`). This asymmetry meant updating the dispatch hotline number would require finding and editing this specific screen's source rather than the shared config file every other piece of Lunara contact info already lives in — an easy thing to miss during an actual number change, unlike the email address which is impossible to update in only one of two places since there's only one place.
   **Fix:** added `supportPhone: '+63281234567'` to `appConfig` in `packages/config/src/index.ts`, rebuilt the package (`tsc`, since `@lunara/config` is consumed via its built `dist/`), and updated `support.tsx` to call `Linking.openURL(\`tel:${appConfig.supportPhone}\`)` instead of the inline literal. Grepped the rest of the monorepo for the same number or a similar hardcoded dispatch phone in other apps (customer-mobile, customer-web) — found none, so this was a single, contained instance, not a wider duplicated-constant problem like the document-types/notification-category lists flagged in [documents.md](documents.md) and [notifications.md](notifications.md).

## Unused/dead fields
Not applicable — no API payload to check for dead fields.

## Loading/error/realtime behavior
Not applicable — no loading/error states exist since there's no data fetch; the screen renders synchronously from static content.
