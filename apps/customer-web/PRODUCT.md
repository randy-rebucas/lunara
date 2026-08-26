# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 / React 19, TypeScript (existing codebase).

## Users

Busy urbanites who need laundry picked up, cleaned, and delivered back without going to a laundromat themselves — time-poor city dwellers who value convenience and door-to-door service.

## Product Purpose

Lunara is an on-demand laundry pickup-and-delivery marketplace app. A customer books a pickup, a rider collects the laundry, a local partner laundry shop washes/dries/folds it, and a rider delivers it back — tracked end-to-end. Success is a booked, trusted, repeat-use order.

## Positioning

Lunara is a marketplace, not a single laundromat: a network of local partner laundry shops fulfills orders, and dedicated riders handle pickup/delivery, with live order tracking similar to a delivery app. A competitor with a single storefront or no rider network cannot truthfully claim the same model.

## Operating Context

- Customer-facing marketing site lives in `apps/customer-web`, `(marketing)` route group: home, how-it-works, locations/service-areas, partners, riders, FAQ, blog, about, apply flows, auth (login/register/signup/verify-email).
- Authenticated app experience (booking, orders, tracking, payments, chat, profile) lives in the `(authenticated)` route group of the same app.
- Backend: NestJS API with MongoDB, JWT auth, Twilio OTP, email verification, reCAPTCHA v3 anti-spam, Cloudinary uploads, PayMongo payments, Firebase push.
- Service is geographically scoped by "service areas" / branches — partner coverage varies by location.
- White-label: partner brands can run their own domain off the same codebase and must not be pulled into `lunara.app` canonical/SEO identity.

## Capabilities and Constraints

- Real-time order tracking (rider location, order timeline, socket-based notifications).
- Referral/promotions system with spam-abuse protections (recently hardened).
- Partner and rider recruitment flows exist as their own marketing pages (`/partners`, `/riders`, `/*/apply`).
- SEO is actively maintained (`SEO.md`): SSR homepage, JSON-LD, sitemap, OG image — new marketing work must not regress crawlability or reintroduce client-only rendering for primary content.
- No external stock imagery currently used on the homepage (perf constraint noted in SEO.md); any imagery choice for a redesign is a deliberate decision, not an oversight.

## Brand Commitments

Product name is "Lunara." No other name, logo lock, or visual element is binding — the user has explicitly opened the marketing homepage to a new visual world beyond the current royal-blue (#2563eb) direction.

## Evidence on Hand

Existing marketing pages and copy in `apps/customer-web/src/app/(marketing)/` and `src/components/marketing/` are real, shipped content (not placeholder) — home-page.tsx, faq-data.ts, blog-data.ts, etc. No customer testimonials, press mentions, or case studies are on hand; do not fabricate them.

## Product Principles

1. Convenience and trust over comprehensiveness — the marketing site's job is to convert a time-poor visitor fast, not explain every feature.
2. The marketplace/network mechanism (partner shops + riders + live tracking) is the honest differentiator and should be made visible, not asserted abstractly.
3. Preserve SEO/perf discipline already established (SSR, structured data, lean media) through any visual redesign.
4. Service-area/coverage reality (not every city is served) must not be misrepresented by the marketing narrative.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established beyond standard web a11y practice.
