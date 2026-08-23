# Audit: Partner-web — Offline

Date: 2026-08-23

## Entry point
- Page: `apps/partner-web/src/app/offline/page.tsx`
- Component(s): none (self-contained static page)

This is a pure client-side PWA offline fallback route, not a data-backed feature
page. It has no `fetch`, no props, and renders unconditionally. There is no
backend call to trace and no `apps/api` module involved.

How it's reached: `apps/partner-web/public/sw.js` is a service worker that
intercepts `navigate`-mode fetches (`self.addEventListener('fetch', ...)`,
line 18-25); when the network `fetch` rejects it serves the cached
`/offline` response instead (`caches.open(CACHE_NAME).then((cache) =>
cache.match(OFFLINE_URL))`). The service worker is registered from
`apps/partner-web/src/components/sw-register.tsx`, which is mounted in
`apps/partner-web/src/app/layout.tsx:48`. On `install`, the SW precaches the
`/offline` route itself (`caches.open(CACHE_NAME).then((cache) =>
cache.addAll([OFFLINE_URL]))`), so the fallback page is available even on a
first-ever offline visit.

Two shared components special-case the `/offline` pathname so it renders
outside the normal authenticated app chrome:
- `apps/partner-web/src/components/auth-guard.tsx:11,14` — skips the
  token/redirect check for `/login` and `/offline`.
- `apps/partner-web/src/components/portal-shell.tsx:169,171` — disables the
  partner notifications socket and skips the sidebar/header chrome for
  `/login` and `/offline`.

## Sub-pages
None.

## Data flow
None — no HTTP calls, no reads of cached app data, no service worker state
inspected. The page is static markup with a single `window.location.reload()`
click handler.

## Backend trace
Not applicable — no backend call exists in this module.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Offline message card | none (static copy: "You're offline", explanatory text) | Purely static strings; no dynamic/cached data rendered. |
| Retry button | none | `onClick={() => window.location.reload()}` — re-issues a navigation, which the service worker's `fetch` handler will pass through to the network and only fall back to this page again if still offline. |

## Mutations
None.

## Authorization
Not applicable — the page renders no user/tenant data and requires no auth
check itself. It is explicitly exempted from `AuthGuard`'s token check (see
Entry point), which is correct: gating an offline-fallback page behind an
auth check that itself needs network/localStorage access would risk it also
failing to render offline. No `[authz]` findings.

## Findings

No issues found. The module is a minimal, correctly-wired static PWA offline
fallback:
- It is precached on install, so it's available before the app shell is ever
  fetched.
- It's exempted from the auth guard and portal shell chrome/socket, avoiding
  extra client-side work while offline.
- The retry action is a plain reload rather than a fetch-and-swap, which is
  the simplest correct way to re-attempt navigation and let the service
  worker's real network check decide the outcome.

Nothing here needed fixing; no code changes were made.

## Unused/dead fields
None — page has no data-bound fields.

## Loading/error/realtime behavior
No loading or error states apply (nothing is fetched). No realtime/socket
activity: `usePartnerNotificationsSocket` is explicitly disabled for this
route via the `enabled: pathname !== '/offline'` check in
`portal-shell.tsx:169`, so there's no risk of a socket connection attempt
thrashing while offline.
