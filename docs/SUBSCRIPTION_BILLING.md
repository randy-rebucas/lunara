# Subscription Billing

How Lunara bills partners for their platform subscription: plans, the subscription
lifecycle, invoicing, card auto-charge, dunning/suspension, promo codes, and
reconciliation. Source: [`apps/api/src/modules/billing/`](../apps/api/src/modules/billing/).

## Overview

A partner's subscription fee is billed alongside their existing weekly commission
invoice (`PartnerInvoice`, `apps/api/src/modules/partner/schemas/partner-invoice.schema.ts`)
rather than through a separate billing pipeline. The billing module supplies the
*inputs* to that existing invoice — which plan, what price, whether a promo applies,
whether a saved card should be charged automatically — and reacts to the *outputs*
(mark an invoice paid → reactivate a suspended partner; an invoice goes unpaid →
escalate toward suspension).

```
Plan ──┐
       ├─→ BillingSubscription ──→ PartnerOperationsService.createInvoice() ──→ PartnerInvoice
BillingPromotion ─┘                        │                                        │
                                            ├─ auto-charge attempt (PayMongo)        │
                                            └─ ledger post (subscription_fee)   markInvoicePaid()
                                                                                      │
                                                                          reactivates BillingSubscription
```

A partner with no `BillingSubscription` document (not yet migrated, or never
assigned a plan) is treated as `trialing` with no entitlements — never as an error.

## Data model

All schemas live in `apps/api/src/modules/billing/schemas/`.

### `Plan` (collection `plans`)

Admin-managed pricing tier. Editing a plan's `monthlyPrice` only affects *new*
subscriptions/renewals — an in-flight billing cycle uses the `priceSnapshot`
locked in on the `BillingSubscription`, not the live `Plan` price.

| Field | Notes |
|---|---|
| `key` | Unique string, e.g. `trial`/`basic`/`starter`/`professional`. Not an enum — admins can add new plans without a code change. |
| `monthlyPrice`, `trialDays` | |
| `limits`, `features` | Free-form maps read by `EntitlementService` — key names are a convention between admin and code, not schema-enforced. |
| `addOns` | Reserved, always empty today — no add-on billing implemented. |
| `isActive`, `sortOrder` | |

### `BillingSubscription` (collection `partner_subscriptions`)

One document per partner, keyed by `partnerId` = the partner owner's `User._id`
(**not** `Partner._id` — see [Naming and model collisions](#naming-and-model-collisions)
below for why this matters).

| Field | Notes |
|---|---|
| `planId`, `priceSnapshot` | Price locked in at assignment time. |
| `status` | `trialing \| active \| past_due \| grace_period \| suspended \| cancelled \| expired` — see [state machine](#subscription-state-machine). |
| `currentPeriodStart/End` | Advanced by one month each time a cycle is billed (`SubscriptionService.advancePeriod`). |
| `provider`, `providerCustomerId`, `providerSubscriptionId` | `'manual' \| 'paymongo'`. `providerCustomerId`/`providerSubscriptionId` are unused placeholders — no PayMongo customer/subscription object is created today, only a Payment Method + one Payment Intent per charge attempt. |
| `paymentMethodOnFile`, `paymongoPaymentMethodId`, `cardBrand`, `cardLast4` | Saved-card state — see [Auto-charge](#auto-charge-saved-cards-only). |
| `pastDueAt`, `gracePeriodStartedAt`, `suspendedAt`, `lastDunningAttemptAt` | Dunning timestamps — see [Dunning](#dunning-and-suspension). |
| `activePromotionId`, `promotionCode`, `promotionDiscountType`, `promotionDiscountValue`, `promotionFreeMonthsRemaining` | See [Promo codes](#promo-codes). |

### `BillingPromotion` (collection `billing_promotions`)

Discount codes — see [Promo codes](#promo-codes).

### `WebhookEvent` (collection `payment_webhook_events`, lives in `apps/api/src/modules/payments/schemas/`)

Idempotency + audit log for inbound PayMongo webhooks — see [Webhook idempotency](#webhook-idempotency).

## Subscription state machine

```
trialing ──→ active ──→ past_due ──→ grace_period ──→ suspended
                ↑____________________________________________|
                     (payment received, any stage → active)

trialing/active ──→ cancelled   (admin action, not automated)
```

Only `SubscriptionService.transitionStatus()` mutates status outside admin overrides
(`adminUpdate`) — it's a pure state change (no notification/ledger/audit side effects
of its own); callers are responsible for those. The two real callers:

- `AutomationSchedulerService.sweepDunning()` — escalates through the chain.
- `PartnerOperationsService.markInvoicePaid()` — jumps straight back to `active`
  from any of `past_due`/`grace_period`/`suspended`, whether payment came from an
  admin manually marking an invoice paid or a dunning-retry auto-charge succeeding.

`expired` exists in the enum but nothing currently transitions a subscription into
it — reserved for a future explicit end-of-life flow (e.g. after N months
suspended with no payment).

## Billing lifecycle

1. **Weekly cron** (`AutomationSchedulerService.generateScheduledInvoices`, gated by
   the `autoGenerateInvoices` setting) walks every partner branch and calls
   `PartnerOperationsService.createInvoice()`.
2. `createInvoice()` resolves the partner's `BillingSubscription`, computes
   `subscriptionFeeDue` via `computeDueSubscriptionFee()` — 0 if trialing/cancelled/
   expired, 0 if the current period hasn't ended yet, otherwise `priceSnapshot`
   run through `applyPromotionDiscount()`.
3. If the cycle is due (`isCycleDue()` — checked independently of the resulting fee
   amount, so a promo discounting the fee to ₱0 still advances the period), the
   invoice is created bundling this fee with any commission/rider-cost due for
   completed orders, and `SubscriptionService.advancePeriod()` runs (advances the
   period, flips `trialing→active`, counts down a `free_months` promo).
4. If `subscriptionFeeDue > 0`, a `subscription_fee` ledger entry posts
   unconditionally (revenue is recognized when *billed*, not when paid) —
   `partner_receivable` debit / `platform_revenue` credit.
5. **Auto-charge attempt**: only for subscription-fee-only invoices (no bundled
   orders) where the partner has a saved card — see below. On success, the
   invoice is immediately marked paid via `markInvoicePaid()`. On any failure
   (no card, decline, 3DS required, PayMongo error), the invoice stays `pending`
   for manual settlement (bank transfer/GCash), same as before auto-charge existed.

## Auto-charge (saved cards only)

PayMongo can only charge a **saved card** without customer interaction (Payment
Methods + Payment Intents). GCash/Maya are one-time redirect flows and cannot be
auto-charged — partners using them are always on the manual invoice flow.

- Card tokenization happens **client-side**, directly against PayMongo's public
  API from `apps/partner-web` (Settings → Plan tab) — raw card data never touches
  the Lunara backend, only the resulting Payment Method id does
  (`createPaymongoCardPaymentMethod` in `apps/partner-web/src/lib/partner-api.ts`).
- `SubscriptionService.attachPaymentMethod()` validates the Payment Method is a
  card (rejects GCash/Maya types) before saving it.
- `SubscriptionService.attemptAutoCharge()` creates a PayMongo Payment Intent and
  attaches the saved Payment Method — **entirely synchronous**, single
  request/response. A charge requiring 3D Secure returns
  `awaiting_next_action`, which is treated as a failed attempt and **not
  retried via any redirect flow** — there is no interactive/async completion path
  today. This is a known, accepted limitation (see [Known limitations](#known-limitations)).

## Dunning and suspension

Daily cron `AutomationSchedulerService.sweepDunning()` (gated by `autoDunningEnabled`,
`billingGracePeriodDays`/`billingSuspendAfterGraceDays` configurable in
**Admin → System → Automation settings**):

1. Finds `pending` `PartnerInvoice`s with `subscriptionFeeDue > 0` and an overdue `dueDate`.
2. Once per day per partner, retries a saved-card auto-charge if one exists —
   success reactivates immediately via `markInvoicePaid()`.
3. Otherwise escalates on schedule: `active → past_due` (immediately overdue) →
   `grace_period` (after `billingGracePeriodDays`) → `suspended` (after a further
   `billingSuspendAfterGraceDays`). Each transition sends a push/in-app
   notification and writes an audit-log entry.

**Suspended partners** are blocked from two self-service actions via
`EntitlementService.assertNotSuspended()`:

- New orders — `OrdersService.createFromBooking()`, checked against the branch's
  owning partner.
- New staff — `PartnerOperationsService.createStaff()`.

Nothing else is restricted (existing orders, reports, invoices, payment history,
account settings all remain accessible) — and admin-initiated actions (e.g. an
admin creating a branch for a suspended partner) are **not** gated, by design.

## Promo codes

`BillingPromotion` supports three discount types, redeemed by code
(`BillingPromotionService.redeem`) either by a partner themselves
(`POST /partner/billing/promotion`) or an admin on their behalf
(`POST /admin/billing/subscriptions/:partnerId/promotion`):

| Type | Behavior |
|---|---|
| `percentage` | Applied every cycle until an admin removes it. |
| `fixed` | Peso amount off, applied every cycle until removed. |
| `free_months` | Fee is ₱0 for N cycles; `promotionFreeMonthsRemaining` counts down in `advancePeriod()` and the promo auto-clears at 0, reverting to full price with no separate expiry job. |

Redemption is atomically capped by `maxRedemptions` (a `findOneAndUpdate` with a
`$lt` guard — concurrent redemptions can't oversell a limited code) and can be
scoped to specific plans via `applicablePlanIds` (empty = any plan). This is the
mechanism behind founding-partner pricing (e.g. "FOUNDING6" — 6 free months on
the Professional plan) — never hard-coded.

## Webhook idempotency

`PaymentsService.handlePaymongoWebhook` claims each inbound webhook by its PayMongo
event id (`WebhookEvent`, unique index on `{provider, eventId}`) **before** any
processing — a redelivery of the same event hits the unique-index conflict and
no-ops instead of reprocessing, same pattern as `LedgerTransactionMarker`
(`apps/api/src/modules/ledger/schemas/ledger-entry.schema.ts`). Processing outcome
(`processed`/`processingError`) is recorded back onto the claim document.

This only covers the general PayMongo webhook endpoint
(`POST /payments/webhooks/paymongo`, order/wallet-topup payments) — subscription
auto-charge does not use webhooks at all (see [Auto-charge](#auto-charge-saved-cards-only)).

## Reconciliation and metrics

`GET /admin/billing/metrics` — MRR/ARR (from `active` subscriptions'
`priceSnapshot`), status counts, revenue by plan, 30-day churn rate, and a
6-month actually-recognized revenue trend (from ledger `subscription_fee`
postings — distinct from the point-in-time projected MRR).

`GET /admin/billing/reconciliation` — three drift/health checks:

- **Stale subscriptions**: cycles overdue beyond what the cron/dunning sweep
  should allow — a healthy system never accumulates these; a nonzero count means
  a stuck job or a bug.
- **Subscription fee drift**: ledger `subscription_fee` credit total vs. the sum
  of `PartnerInvoice.subscriptionFeeDue` across all invoices — should always be
  ~0 given `createInvoice` posts both unconditionally together; a canary for
  future regressions.
- **Webhook event stats**: processed/failed/unprocessed counts in the last 30 days.

Both are rendered on **Admin → Finance → Billing metrics**
(`apps/admin-web/src/components/datacenter/billing-metrics-board.tsx`).

## API reference

All routes return `{ success: boolean, data }`.

### Admin (`admin/billing`, `JwtAuthGuard` + `RolesGuard`, `UserRole.ADMIN`)

```
GET    /admin/billing/metrics
GET    /admin/billing/reconciliation
GET    /admin/billing/plans?includeInactive=
POST   /admin/billing/plans
PATCH  /admin/billing/plans/:id
GET    /admin/billing/subscriptions
PATCH  /admin/billing/subscriptions/:partnerId              # manual override: plan/status/period/cancelAtPeriodEnd
GET    /admin/billing/promotions
POST   /admin/billing/promotions
PATCH  /admin/billing/promotions/:id                         # activate/deactivate, adminNote
POST   /admin/billing/subscriptions/:partnerId/promotion    # admin redeems on partner's behalf
DELETE /admin/billing/subscriptions/:partnerId/promotion
```

### Partner (`partner/billing`, `UserRole.PARTNER`)

```
GET    /partner/billing/payment-method
POST   /partner/billing/payment-method    { paymongoPaymentMethodId }
DELETE /partner/billing/payment-method
POST   /partner/billing/promotion         { code }           # self-redeem; removal is admin-only
```

### Existing partner-facing subscription read (predates this module, kept for compatibility)

```
GET /partner/subscription   # PartnerOperationsService.getSubscriptionInfo — response shape
                             # (PartnerSubscriptionInfo in packages/types) is sourced from
                             # Plan/BillingSubscription now, but kept field-compatible with
                             # the old User-based shape so the existing partner-web UI didn't
                             # need a parallel endpoint.
```

## UI locations

| Page | Path |
|---|---|
| Plan management | Admin → Partners → Plans (`apps/admin-web/src/app/partners/plans/page.tsx`) |
| Promo codes | Admin → Partners → Promo codes (`apps/admin-web/src/app/partners/promo-codes/page.tsx`) |
| Billing metrics + reconciliation | Admin → Finance → Billing metrics (`apps/admin-web/src/app/billing-metrics/page.tsx`) |
| Dunning schedule config | Admin → System → Automation settings, "Billing" section |
| Partner plan/card/promo | Partner-web → Settings → Plan tab (`apps/partner-web/src/app/settings/page.tsx`) |

## Settings

`PlatformSettings` (`apps/api/src/modules/settings/schemas/platform-settings.schema.ts`),
same singleton document as other automation flags:

| Field | Default | Meaning |
|---|---|---|
| `autoGenerateInvoices` | `false` | Weekly invoice cron on/off. |
| `autoDunningEnabled` | `true` | Daily dunning sweep on/off. |
| `billingGracePeriodDays` | `7` | Days `past_due` before `grace_period`. |
| `billingSuspendAfterGraceDays` | `3` | Additional days in `grace_period` before `suspended`. |

## Environment variables

```
PAYMONGO_SECRET_KEY=                       # server-side, required for real charges (mocked in dev if unset)
PAYMONGO_WEBHOOK_SECRET=                   # HMAC signature verification; bypassed outside production if unset
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=           # partner-web, client-side card tokenization only
```

## Migration

`apps/api/src/scripts/migrate-billing-subscriptions.ts` — one-time, idempotent
backfill from the deprecated `User.subscriptionPlan/planPrice/planRenewsAt/trialEndsAt`
fields (still present on `User`, marked `@deprecated`, never deleted) into
`Plan`/`BillingSubscription`. Safe to re-run (upserts). Does not touch the
`User` fields — that cleanup is a separate, deliberately-deferred step.

```
MONGODB_URI=<uri> npx ts-node src/scripts/migrate-billing-subscriptions.ts
```

Run once already against the real dev database — new partners since then get a
`BillingSubscription` through normal admin plan assignment, not this script.

## Naming and model collisions

**Two different Mongoose schema classes must never share the same class name** —
NestJS/Mongoose registers models by `ClassName.name`, and a collision silently
binds `@InjectModel()` to whichever schema registered first, with no error. This
bit the initial build: `apps/api/src/modules/subscriptions/` already had an
unrelated `Subscription` class (customer recurring pickup orders, collection
`subscriptions`) before this module existed — the billing schema had to be named
`BillingSubscription` (collection `partner_subscriptions`) to avoid silently
querying the wrong collection. The promo schema was deliberately named
`BillingPromotion`, not `Promotion`, for the same reason (`apps/api/src/modules/admin/schemas/promotion.schema.ts`
already owns that name for the customer-order coupon system). **Grep for an
existing class of the same name before adding any new schema.**

## Known limitations

- **3D Secure cards can't complete an auto-charge.** No interactive redirect or
  webhook-driven completion path exists for subscription charges — a card
  requiring 3DS simply fails the attempt and falls back to manual invoicing
  every cycle. Building this needs a return-URL redirect flow in partner-web.
- **GCash/Maya can never be auto-charged** — PayMongo API limitation, not a gap
  to fix. These partners are permanently on the manual flow unless they add a card.
- **Mixed invoices never auto-charge.** If an invoice bundles subscription fee
  with commission/rider cost (i.e. the partner had completed orders this cycle),
  auto-charge is skipped entirely — only pays out via manual settlement. Only a
  subscription-fee-only invoice (no orders that cycle) attempts auto-charge.
- **No usage-based/seat-based/add-on billing.** `Plan.addOns` and
  `EntitlementService.checkLimit()`'s usage tracking exist as scaffolding but
  nothing calls them with real usage numbers yet — no metering pipeline.
- **No multi-currency/multi-country support** — PHP only, hard-coded `₱`
  formatting throughout.
- **`expired` status is unreachable** — no code path transitions a subscription
  into it today.

### Recommendations, in priority order

1. **Wire up (or remove) `expired`.** Cheapest fix, do it regardless of anything
   else below — either transition `suspended` → `expired` after N days with no
   payment (closing the loop, maybe triggering churn accounting), or drop the
   enum value entirely. Leaving a status nothing ever reaches is just confusing
   to future readers. Low effort, no real tradeoff.
2. **Mixed-invoice auto-charge** — worth doing if partners with active orders
   *and* a saved card turn out to be common. Low-to-medium effort (remove the
   `dto.orderIds.length === 0` gate in `createInvoice`, charge the full
   `amountDue` instead of just `subscriptionFeeDue`). Tradeoff: a failed charge
   on a larger mixed amount is a worse moment to silently fall back than a small
   subscription-only failure — make sure the manual-fallback messaging stays clear.
3. **3D Secure completion** — leave alone unless card payments become
   meaningful volume. Fixing it needs a real return-URL redirect flow in
   partner-web plus wiring the *existing* general PayMongo webhook handler to
   also recognize `lunara_purpose: subscription_fee` (deliberately left out in
   Phases 2/7). Real chunk of work for what's probably a small fraction of
   partners given GCash/Maya dominate in the Philippines.
4. **GCash/Maya auto-charge** — not fixable, it's a PayMongo API limitation,
   not a gap. Keep the manual/dunning flow as the primary path — it already is.
5. **Usage-based/add-on billing** — don't build until there's an actual add-on
   to sell (e.g. "extra branch ₱499/mo"). Building metering speculatively is
   the kind of premature abstraction worth avoiding; `Plan.addOns` and
   `EntitlementService.checkLimit()` are already there to receive it when needed.
6. **Multi-currency** — defer indefinitely unless there's a concrete plan to
   operate outside the Philippines. No signal that's imminent.
