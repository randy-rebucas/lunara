# Audit: Admin-web — Login

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/login/page.tsx`
- Component(s): `LoginForm` (client component, wrapped in `Suspense` for `useSearchParams`), inline in the same file

## Sub-pages
None — no outbound navigation into a dynamic detail route. "Forgot Password?"
and "Contact Support" are both `href="#"` placeholders (see Findings), not
real sub-pages.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Sign in | POST | `/auth/login` | inline `{ user: User; tokens: AuthTokens }` inside `adminLogin` (`admin-api.ts:191-220`) | `AuthController.login` -> `AuthService.login` |
| Session bootstrap check | — | reads `getAdminToken()`/`localStorage` only, no network call | — | — |

## Backend trace
`AuthController.login` is throttled at the route level (`@Throttle` with a
10-requests/60s-per-IP budget, tighter than the global default — comment at
`auth.controller.ts:18-20` explains this is deliberate brute-force/credential-
stuffing protection) and takes any of email/phone/password/otp via `LoginDto`
(all fields `@IsOptional()`, validated per-type when present — the branching
between password vs OTP login lives in `AuthService.login`, not traced further
here as it's shared auth infra, not login-page-specific). On success it also
sets an `httpOnly`, `sameSite: strict` cookie (`portal_token`, 7-day max-age)
in addition to returning the JSON token pair — the admin-web client only uses
the JSON tokens (via `adminLogin`/`persistAuth` into `localStorage`), the
cookie is unused by this app (likely consumed by a different surface, e.g. an
SSR-rendered portal — out of scope here).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Marketing rail (left, desktop only) | static `features` array (icon/title/description) | fully hardcoded, no backend data |
| Email field | `email` (local state) | |
| Password field | `password` (local state), `showPassword` toggle | |
| Remember me checkbox | `remember` (local state) | **not wired to anything** — see Findings |
| Forgot Password / Contact Support links | none (both `href="#"`) | see Findings |
| Error banner | `error` (derived from thrown `Error.message`) | |
| Dev credential hint | `process.env.NODE_ENV` | build-time only, correctly hidden outside development |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Sign in | no | n/a | yes (`disabled={loading}` on submit button) | yes (`alert-error` banner, preserves entered email/password so the user isn't forced to retype) |

## Authorization
`POST /auth/login` itself has no role guard (any account type can authenticate
through it — expected, since it's shared across admin-web/partner-web/customer-
web/rider clients). The admin-specific gate lives entirely client-side in
`adminLogin` (`admin-api.ts:213-215`): it checks `body.data.user.role !== 'admin'`
and throws `'Admin account required'` *before* calling `persistAuth`, so a
non-admin credential pair that successfully authenticates against the shared
endpoint never gets tokens written to this app's `localStorage` and the login
page shows a rejection. This is consistent with how the rest of admin-web
enforces access (every backend route the dashboard then calls is independently
`@Roles(UserRole.ADMIN)`-guarded), so a non-admin who somehow bypassed this
client check would still be turned away by every subsequent API call — no
`[authz]` gap.

## Findings

1. **Open-redirect via the unsanitized `redirect` query param.** `redirectTo = searchParams.get('redirect') ?? '/'` (pre-fix, `page.tsx:47`) was passed directly to `router.replace(redirectTo)` after both the token-already-present check (`page.tsx:49-53`) and a successful login (`page.tsx:61`), with no validation that it points back into this app. A crafted link like `/login?redirect=//evil.example.com/phish` (protocol-relative) or an absolute URL sent to an admin could redirect them off-site immediately after they authenticate — a classic phishing/open-redirect pattern targeting the login flow specifically.
   **Fix:** constrained `redirectTo` to same-origin relative paths only — must start with `/` and not `//` (which browsers/routers treat as protocol-relative to another host) — falling back to `/` otherwise, `apps/admin-web/src/app/login/page.tsx:47-49`. Checked: no other app in this monorepo uses this `searchParams.get('redirect')` pattern, so this isn't a shared-code fix affecting other modules.

2. **"Remember me" checkbox has no effect.** `remember` state (`page.tsx:43`) is rendered and toggled but never read anywhere — `handleSubmit` calls `adminLogin(email, password)` (`page.tsx:60`) without it, and `persistAuth` in `admin-api.ts:49-59` unconditionally writes to `localStorage` regardless. Unchecking the box gives the user a false expectation that their session won't persist past the browser session, when it always does. Left unfixed: implementing real session-vs-persistent storage would mean threading a `remember` flag through `adminLogin` → `persistAuth`/`loadStoredAuth`/`scheduleTokenRefresh` in the shared `admin-api.ts`, which every authenticated page in the app depends on — a bigger change with real behavioral trade-offs (does unscoping "remember" mean logging the admin out on tab close? does the refresh timer still run?) that needs a product decision, not a mechanical fix.

3. "Forgot Password?" and "Contact Support" links are both `href="#"` placeholders (`page.tsx:102-104, 141-143`) despite the backend already implementing `POST /auth/forgot-password` (`auth.controller.ts:59-63`, OTP-throttled). Left unfixed: wiring a real forgot-password flow is a product-scoped feature addition (new page/modal, email-vs-OTP UX decision), not a bug fix in this pass.

## Unused/dead fields
Not applicable in the usual sense (this page doesn't fetch a data payload to
diff against) — the "unused control" equivalent is the `remember` checkbox
above, captured in Findings since it's user-facing and behaviorally
misleading rather than a wasted backend field.

## Loading/error/realtime behavior
No `useAdminQuery`/data fetch on this page — the only async operation is the
login submission itself, which sets `loading` synchronously on submit,
disables the submit button, and on failure sets `error` (rendered via the
same `alert-error` pattern used elsewhere in the app) while leaving the
entered credentials in place so the user can correct and retry. No polling or
realtime subscriptions apply to a login form.
