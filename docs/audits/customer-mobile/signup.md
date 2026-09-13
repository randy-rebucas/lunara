# Audit: Customer-mobile — Signup

Date: 2026-07-23

## Entry point
- Screen: `apps/customer-mobile/app/(auth)/signup.tsx` — Expo Router screen, phone-OTP-only signup with a 6-box digit input
- Component(s): `Screen`, `Card`, `Input`, `Button`, `BrandMark`, `OnboardingProgress`; auth logic in `src/store/auth.ts` (`useAuthStore`)

## Sub-pages
None as a detail route — links to `/(auth)/login` (sibling auth screen). Country-picker `Modal` presented in-place, identical component/pattern to `login.tsx`'s.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Request OTP | POST | `/auth/otp/request` (via `requestOtp()`) | `{ phone: string }` | `AuthController.requestOtp` — same shared endpoint already traced in `docs/audits/customer-mobile/login.md` |
| Verify OTP / signup | POST | `/auth/login` (via `signupWithOtp()`, a plain alias for `loginWithOtp()`, `auth.ts:167`) | `{ user: User; tokens: AuthTokens }` | `AuthController.login` -> `AuthService.login` — same shared endpoint |
| Onboarding status (post-signup redirect) | GET | `/customers/me/onboarding` (via `redirectAfterAuth`) | `OnboardingStatus` | already traced |

## Backend trace
`signupWithOtp` is a direct alias of `loginWithOtp` (`store/auth.ts:167`), so this screen exercises the exact same backend path, role check, and (now-fixed) redirect/refresh behavior already fully traced in `docs/audits/customer-mobile/login.md` — no new backend behavior to re-derive. `AuthService.login`'s OTP branch creates a new `User` (hardcoded `role: CUSTOMER`) plus a placeholder `Customer` profile when the phone number doesn't already match an account, which is what makes this screen a genuine "signup" despite hitting `/auth/login` — the same unification already confirmed for `docs/audits/customer-web/signup.md`.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Phone entry form | `country`, `localPhone`; inline checkmark icon once `isValidLocalNumber` passes | slightly richer than `login.tsx`'s equivalent field (live valid-format checkmark) — a nice touch, not present on the login screen, not flagged as an inconsistency since it's additive polish, not a missing safeguard |
| OTP entry form | 6 individual `TextInput` boxes (`otpDigits[]`) with auto-advance-on-digit and backspace-to-previous-box handling, `resendCooldown` (30s, displayed as `mm:ss` via `formatCooldown` — a different display format than `login.tsx`'s plain `(29s)`, cosmetic only) | auto-advance/backspace logic is standard and correct: advances focus on digit entry (unless already at the last box), moves back and clears the previous box on backspace against an already-empty current box |
| Terms/Privacy notice | static text, **not interactive** | see Finding #1 |
| Footer link | static, -> `/(auth)/login` | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Send/resend OTP | no | n/a | yes (`disabled={submitting \|\| !localPhone.trim()}` / `disabled={submitting \|\| resendCooldown > 0}`) | yes (`error`) |
| Verify OTP / create account | no | n/a | yes (`disabled={submitting \|\| otpValue.length < 6}`) | yes |

## Authorization
Same shared, role-agnostic `/auth/login` endpoint as `docs/audits/customer-mobile/login.md`, with the same role-check guard already in place in `signupWithOtp`/`loginWithOtp`. No `[authz]` issues.

## Findings

1. **[RESOLVED — code and content both since fixed, independently of this audit series] "Terms of Service" and "Privacy Policy" were styled as tappable links but had no `onPress` handler, and no Terms of Service page existed anywhere in the monorepo to link to.** Re-verified on 2026-09-13: `signup.tsx` now wires both `Text` spans to real `onPress={() => openUrl(termsUrl)}`/`openUrl(privacyUrl)` handlers (`Linking.openURL` with a fallback `Alert.alert` on failure), and `apps/customer-web/src/app/(marketing)/terms/page.tsx` now exists with full Terms of Service content mirroring `/privacy`'s structure. Both were fixed elsewhere/earlier than this audit series (not part of today's fix pass) — confirmed by direct inspection rather than assumed from a stale doc.
   **Consequence for `docs/audits/customer-mobile/profile.md` Finding #4:** that screen's "Terms of service" row (`termsUrl` falling back to `${websiteUrl}/terms`) is no longer a dead link either, since `/terms` now resolves — see that doc's updated finding.

No other issues found — this screen shares its entire auth/redirect code path with `login.tsx` and already benefits from both fixes made there (token refresh on 401, `redirectAfterAuth`'s internal `.catch` preventing a false "Invalid or expired OTP" error after an actually-successful signup).

## Unused/dead fields
Not applicable — no list/detail payload to diff against on this screen.

## Loading/error/realtime behavior
`submitting` is set synchronously per action with try/catch/finally, identical pattern to `login.tsx`. No polling or realtime subscription; the resend cooldown is a plain local `setInterval`, correctly cleared on unmount and on "Change phone number".
