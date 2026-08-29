# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

<!-- Native RN/Expo app shipping separate iOS and Android builds; both native references load. Design language itself is intentionally consistent across OS, not diverging per-OS — see Capabilities and Constraints. -->

## Users
Consumers who use laundry/dry-cleaning pickup-and-delivery service. Their job: schedule a pickup, track garments through the wash cycle, pay, and get delivery back — plus manage recurring subscriptions, redeem rewards, request refunds/support, and scan tags to identify items.

## Product Purpose
Lunara's customer-mobile app is the end-to-end booking and account app for a laundry/delivery service: book pickups, track orders, checkout, manage subscriptions, earn/redeem rewards, handle refunds, and get support — all from a phone.

## Positioning
Lunara is a white-label platform: the same customer-mobile codebase is rebranded per partner (app name, tagline, color theme, and optionally custom fonts pulled from `partner-brands/<slug>/manifest.json`). A given build can ship as "Lunara" or as any partner's own laundry/delivery brand, sharing the same booking/checkout/rewards mechanism underneath.

## Operating Context
- Built with Expo + expo-router (React Native), targeting iOS and Android from one codebase.
- Key flows/routes: onboarding (address, profile), tab home, orders list + order detail, checkout per order, subscriptions, wallet, rewards, refunds, support (with per-ticket detail), review, scan-tag, notifications.
- Uses device capabilities: camera, image picker, location (pickup/delivery address pinning), push notifications.
- Consumes shared monorepo packages: `@lunara/brand`, `@lunara/config` (theme resolution), `@lunara/types`, `@lunara/utils`.

## Capabilities and Constraints
- Per-partner theming is a hard technical constraint: colors, brand name, tagline, and fonts must all resolve through `resolveTheme()` / `partnerTheme`, not be hardcoded, so white-label builds stay correct.
- Default (non-partner) brand color is indigo (`#6366f1` primary; theme also defines primaryLight/primaryDark/secondary/accent tokens).
- `userInterfaceStyle: automatic` — app must support both light and dark OS appearance.
- Design language is intentionally one consistent cross-platform look (not per-OS adaptive) — confirmed with user.
- No tablet support on iOS (`supportsTablet: false`).

## Brand Commitments
Default app name "Lunara" with existing icon/splash assets under `assets/` and `packages/brand/assets/`. Partner builds override name/tagline/color/fonts per `partner-brands/<slug>/manifest.json` — default Lunara identity must not be assumed universal in any screen copy or asset.

## Evidence on Hand
`store-assets/` and `featured.png` exist for app-store listing assets; no user research, testimonials, or usage data confirmed on hand — do not fabricate any.

## Product Principles
1. Every screen must render correctly under both the default Lunara theme and an arbitrary partner theme — no hardcoded brand color/name/font.
2. Consistent cross-platform design language: one Lunara visual system, not per-OS forks.
3. Core loop (book → track → pay → deliver) stays the primary path; subscriptions/rewards/wallet support retention but must not compete with it for attention.
4. Support real device constraints: camera/location/notifications permissions are functional requirements, not optional polish.

## Accessibility & Inclusion
No project-specific accessibility requirement confirmed yet beyond OS-level light/dark support. Standard mobile a11y (contrast, tap targets, screen reader labels) applies by default.
