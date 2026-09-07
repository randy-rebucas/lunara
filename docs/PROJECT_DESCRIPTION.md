# Lunara — Platform Description

**Tagline:** *Fresh laundry, delivered smart.*

## Overview

Lunara is an end-to-end laundry management platform that connects three groups of people — customers who need laundry done, laundry partners (shops) who do it, and delivery riders who move it — inside one coordinated system. Instead of a single app, Lunara is a family of purpose-built apps (customer, partner, rider, admin) all reading from and writing to the same backend, so a booking placed by a customer is instantly visible to the right partner, dispatchable to a rider, and trackable by an admin — in real time, without manual handoffs.

The platform was built to solve a problem specific to on-demand laundry: unlike food delivery, an order has a multi-day lifecycle (pickup → wash → dry → fold → delivery) with a physical item that changes hands multiple times and can't simply be "redone" if lost. Lunara's core design bet is that visibility and accountability at every handoff — not just fast dispatch — is what makes a laundry marketplace trustworthy at scale.

## Who it's for

- **Customers** who want to schedule a pickup, choose services (wash & fold, dry cleaning, ironing, specialty items), track their order status, and pay online — without calling a shop or negotiating pricing.
- **Laundry partners** (independent shops or franchises) who want a digital storefront, order queue, and operations dashboard instead of managing everything over phone calls and paper tickets. Lunara supports white-labeled partner branding, so a partner can run their own branded mobile app on Lunara's infrastructure.
- **Riders** who pick up and deliver orders, using a dedicated app for route assignments, proof-of-pickup/delivery, and earnings tracking.
- **Platform admins** who oversee the marketplace: managing partners, monitoring order flow across the whole network, handling disputes, and tracking commission/revenue.

## What the platform does

### For customers
Book a pickup, select services and add-ons, get real-time status updates (picked up, in progress, out for delivery, delivered), pay through an integrated payment flow, and communicate with support — all from a mobile app or web experience with the same design language and live order state.

### For partners
Run the shop side of the business: accept or manage incoming orders, track order stages, reconcile cash and digital payments, view pricing/commission breakdowns, and operate under their own branding if they're part of the white-label program. Partner-web gives shops a full desktop-grade operations console (drag-and-drop order boards, PDF invoices, QR-based order lookups) alongside a lighter partner-mobile app for on-the-go use.

### For riders
See assigned pickups and deliveries, navigate to locations, confirm handoffs (with camera-based proof capture), and work offline-tolerantly in areas with poor connectivity — the rider app is built to degrade gracefully rather than block on network calls.

### For admins
A central dashboard for the whole network: partner onboarding and territory management, live order monitoring across every partner, commission and revenue reporting, subscription/billing oversight, and the operational playbooks that keep the marketplace consistent as it scales to new territories and partners.

### AI Agents
Lunara also runs an internal "AI Team" application — a set of Claude-powered agents used for operational and support tasks inside the business (e.g., assisting staff with account questions, generating reports, or automating repetitive admin work), separate from the customer-facing product.

## Architecture at a glance

Lunara is a Turborepo monorepo (npm workspaces) with a shared design system and type layer so every app — web or mobile — stays visually and behaviorally consistent:

- **Backend (`apps/api`):** NestJS 11 on MongoDB (via Mongoose), with JWT-based auth (access + refresh tokens), OTP verification over SMS, real-time updates via Socket.io, and integrations for payments, push notifications, and file storage.
- **Web apps:** Next.js 15 / React 19 — a customer-facing marketing and booking site, an internal admin console, and a partner operations portal, each themed via a shared `@lunara/ui` component library and `@lunara/brand` tokens.
- **Mobile apps:** Expo / React Native (customer, partner, rider), sharing the same backend and design tokens, with white-label support so partner brands can ship their own app identity.
- **Shared packages:** common UI components, types, validation schemas, hooks, and utilities used across every app, so business logic and design don't drift between platforms.

## Business model

Lunara operates as a marketplace: partners keep the majority of the service revenue and pay Lunara a commission per order, with subscription/billing tooling layered on top to support recurring partner fees, invoicing, and revenue reconciliation. Territorial partner architecture lets Lunara expand market-by-market, onboarding one or more partners per territory while keeping demand routing and pricing rules consistent.

## What makes it different

1. **One system, four experiences.** Customers, partners, riders, and admins all see a live, shared view of the same order — not siloed apps synced by batch jobs.
2. **White-label ready.** Partner brands can run Lunara's platform under their own name and visual identity without forking the codebase.
3. **Built for the physical handoff problem.** Proof-of-pickup, proof-of-delivery, and stage-by-stage tracking exist because a lost or delayed laundry order is a trust failure, not just an inconvenience — the product is designed around minimizing and quickly resolving those moments.
4. **Shared design and type system.** A single source of truth for UI components, types, and validation means new features roll out consistently across every app rather than being reimplemented per platform.

## Current state

The platform includes shipped admin, customer-web, partner-web, and mobile app redesigns, a multi-phase billing system (subscriptions, invoicing, webhook-driven reconciliation), and active partner-brand onboarding tooling. Documentation for API endpoints, deployment per app, operational playbooks, and user journeys lives alongside the codebase in `docs/`.
