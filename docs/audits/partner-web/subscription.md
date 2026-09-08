# Audit: Partner-web — Subscription (Plan tab, Settings)

Date: 2026-09-08

## Entry point
- Page: `apps/partner-web/src/app/settings/page.tsx` (Plan tab, `activeTab === 'plan'`, line 1019)
- Component(s): inline in `settings/page.tsx` — `PaymentMethodPanel` (line 104), `PromoCodePanel` (line 252)

## Sub-pages
None — no outbound navigation into a detail route. Everything renders inline in the Plan tab.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load plan info | GET | `/partner/subscription` | `PartnerSubscriptionInfo` | `PartnerController.getSubscription` -> `PartnerOperationsService.getSubscriptionInfo` |
| Load payment method | GET | `/partner/billing/payment-method` | `PartnerPaymentMethodInfo` | `BillingController.getPaymentMethod` -> `SubscriptionService.findByPartnerId` |
| Attach card | POST | `/partner/billing/payment-method` | — | `BillingController.attachPaymentMethod` -> `SubscriptionService.attachPaymentMethod` |
| Remove card | DELETE | `/partner/billing/payment-method` | — | `BillingController.removePaymentMethod` -> `SubscriptionService.removePaymentMethod` |
| Redeem promo | POST | `/partner/billing/promotion` | — | `BillingController.redeemPromotion` -> `BillingPromotionService.redeem` |
| **Change plan** | — | **none exists** | — | — |

There is no frontend call, API route, or service method that lets a partner change their own plan.
The only plan-mutation path in the whole codebase is admin-only: `PATCH /admin/billing/subscriptions/:partnerId` (`BillingAdminController.updateSubscription`, `@Roles(UserRole.ADMIN)`) -> `SubscriptionService.adminUpdate` (`subscription.service.ts:81`).

## Backend trace
`PartnerOperationsService.getSubscriptionInfo` (`partner-operations.service.ts:1845`) loads the partner's `BillingSubscription` doc, joins the `Plan` by `planId`, and maps it onto the legacy `PartnerSubscriptionInfo` shape (`subscriptionPlan: 'trial'|'basic'|'starter'|'professional'`) for backward compatibility with the pre-Plan-model union that used to live directly on `User`. No plan list, no available-plans endpoint is exposed to partners at all — `PlanService.list()` is only reachable via `GET /admin/billing/plans` (admin-only).

`SubscriptionService.adminUpdate` (admin path) reassigns `planId`/`priceSnapshot`, optionally flips `status`/`currentPeriodEnd`/`cancelAtPeriodEnd`, and saves — it does not create a ledger entry itself (billing effects flow through the next invoice cycle), and does not proration-adjust the current period.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Plan detail (`DetailRow`s, lines 1027-1044) | `subscription.subscriptionPlan`, `subscription.planPrice`, `subscription.trialEndsAt`, `subscription.planRenewsAt` | Static label map `SUBSCRIPTION_PLAN_LABELS` (line 84) must stay manually in sync with `Plan.key` values on the backend — a new plan key added via the admin Plans UI renders as blank/undefined here since the union type only has 4 members. |
| Billing note (line 1054) | `subscription.subscriptionPlan`, `subscription.paymentMethodOnFile` | Static copy explains auto-charge vs manual settlement. |
| `PaymentMethodPanel` | `getPaymentMethod()` -> `onFile`, `brand`, `last4` | Card entered directly in-browser, tokenized client-side via PayMongo's publishable key (`partner-api.ts:303-341`) — raw PAN never touches Lunara's server, only the resulting Payment Method id. |
| `PromoCodePanel` | `subscription.promotionCode`, `subscription.promotionFreeMonthsRemaining` | No promo-removal UI for partners (by design — see comment at `billing.controller.ts:43`, removal is admin-only). |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save card (`handleSaveCard`) | no | n/a | yes — `disabled={saving \|\| ...}` | yes — inline `alert-error` |
| Remove card (`handleRemove`) | mildly (loses auto-charge) | no confirmation dialog | yes — `disabled={saving}` | yes — toast |
| Redeem promo (`handleRedeem`) | no | n/a | yes — `disabled={saving \|\| !code.trim()}` | yes — inline error |
| **Change plan** | n/a — **action does not exist** | — | — | — |

## Authorization
`GET /partner/subscription`, `/partner/billing/*` are all `@Roles(UserRole.PARTNER)`-guarded and scoped by `req.user.sub` (no partner/branch id taken as a request param), so one partner cannot read or mutate another's subscription or payment method. `PATCH /admin/billing/subscriptions/:partnerId` is `@Roles(UserRole.ADMIN)` only — correctly excludes `PARTNER`. No `[authz]` issues found; the gap is a missing capability, not a broken guard.

## Findings

1. **[Primary] Partners cannot update/change their own subscription plan — the capability does not exist anywhere in the stack.** The Plan tab is read-only (`settings/page.tsx:1022`: *"Contact support to change plans."*) and there is no partner-facing list-plans or change-plan endpoint; the only mutation path (`PATCH /admin/billing/subscriptions/:partnerId`) is admin-only. Impact: a partner who signed up on the default ₱1,299 Lunara-brand plan and later wants the ₱3,000 branded-app plan (or vice versa) must go through support/an admin manually calling the admin endpoint — there's no self-service path.
   **Fix: left unfixed — needs a product decision.** Building this safely requires answering questions this audit can't answer on its own: which plan transitions are partner-initiated vs. admin-only (e.g. should upgrading to "branded" require re-collecting a logo and the ₱5,000 territory reservation fee shown at signup, and should that stay a one-time admin-verified step?); whether a plan change takes effect immediately or at the next billing cycle; and whether it prorates the current period. I've flagged this back to you rather than guessing at billing/proration rules.

2. **Static plan-label map will silently break for new plans.** `SUBSCRIPTION_PLAN_LABELS` (`settings/page.tsx:84`) is a hardcoded `Record<'trial'|'basic'|'starter'|'professional', string>`, but `PlanService`/`Plan.key` (backend) allows admins to create arbitrary new plan keys via `POST /admin/billing/plans` — the comment on `Plan.key` (`plan.schema.ts:9-11`) explicitly says "new plans are no longer restricted to it." If an admin creates a 5th plan and assigns a partner to it, `getSubscriptionInfo` (`partner-operations.service.ts:1865`) already defends the *backend* union by silently coercing any unknown key to `'trial'` before it reaches the frontend, which itself doesn't crash but means partners assigned to a new plan would incorrectly see themselves as "Trial" with a "Trial ends" date derived from `trialEndsAt` (likely `undefined`, rendering "—"), silently misreporting their actual plan and price.
   **Fix: left unfixed — out of scope for this audit** (this audit's ask was the update-plan flow; fixing this cleanly means designing #1 first, since a real self-serve plan picker would need to render arbitrary plan keys anyway rather than a hardcoded 4-entry label map).

3. **No confirmation on "Remove" (payment method).** `handleRemove` (`settings/page.tsx:157`) fires immediately on click with no `window.confirm`/modal. Impact: an accidental click silently switches the partner from auto-charge back to manual settlement (bank transfer/GCash) with no undo — low-severity since it's reversible by re-adding a card, but the partner may not notice until their next invoice is unexpectedly unpaid.
   **Fix: left unfixed — minor UX polish, not part of the requested subscription-update audit; flagging for a follow-up pass.**

## Unused/dead fields
`cardBrand` and `cardLast4` are returned by `PartnerOperationsService.getSubscriptionInfo` (`partner-operations.service.ts:1875-1876`, part of `PartnerSubscriptionInfo`) but the Plan tab never reads them — the actual card brand/last4 shown in `PaymentMethodPanel` comes from the separate `getPaymentMethod()` call instead. Not sensitive beyond what's already duplicated via the other endpoint (masked last4 + brand only, no PAN), so this is dead payload, not a security finding.

## Loading/error/realtime behavior
`usePartnerQuery` (shared hook, `lib/use-partner-query.ts`) drives both `data`/`subscription` loads: shows a loading string, keeps last-known error separately from data (doesn't wipe `subscription` on a failed reload), and exposes `reload()` — used by `PromoCodePanel`'s `onRedeemed` callback to refresh the plan panel after a successful redemption. No sockets/polling on this tab; it's load-once-per-mount plus manual reload after promo redemption. This is the same hook `settings/page.tsx:427-428` uses for the main settings load, so its behavior is already exercised elsewhere in this file — no cross-module divergence found.
