# Lunara — Project Profile

For the full platform description (what it does, who it's for, architecture), see [PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md). This document distills the goal, objectives, and vision behind it.

## Vision

To become the trusted operating system for on-demand laundry — the layer that lets any laundry shop, in any territory, run a modern, trackable, accountable delivery business without building software of their own.

Where laundry-as-a-service today means phone calls, paper tickets, and "it'll be ready sometime this week," Lunara's long-term bet is that the category grows up the way food delivery did: real-time visibility, predictable timelines, and digital trust — but adapted to a multi-day, physical-handoff workflow that food delivery never had to solve.

## Goal

Build one coordinated system — not four disconnected apps — where a single order is visible and actionable in real time to everyone who touches it: the customer who placed it, the partner shop doing the work, the rider moving it, and the admin overseeing the network. The goal is trust at every handoff, not just speed at any one step.

## Objectives

1. **Make partners the growth engine.** Lower the barrier for an independent laundry shop to go digital — order queue, pricing, payments, reconciliation — without needing their own dev team. White-label support lets partners look like their own brand while running on Lunara's infrastructure.
2. **Solve the physical handoff problem.** Proof-of-pickup, proof-of-delivery, and stage-by-stage tracking exist because a lost or delayed order is a trust failure, not an inconvenience — every design decision around order state is built to minimize and quickly resolve those moments.
3. **Scale territory by territory, not feature by feature.** Territorial partner architecture lets Lunara expand market-by-market — onboarding one or more partners per territory — while keeping demand routing, pricing, and commission rules consistent across the network.
4. **Keep every experience consistent as the platform grows.** A shared type/validation/UI layer (`@lunara/*` packages) means customer, partner, rider, and admin experiences — web and mobile — evolve together instead of drifting apart per platform.
5. **Turn operations data into a real business, not just a job-tracker.** Billing, commission, and revenue reconciliation tooling exist so the marketplace model (partners keep service revenue, pay commission) is auditable and sustainable, not just functional.

## Current state (as of 2026-09)

Admin, customer-web, partner-web, and mobile redesigns have shipped; a multi-phase billing system (subscriptions, invoicing, webhook-driven reconciliation) is live through Phase 6, with webhook idempotency/reconciliation next. Partner-brand onboarding tooling is active, and an internal Claude-powered "AI Team" app supports operational/support work behind the scenes.

## Where this is headed

- Deepen the reconciliation/billing layer so revenue and commission tracking need less manual admin intervention.
- Grow the white-label partner-brand program as the primary customer-acquisition channel — each new partner brand is a new storefront on the same infrastructure.
- Continue closing gaps between mobile and web feature parity so no experience is a second-class citizen.
