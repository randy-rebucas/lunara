# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Internal Lunara ops and back-office staff. Two overlapping usage modes on the same app:
- **Live-ops monitoring**: dispatch/ops staff keep the app open through a shift watching active orders, riders, dispatch, live tracking, quality alerts, and error/audit logs.
- **Back-office admin**: periodic, task-based sessions for settings, partners, accounting, promotions, users, branches, service areas, reconciliation, revenue, and support.

## Product Purpose
Admin-web is the internal control surface for Lunara's laundry/logistics marketplace: it lets staff monitor live order and delivery activity in real time and manage the operational and business configuration of the platform (partners, riders, pricing, promotions, accounting, support).

## Operating Context
Route surface includes (non-exhaustive): dashboard/home, orders, dispatch, live-tracking, control-tower, riders (+ withdrawals), partners (+ branding, settlements, applications), accounting, reconciliation, revenue, refunds, promotions, addons, banners, blog, categories, services, branches, service-areas, laundry-tags, users, support, messages, notifications, quality-alerts, error-logs, audit-log, automation-settings, maintenance, settings, profile, setup, login.

## Capabilities and Constraints
- Built on Next.js App Router + React 19, shared `@lunara/ui`, `@lunara/hooks`, `@lunara/config`, `@lunara/types` packages across the monorepo.
- Existing shell: `AdminShell` component wraps all authenticated routes; auth via `AdminAuthProvider`/`AuthGuard`; live SOS/alerts via `AdminSosProvider`; realtime via socket.io-client.
- Maps/live-tracking use `@vis.gl/react-google-maps`.
- High page count (~45+ routes) with heavy tabular/data-dense screens (orders, riders, reconciliation, accounting) alongside live-status screens (dispatch, control-tower, live-tracking).

## Brand Commitments
No existing admin-web brand colors/visual identity are binding for this redesign. `@lunara/brand` currently supplies only the app icon/logo asset (used in browser tab), not a color system — this redesign is free to define a new visual language for admin-web specifically.

## Product Principles
- Real-time situational awareness comes first: live status (active orders, riders en route, alerts, SOS) must be scannable at a glance without navigating away.
- Back-office density is a feature, not a flaw: data-heavy tables and forms should stay information-dense and precise, not padded out for marketing-style whitespace.
- One shell, many modes: the same navigation/shell frame serves both a "live monitoring" mental model and a "find and edit a record" mental model — the redesign should unify these rather than treat them as separate apps.
- Internal tool, not a marketing surface: optimize for staff speed and clarity over persuasion or delight-for-its-own-sake.
