# Development Roadmap

## Phase 1 — Foundation (current)

- [x] TurboRepo monorepo structure
- [x] Shared packages (types, validation, utils, config, ui, hooks)
- [x] NestJS API scaffold (auth, users, orders, health, realtime)
- [x] Next.js web scaffolds (customer, admin, partner)
- [x] Expo mobile scaffolds (customer, rider)
- [x] Docker Compose (MongoDB, Redis)
- [x] CI pipeline
- [x] Architecture documentation

## Phase 2 — Core Features

- [ ] OTP verification with Redis + SMS provider
- [ ] Customer profiles & addresses CRUD
- [ ] Full order lifecycle with partner queue UI
- [ ] Rider assignment & dispatch logic
- [ ] Payment integrations (GCash, Maya, Stripe)
- [ ] Wallet & transactions
- [x] Push notifications (Firebase)

## Phase 3 — Operations

- [ ] Partner portal: staff, inventory, reports
- [ ] Admin dashboard: analytics, promotions, CMS
- [ ] Staff dashboard (web or partner sub-role)
- [ ] Audit logs & system settings
- [ ] Loyalty points & coupons

## Phase 4 — Scale & Polish

- [ ] Event bus (BullMQ) for async workflows
- [ ] Route optimization for riders
- [ ] E2E tests (Playwright, Detox)
- [ ] EAS production builds
- [ ] Monitoring (Sentry, Datadog)
- [ ] Multi-region deployment

## Suggested Sprint Order

1. Auth + profiles (unlock all apps)
2. Booking flow end-to-end
3. Partner order processing
4. Rider pickup/delivery + live tracking
5. Payments & wallet
6. Admin & reporting
