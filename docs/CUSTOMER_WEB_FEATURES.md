# Customer Web — Feature Documentation

**Location:** `apps/customer-web`
**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4
**Shared packages:** `@lunara/ui`, `@lunara/hooks`, `@lunara/utils`, `@lunara/types`, `@lunara/config`, `@lunara/brand`

This document describes the current features supported by the customer-facing web app, for use by engineers, support staff, and product.

---

## 1. Tech Stack Overview

| Concern | Choice |
|---|---|
| Framework | Next.js 15, App Router, React 19 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), global theme in `src/app/globals.css` |
| State/data | Custom hooks + shared `AuthProvider`/API client from `packages/hooks` (no Redux/React Query) |
| Realtime | `socket.io-client` (order tracking, chat) |
| Maps | `leaflet` / `react-leaflet` |
| Icons | `lucide-react` |
| Misc | `react-markdown`, `react-qr-code` (pickup/drop-off codes) |

Routes are split into two route groups:
- **`(marketing)`** — public, unauthenticated pages
- **`(authenticated)`** — gated pages requiring login (via `use-protected-page.ts`)

---

## 2. Site Map / Routes

### Marketing (public)
- `/` (home), `about`, `blog`, `blog/[slug]`, `faq`, `how-it-works`
- `locations`, `service-areas`, `service-areas/[id]`
- `login`, `signup`, `register`, `verify-email`
- `privacy`, `terms`

### Authenticated (logged-in customers)
- `dashboard`
- `book` — booking wizard entry point
- `checkout`, `checkout/[orderId]`, `checkout/[orderId]/success`
- `orders`, `orders/[id]`, `orders/[id]/review`, `orders/[id]/refund`, `orders/[id]/lost-item`
- `refunds`, `refunds/[id]`
- `subscriptions`
- `rewards`
- `wallet`
- `profile`, `settings`, `notifications`
- `support`, `support/[id]`
- `onboarding`, `onboarding/address`, `onboarding/profile`

---

## 3. Supported Features

### Booking
- **Multi-step booking wizard** (address → shop/branch → service → schedule → weight/loads/pieces/garments → add-ons → review → confirm)
  `src/components/booking/booking-wizard.tsx`, flow/state model in `src/lib/booking-flow.ts`
- **Branch/shop selection modal**, with address & GPS-coordinate validation
  `src/components/booking/branch-picker-modal.tsx`
- **Pickup scheduling** — date/time slot picker
  `src/components/booking/pickup-schedule-picker.tsx`
- **Live service quoting** — per-service local preview pricing plus authoritative server-side quote via `useBookingQuote`
  `src/hooks/use-booking-quote.ts`, `src/components/booking/quote-breakdown.tsx`
- **Promo code entry** — applies discounts during quoting
  `src/components/booking/promo-code-field.tsx`

### Checkout & Payments
- Checkout flow with order confirmation and success screen
- Payment components at `src/components/payment/`

### Orders
- Order list and order detail pages
- Order tracking with live map updates (Leaflet + socket.io sync)
  `src/components/customer-tracking-sync.tsx`
- QR codes for pickup/drop-off (`react-qr-code`)
- Order reviews (`orders/[id]/review`)
- Refund requests (`orders/[id]/refund`, `refunds`, `refunds/[id]`, `src/lib/refunds.ts`)
- Lost item reporting (`orders/[id]/lost-item`)

### Account & Onboarding
- Login, signup, registration, email verification
- Guided onboarding for address and profile setup (`onboarding/address`, `onboarding/profile`)
- Profile management (`src/components/profile/`, `src/lib/profile-types.ts`)
- Account settings (`src/lib/customer-settings.ts`)
- Auth handled by shared `AuthProvider` (`packages/hooks/src/auth-provider.tsx`)

### Loyalty & Payments Extras
- Rewards program (`rewards`)
- Wallet / stored balance (`wallet`)
- Subscriptions (`subscriptions`)
- Deals/promotions components (`src/components/deals/`)

### Support
- Support ticket list & detail (`support`, `support/[id]`, `src/lib/support-tickets.ts`)
- AI chat widget mounted globally across the authenticated app
  `src/components/chat/chat-widget.tsx`, `src/lib/ai-chat.ts`

### Notifications
- In-app notification center (`notifications` route)
- `src/hooks/use-notifications.ts`, `src/lib/notification-types.ts`

### Sharing
- Order/referral sharing components (`src/components/share/`)

### Tenant Branding / White-labeling
- Tenant-specific branding pulled from `@lunara/brand` (`packages/brand`)
- Partner-specific brand assets/config in repo-root `partner-brands/`

### Platform / Cross-cutting
- SEO metadata helpers (`src/lib/seo.tsx`), Open Graph image generation (`src/app/opengraph-image.tsx`)
- Client-side error reporting (`src/lib/report-client-error.ts`) with dedicated `error.tsx` / `global-error.tsx`
- reCAPTCHA integration (`src/lib/recaptcha.ts`)
- Generic data-fetching hook (`src/lib/use-customer-query.ts`), debounce/infinite-scroll utility hooks

---

## 4. API Integration

All network calls go through a centralized API client (`packages/hooks/src/api-client.ts`, `api-url.ts`), exposed via `AuthProvider`/`useAuthContext`. Components call typed `api.get<T>(...)` / `api.post<T>(...)`. Realtime features (order tracking, chat) use `socket.io-client` instead of polling.

---

## 5. Design System

Local UI primitives live in `src/components/ui/` (`button-link.tsx`, `card.tsx`, `carousel.tsx`, `document-upload-field.tsx`, `input.tsx`, `page-header.tsx`), supplemented by the shared `@lunara/ui` package used across apps. Styling is Tailwind v4 utility-first, with tenant-brand color overrides layered on top (see [Customer-web landing redesign] and [Admin-web redesign] internal notes for the royal-blue #2563eb baseline design).

---

*Generated from a codebase exploration on 2026-08-30. Update this doc as routes/features change.*
