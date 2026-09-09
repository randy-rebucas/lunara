# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Laundry shop owners and their staff. Two situations meet at this app:
- **Prospective partners** (shop owners not yet on Lunara) landing at the bare portal URL, deciding whether to apply.
- **Existing partners/staff** signing in to run day-to-day operations (orders, staff, inventory, revenue, invoices, branches) under their own `/{partnerSlug}` portal.

## Product Purpose
Lunara is a laundry management platform. Partner-web is the operator side: it lets a laundry shop run its business (orders, staff, inventory, revenue/invoices, branches, accounting, promotions) and gives each shop an optional customer-facing mobile app (Lunara-branded by default, or the shop's own branding) that customers use to book pickups.

## Positioning
An all-in-one operations backend plus a ready-made customer booking app, so a laundry shop owner doesn't have to build or staff either one. A partner can keep the default Lunara customer app or use their own branded version without separate development.

## Operating Context
- Signed-out visitors to the bare portal root (`/`) have no tenant context yet; existing partners land there mid-session too and get auto-redirected to their `/{partnerSlug}` portal or to `/login`.
- New shop owners apply through the existing multi-step `/signup` flow (business details, branding choice, agreement/pricing, partner commitments, contact) — pricing/terms/commitments already live there and should not be duplicated or restated on the landing page.
- `/login` already carries partner-facing marketing framing ("Run Your Shop Without the Guesswork") and a feature list (orders, staff & inventory, revenue & invoices) with a dark navy hero panel, bubble-field motion, and a "Become a Lunara partner" link to `/signup`.

## Capabilities and Constraints
- Root page (`/`) currently has no marketing content — it's pure redirect/loading logic (`RootRedirectPage`), shown briefly to already-known users and as a plain text fallback otherwise.
- No real customer counts, partner counts, testimonials, or pricing figures are available; do not fabricate them. Pricing/terms live in `/signup`, not on the landing page.
- Existing components available for reuse: `BubbleField` (dark/light bubble motion), `PhonePreviewMockup` (fully-coded phone screens showing the customer booking app, brandable), `Icon`/`ICONS`, and the `.card`/`.btn-*`/`.badge-*` utility classes in `globals.css`.

## Brand Commitments
- Name: Lunara. Primary color `--color-primary` (#4f46e5 indigo), secondary `--color-secondary` (#06b6d4 cyan), dark hero panel `#04142e` with sky-300 accent text — established on `/login` and `/signup`.
- Voice already set on `/login`: direct, benefit-led, laundry-specific ("Run Your Shop Without the Guesswork").

## Evidence on Hand
No testimonials, press, or usage stats on hand — landing page must sell on capability/positioning only, per user decision.

## Product Principles
1. Two distinct visitors share `/`: a prospective partner deciding to apply, and an existing partner mid-redirect — the page must serve both without one crowding out the other.
2. Reuse the dark-navy/bubble-field/phone-mockup visual language already established on `/login` and `/signup` rather than inventing a new one.
3. Never restate or improvise pricing, terms, or commitments — those live in `/signup` and must stay the single source of truth.
4. Keep the auto-redirect behavior for resolvable sessions intact; the marketing content is what an unresolved/logged-out visitor sees.
