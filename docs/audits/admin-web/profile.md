# Audit: Admin-web — Profile

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/profile/page.tsx`
- Component(s): inline in the page file, no separate board component

## Sub-pages
None — no outbound navigation into a dynamic detail route. Links to `/settings`,
`/audit-log`, `/users`, `/control-tower` are sibling top-level pages (already
audited separately), not detail views of this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Current user | — (client cache only, `getAdminUser()`) | — | `User` (`@lunara/types`) | none — read from `localStorage`, populated at login/token-refresh time, never re-fetched |
| Recent activity | GET | `/admin/audit-logs?actorEmail=<my email>&limit=10` | `AuditLogPage` (local subset type) | `AuditLogController.list` -> `AuditLogService.list` |
| Send password reset | POST | `/auth/forgot-password` | — | `AuthController.forgotPassword` -> `AuthService.forgotPassword` |
| Sign out | POST | `/auth/logout` (via `adminLogout()`) | — | `AuthController.logout` |

## Backend trace
The activity tab reuses the same `AuditLogService.list` traced in
`docs/audits/admin-web/audit-log.md`, scoped by `actorEmail` (an exact-match
filter, not a regex — `audit-log.service.ts:63`) to just this admin's own
entries, `limit=10`. `forgotPassword` and `logout` are the same shared auth
endpoints used elsewhere — `logout` clears the `portal_token` cookie and
revokes server-side session state for `req.user.sub`
(`auth.controller.ts:90-98`); `forgotPassword` is unauthenticated by design
(OTP-throttled) since it must work before the user has a session.

## Cards / panels
Identity card (left rail):

| Card | Fields consumed | Notes |
|---|---|---|
| Avatar / name / role / status | `displayName` (client-derived from `user.email` or `user.phone`), `user.role`, `user.isActive` | |
| Contact list | `user.email`, `user.phone`, `user.createdAt` | |
| Sign out | n/a | |

Tabbed detail card:

| Card | Fields consumed | Notes |
|---|---|---|
| Account information | `user.email`, `.phone`, `.role`, `.isActive`, `.createdAt`, `.lastLoginAt`, `.id` (+ copy-to-clipboard) | static note explains these are admin-managed, not self-editable here — correctly matches that there's no PATCH-self endpoint wired |
| Security — Password | `user.email` | triggers the reset-email flow, doesn't read/write a password field directly |
| Security — Session | `user.lastLoginAt`, hardcoded "7 days" session-lifetime text | see Findings — the hardcoded value doesn't correspond to a value this app's code reads |
| Security — Access | static text + link to `/audit-log` | |
| Activity log | `activity.data.items[].method/action/path/statusCode/createdAt` | `actionLabel` strips the `get./post./...` prefix client-side (duplicate of the same helper in `audit-log/page.tsx`, not shared — minor duplication, not a bug) |

Right rail:

| Card | Fields consumed | Notes |
|---|---|---|
| Account summary | `activity.data.total` (as "Actions logged"), `daysSince(user.createdAt)`, `timeAgo(user.lastLoginAt)`, `user.isActive`/`.role` | |
| Quick links | static list | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Send password reset link | no | n/a | yes (`disabled` while sending/already sent/no email) | yes (`resetError`) |
| Sign out | no (safe, expected one-click action, consistent with every other sign-out control in the app) | no | n/a (immediate) | not applicable — `adminLogout` best-effort calls the API and always clears local state regardless of network result |
| Copy user ID | no | n/a | n/a | n/a (clipboard failure silently ignored, consistent with the same pattern in `settings/page.tsx`'s `copyApiUrl`) |

## Authorization
No role-scoped endpoint on this page beyond what any authenticated admin already can reach: `GET /admin/audit-logs` is `@Roles(UserRole.ADMIN)` (matches, this whole app is admin-only) and is scoped by `actorEmail` to the signed-in admin's own email, which is read from the client's own cached `user.email`, not attacker-controllable to widen to another admin's activity. `POST /auth/forgot-password` and `POST /auth/logout` are the same shared, non-role-scoped endpoints every app uses. No `[authz]` issues.

## Findings

1. **Profile data is a stale client-side cache with no freshness check.** `user` (`page.tsx:144,149`) comes entirely from `getAdminUser()`, which reads whatever `User` object was embedded in the JSON response at the last login or token refresh (`admin-api.ts:84-92`) — this page never calls a "get current user" endpoint to confirm the data is still accurate. If another admin changes this account's role or deactivates it mid-session (e.g. via the Users page), this profile page keeps showing the old role and an "Active" badge until the viewing admin's access token happens to be refreshed *and* that refresh response happens to include an updated `user` object (`admin-api.ts:142` only updates `authData.user` if `body.data.user` is present — not guaranteed for every refresh implementation) or they log out and back in. A real "get my profile" endpoint already exists and is reachable by any authenticated role (`GET /users/me` -> `UsersController.getProfile`, `apps/api/src/modules/users/users.controller.ts:32-35`, `UsersService.getProfile` at `users.service.ts:26-30`), but it returns the raw Mongoose document (keyed `_id`, Mongo `Date` fields) rather than the `id`-keyed shape the frontend's `User` type (`@lunara/types`) expects — reconciling that shape mismatch is more than a one-line fix.
   Left unfixed: wiring this page to `/users/me` for a fresh read requires resolving the `_id`-vs-`id` (and Date serialization) mismatch between what that endpoint returns today and what `@lunara/types`' `User` expects elsewhere in the app — a shape decision that affects more than just this page, out of scope for a page-level fix in this pass.

2. The "Session lifetime: 7 days, then re-authentication is required" text (`page.tsx:384`) doesn't correspond to any value this app's own session logic actually reads. It matches the `httpOnly` `portal_token` cookie's `maxAge` (`auth.controller.ts:16`, `COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000`) — but as documented in `docs/audits/admin-web/login.md`, admin-web's SPA session is governed entirely by the JSON `tokens.expiresIn`/refresh-token flow in `admin-api.ts`, not that cookie, which this app never reads. The real session lifetime (how long the refresh token stays valid before a forced re-login) isn't surfaced anywhere in the traced frontend code. Left unfixed: correcting the copy needs confirming the actual refresh-token TTL from `AuthService` (not traced here, out of scope for this page's own code), a backend-config question rather than a frontend bug.

## Unused/dead fields
None found specific to this page's own fetches — the audit-log activity feed
only requests the fields it renders (`_id/action/method/path/statusCode/createdAt`,
a narrower local `AuditLogEntry` type than the full one used on `audit-log/page.tsx`,
appropriately trimmed for this summary view).

## Loading/error/realtime behavior
The cached-user read is synchronous (`getAdminUser()` inside a `useEffect`,
`page.tsx:148-150`) with `user === undefined` used as the initial "loading"
sentinel and `user === null` as the "no session" state — both handled with
dedicated early returns. The activity tab uses the shared `useAdminQuery` hook
(spinner, error text without clearing prior data, explicit empty state) same
as every other module. No polling or realtime subscription on this page.
