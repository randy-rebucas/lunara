# Customer-web audit index

One row per module audited with the `audit-module` skill. Findings counts are
`open / fixed`, taken from each doc's Findings section.

| Module | Doc | Last audited | Findings (open / fixed) |
|---|---|---|---|
| FAQ | [faq.md](faq.md) | 2026-07-23 | 0 / 0 |
| Marketing home (+ service-areas detail) | [marketing-home.md](marketing-home.md) | 2026-07-23 | 0 / 0 |
| Locations | [locations.md](locations.md) | 2026-07-23 | 0 / 0 |
| Partners | [partners.md](partners.md) | 2026-07-23 | 0 / 0 |
| Partners apply | [partners-apply.md](partners-apply.md) | 2026-07-23 | 0 / 0 |
| Privacy | [privacy.md](privacy.md) | 2026-07-23 | 0 / 0 |
| Riders | [riders.md](riders.md) | 2026-07-23 | 0 / 0 |
| Riders apply | [riders-apply.md](riders-apply.md) | 2026-07-23 | 0 / 0 |
| Dashboard | [dashboard.md](dashboard.md) | 2026-08-23 | 0 / 1 |
| Wallet | [wallet.md](wallet.md) | 2026-08-23 | 0 / 2 |
| Profile | [profile.md](profile.md) | 2026-07-23 | 0 / 3 |
| Book (booking wizard) | [book.md](book.md) | 2026-07-23 | 0 / 2 |
| Orders (list + detail + sub-pages) | [orders.md](orders.md) | 2026-08-23 | 0 / 1 |
| Notifications | [notifications.md](notifications.md) | 2026-08-23 | 0 / 1 |
| Rewards | [rewards.md](rewards.md) | 2026-08-23 | 0 / 0 |
| Support (list + detail) | [support.md](support.md) | 2026-07-23 | 0 / 0 |
| Refunds (list + detail) | [refunds.md](refunds.md) | 2026-08-23 | 0 / 1 (**[sensitive-data]** admin notes leaked to customers, fixed) |
| Onboarding: Profile | [onboarding-profile.md](onboarding-profile.md) | 2026-07-23 | 0 / 2 |
| Onboarding: Address | [onboarding-address.md](onboarding-address.md) | 2026-07-23 | 0 / 2 |
| Checkout (payment + delete unpaid order) | [checkout.md](checkout.md) | 2026-08-23 | 0 / 3 |
| Subscriptions | [subscriptions.md](subscriptions.md) | 2026-08-23 | 1 / 2 |
| Terms (legal) | [terms.md](terms.md) | 2026-08-23 | 0 / 0 |
| Login | [login.md](login.md) | 2026-08-23 | 0 / 2 (+1 a11y fix) |
| Register | [register.md](register.md) | 2026-08-23 | 0 / 3 (+1 a11y fix) |
| Signup | [signup.md](signup.md) | 2026-08-23 | 0 / 1 (+1 a11y fix) |
| Settings | [settings.md](settings.md) | 2026-08-23 | 0 / 2 |
| Health scan | [HEALTH-SCAN.md](HEALTH-SCAN.md) | 2026-08-23 | repo-wide triage: 1 typecheck error (fixed), 5 lint warnings (open), dep version mismatch (open) |
| Booking & Checkout (wizard + checkout + orders, combined end-to-end pass) | [booking-checkout-orders.md](booking-checkout-orders.md) | 2026-08-30 | 1 / 1 |
| Refunds, Reviews & Lost Items (submission flows) | [refunds-reviews.md](refunds-reviews.md) | 2026-08-30 | 0 / 2 |
| Rewards, Wallet & Subscriptions (combined pass + deals carousel) | [rewards-wallet-subscriptions.md](rewards-wallet-subscriptions.md) | 2026-08-30 | 1 / 0 (raw-doc/no-serializer gap, no PII/admin-only exposure, deliberately left for a scoped follow-up) |
| Support, Chat & Notifications (support tickets, AI chat widget, notifications combined pass) | [support-chat-notifications.md](support-chat-notifications.md) | 2026-08-30 | 0 / 3 (**[sensitive-data]** raw ticket serializer leaks in `createGeneralTicket`/`createAreaCoverageRequest`/`createRiderIssueTicket`, all fixed) |
