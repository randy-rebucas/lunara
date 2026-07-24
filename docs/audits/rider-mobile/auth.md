# Audit: Rider-mobile — Auth (Login + Forgot Password)

Date: 2026-07-24

## Entry point
- Pages: `apps/rider-mobile/app/login.tsx`, `apps/rider-mobile/app/forgot-password.tsx`
- Component(s): inline `FieldRow` (login), shared `Input`/`Screen` UI primitives. Both call into `src/auth.ts` (thin wrappers) → `src/store/auth.ts` (`useAuthStore`, Zustand).

## Sub-pages
`login.tsx` links to `forgot-password.tsx` ("Forgot password?", `login.tsx:232-234`) and, on success, replaces the stack with `/(tabs)` (already audited, [home.md](home.md)). `forgot-password.tsx` replaces to `/login` on a successful reset. Audited together here as one cohesive auth flow rather than as separate docs, per the scope guidance for a thin, tightly-coupled pair of screens.

## Data flow

| Call | Method | Path | Frontend type | Notes |
|---|---|---|---|---|
| Password login | POST | `/auth/login` (via `useAuthStore.login`) | — | |
| Request OTP | POST | `/auth/otp/request` | `{phone, message}` | |
| OTP login | POST | `/auth/otp/login` (via `loginWithOtp`) | — | not directly inspected; wraps the same store action pattern |
| Forgot password | POST | `/auth/forgot-password` | `{message, phone: string \| null}` | |
| Reset password | POST | `/auth/reset-password` | `{message}` | |

These are shared `/auth/*` endpoints, not rider-specific — the same module presumably backs admin-web/partner-web/customer-mobile login too. A full backend trace of the `/auth` module is out of scope for a rider-mobile screen audit; only the rider-facing consumption is covered here. `forgotPassword`'s `phone: string | null` response — returning `null` rather than a phone (`forgot-password.tsx:26-32`, stays on step 'email' with a generic "Request submitted" alert) is a deliberate anti-enumeration design: the UI can't distinguish "email not found" from "found but no linked phone," which is correct security practice, not a bug.

## Cards / panels
Not a data-display screen — see Mutations below for the meaningful behavior (form submission, mode switching).

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Password login | no | n/a | yes — `passwordDisabled` includes `loading` | yes — inline error banner |
| Send OTP | no | n/a | yes — `otpDisabled` includes `loading` | yes — inline error banner |
| OTP login | no | n/a | yes | yes |
| Forgot-password request | no | n/a | yes — `disabled={loading \|\| !email.trim()}` | yes — `Alert.alert` |
| Reset password | no | n/a | yes — requires OTP + 8-char password, disabled while loading | yes — `Alert.alert` |
| "Remember me" checkbox | n/a | n/a | n/a | see Findings #1 |
| "Contact support" (login footer) | n/a | n/a | n/a | see Findings #2 (fixed) |

## Authorization
Not applicable in the rider-scoped sense — these are pre-authentication endpoints by definition. No rider-mobile-specific authorization surface to check.

## Findings

1. **"Remember me" checkbox is fully decorative — toggles state that's never read.** `login.tsx` declares `rememberMe`/`setRememberMe` local state (`login.tsx:59`) and renders a checkbox the rider can tap (`login.tsx:220-231`), but `handlePasswordLogin` calls `riderLogin(email.trim(), password)` (`login.tsx:65`) without passing `rememberMe` anywhere, and `useAuthStore.login` (`store/auth.ts:113-121`) always persists the session to `AsyncStorage` unconditionally — there's no session-only/ephemeral login path in the store at all. A rider who deliberately unchecks "Remember me" (implying "don't keep me signed in on this device") is remembered anyway; the control does nothing. Left unfixed: closing this gap needs a product decision (should unchecking actually skip `AsyncStorage.setItem`, or use a shorter-lived token, or should the control simply be removed since sessions are always persisted?) rather than a one-line code change — flagging for a decision rather than silently deleting a visible UI control or guessing at the intended persistence behavior.

2. **"Contact support" footer had no `onPress` at all — `[fixed]`.** The login screen's support footer (`login.tsx:367-379`, pre-fix) rendered `accessibilityRole="button"` with tap-affordance styling and copy ("Need help? Contact support") but had no `onPress` handler whatsoever — tapping it did nothing, silently. A rider locked out of their account (the exact moment this link matters most) would find a dead button.
   **Fix:** wired it to open the same `mailto:` link the "Email support" card on the Support screen uses (`apps/rider-mobile/app/support.tsx`, already audited in [support.md](support.md)) — `apps/rider-mobile/app/login.tsx` (added `contactSupport()` calling `Linking.openURL(mailto:${appConfig.supportEmail}...)`, wired to the existing `Pressable`). Matches the exact pattern already established and audited on the Support screen, so no new design decision was introduced.

## Unused/dead fields
Not applicable — no API payload consumed for display.

## Loading/error/realtime behavior
Both screens have straightforward `loading`/`error` state scoped to their own submit actions, no shared context dependency, no realtime concerns (pre-auth screens can't subscribe to the rider dispatch socket, which requires a token). Error/status banners are inline and screen-local — appropriate for single-purpose auth forms.
