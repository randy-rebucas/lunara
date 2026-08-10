# customer-web — Update Report

**Period covered:** 2026-07-29 – 2026-08-09
**Commits:** 91c8744 → c96ef72 (9 commits)

## Summary

Work this period split into two tracks: a security/error-handling hardening pass in late July, followed by a marketing-site visual refresh and a new AI chat escalation feature in early August.

## Changes

### Chat escalation with email + support tickets (9b11ec5, 2026-08-09)
- New `chat-widget.tsx` component (~380 lines) and `lib/ai-chat.ts` (73 lines) wiring an AI chat surface into the app.
- Escalation path sends email notifications and opens a support ticket when the AI can't resolve the conversation.
- Registered in `app/providers.tsx`; added a new dependency in `package.json`.

### Marketing page visual refresh (14b2095 → f34f698, 2026-08-09)
- `home-page.tsx` and `home-page-data.ts` restructured (content + layout changes, ~265 lines touched).
- New `reveal.tsx` and `use-hero-parallax.ts` for scroll-triggered animation on the homepage.
- `locations` marketing page reworked (65 lines).
- `globals.css` had two rounds of changes (~150 lines net) supporting the new marketing styles.
- Phone mockup component (`phone-mockup.tsx`) adjusted for a more accurate device frame.
- Follow-up fix (c96ef72): removed an invalid `size="lg"` prop on two `ButtonLink`s in the homepage partner CTA section.

### Button/layout refactor across authenticated pages (35fd9bb, 2026-08-06)
- Touched dashboard, notifications, orders, orders detail, profile, refunds, and checkout success pages — consistent button styling/layout pass across the authenticated app shell.

### Error handling & security hardening (58baba3, 91c8744, 2026-07-29/30)
- Added `global-error.tsx` with a dedicated error boundary and `lib/report-client-error.ts` for client-side error reporting.
- `next.config.ts` hardened with additional config (headers/CSP-adjacent — see diff for specifics).
- `error.tsx` and `global-error.tsx` wired to report errors via the new helper.

## Open items / things to verify
- No automated tests were added alongside the chat escalation feature — worth a manual pass on the escalation → email → ticket flow before considering it done.
- Two commits are informally titled ("update security", "fineutne secturity" — typo in original commit message) — worth confirming the security changes match what was intended.
