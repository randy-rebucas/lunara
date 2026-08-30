# Audit: Customer-Web — Rewards, Wallet & Subscriptions (combined pass)

Date: 2026-08-30

This is a combined, cross-cutting pass over three previously-audited modules —
[rewards.md](rewards.md) (2026-07-23), [wallet.md](wallet.md) (2026-07-23, 2 fixes since),
and [subscriptions.md](subscriptions.md) (2026-08-23, 2 fixes) — plus the shared
`components/deals/` carousel, which had not been audited before. The three pages'
own card-by-card/mutation/auth tables are not re-transcribed here in full (see those
docs); this pass re-reads every page and backend handler in the module fresh, adds
the `deals/` trace, and specifically re-applies the "mutation response leaks
internal-only fields" bug class (found twice already in `refunds.md`/`refunds-reviews.md`)
against every create/update/redeem endpoint in this module.

## Entry point
- Pages: `apps/customer-web/src/app/(authenticated)/rewards/page.tsx`,
  `apps/customer-web/src/app/(authenticated)/wallet/page.tsx`,
  `apps/customer-web/src/app/(authenticated)/subscriptions/page.tsx` (all `'use client'`)
- Shared component newly traced this pass: `apps/customer-web/src/components/deals/deals-carousel.tsx`
  (`DealsCarousel`, `'use client'`), rendered from `apps/customer-web/src/app/(authenticated)/dashboard/dashboard-client.tsx`
  and re-exported as `DashboardDeals` from `apps/customer-web/src/components/share/share-sections.tsx:9`
  (`@deprecated` alias, same component, no separate logic) — not rendered by rewards/wallet/subscriptions
  pages themselves, but grouped into this audit per the task's module definition since it's the
  customer-facing promo/deals surface adjacent to rewards.
- `apps/customer-web/src/components/payment/wallet-topup-form.tsx` (`WalletTopupForm`), rendered
  inside `wallet/page.tsx`.

## Sub-pages
None of the three pages navigate into a dynamic detail route — each manages its list/cards inline
(redeem on `/rewards`, top-up on `/wallet`, pause/resume/cancel on `/subscriptions`), confirmed by
grepping all four files for `<Link href=`, `router.push`, `<a href=`: the only outbound links found
are `ButtonLink href="/book?code=..."` (deals-carousel.tsx:70, into the booking wizard, out of this
module's scope) and a plain `Link href="/book"` on the wallet page (page.tsx:179), neither a detail
route of this module.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Rewards balance/tier/history | GET | `/rewards/me` | `Omit<RewardsData, 'catalog'>` | `RewardsController.getBalance` -> `RewardsService.getBalanceAndHistory` |
| Rewards catalog | GET | `/rewards/catalog` | `RewardsCatalogItem[]` | `RewardsController.getCatalog` -> `RewardsService.getCatalog` |
| Redeem reward | POST | `/rewards/redeem` | `{ voucher: { code }, balance }` | `RewardsController.redeem` -> `RewardsService.redeem` |
| Referral code | GET | `/rewards/me/referral-code` | `{ referralCode }` | `RewardsController.getReferralCode` -> `RewardsService.getOrCreateReferralCode` |
| Referral stats | GET | `/rewards/me/referral-stats` | `{ referredCount, pointsEarned }` | `RewardsController.getReferralStats` -> `RewardsService.getReferralStats` |
| Wallet balance | GET | `/wallets/me` | `{ balance: number }` | `WalletsController.getWallet` -> `WalletsService.getWallet` |
| Wallet transactions | GET | `/wallets/me/transactions` | `WalletTransaction[]` | `WalletsController.getTransactions` -> `WalletsService.getTransactions` |
| Wallet top-up (production) | POST | `/payments/wallet-topup/intent` | `{ checkoutUrl?, payment?: { checkoutUrl? } }` | `PaymentsController.createWalletTopupIntent` -> `PaymentsService.createWalletTopupIntent` |
| Wallet top-up sync (post-redirect) | POST | `/payments/:id/sync` | `{ status }` | `PaymentsController.syncPayment` -> `PaymentsService.syncPayment` |
| Wallet top-up (dev-only, no frontend caller) | POST | `/wallets/topup` | n/a | `WalletsController.topUp` -> `WalletsService.topUp` |
| Subscriptions list | GET | `/subscriptions` | `SubscriptionRow[]` | `SubscriptionsController.findAll` -> `SubscriptionsService.findAll` |
| Toggle pause/resume | PATCH | `/subscriptions/:id` | `{ active }` body, response unused | `SubscriptionsController.update` -> `SubscriptionsService.update` |
| Cancel subscription | DELETE | `/subscriptions/:id` | response unused | `SubscriptionsController.remove` -> `SubscriptionsService.remove` |
| Deals list | GET | `/deals` | `Deal[]` | `DealsController.listActive` -> `PromotionsService.listDealsForCustomer` |

`PaymentsController`/`PaymentsService` (wallet top-up intent + sync) were already fully traced in
`wallet.md`/`checkout.md` and are not re-traced here beyond the mutation-response check below.

## Backend trace
All four modules' controllers are thin pass-throughs straight to their service methods — no
separate interceptor/serializer layer sits between the service return value and the HTTP response
in any of `RewardsController`, `WalletsController`, `SubscriptionsController`, or `DealsController`.

- `RewardsService.redeem` (`rewards.service.ts:152-193`) atomically deducts points via a single
  `findOneAndUpdate({ userId, loyaltyPoints: { $gte: item.points } }, { $inc: ... })`, closing the
  double-redeem race, then creates a `CustomerPromo` voucher (retrying up to 8 times on a
  duplicate-code collision) and returns `{ voucher, balance: customer.loyaltyPoints }`.
- `WalletsService.topUp` (dev-only path, blocked in production/when PayMongo is configured) and
  `.debit`/`.credit` all use atomic `$inc` updates with a reference-idempotent transaction record,
  guarding against double-processing from a retried webhook/sync call.
- `SubscriptionsService.create`/`.update`/`.remove` all scope by `{ userId }` taken from
  `req.user.sub`; `create` reuses `BookingService.prepareOrderPayload` for the same
  pricing/availability validation a one-off booking gets.
- `DealsController.listActive` has no mutation — `GET` only, scoped to `req.user.sub` inside
  `PromotionsService.listDealsForCustomer`.

## Mutation response sensitive-field re-check
Per the task's known bug class (a create/update/redeem endpoint returning the raw internal
document instead of the customer-safe shape a sibling GET endpoint uses — found in
`refunds.service.ts`/`support.service.ts`, both since fixed), every mutation in this module was
checked line-by-line against its underlying Mongoose schema:

- **`POST /rewards/redeem`** returns `{ voucher, balance }` where `voucher` is the raw
  `CustomerPromo` document (`rewards.service.ts:187`). Checked `CustomerPromo`'s schema
  (`apps/api/src/modules/promotions/schemas/customer-promo.schema.ts:7-43`): every field
  (`userId`, `code`, `title`, `description`, `discountType`, `discountValue`, `minOrderAmount`,
  `expiresAt`, `redeemedAt`, `orderId`, `sourcePromotionId`, timestamps) is either the customer's
  own id or ordinary voucher-display data — there is no `adminNote`/staff-id/internal-review field
  on this schema at all, unlike `Refund`/`SupportTicket`. **No leak** — the bug class doesn't
  reproduce here because the underlying document has nothing admin-only to leak.
- **`PATCH /subscriptions/:id`** and **`DELETE /subscriptions/:id`** return `{ success, data: subscription }`
  / `{ success, data: { deleted: true } }` (`subscriptions.service.ts:58`, `:67`). Checked the
  `Subscription` schema (`apps/api/src/modules/subscriptions/schemas/subscription.schema.ts:8-63`):
  all fields (`branchId`, `bagSizeId`, `enteredWeightKg/LoadCount/PieceCount`, `addonIds`,
  `couponCode`, `pickupAddressId`, `deliveryAddressId`, `frequencyDays`, `nextRunAt`, `active`,
  `lastRunAt`, `lastOrderId`, `lastError`) are the customer's own booking-configuration data, not
  admin/staff-only. **No leak.** (`findAll`'s dead-field exposure of the same fields was already
  flagged, non-sensitive, in `subscriptions.md`'s Unused/dead fields section — not repeated here.)
- **`POST /wallets/topup`** (dev-only) and the production top-up path (`POST
  /payments/wallet-topup/intent`, `POST /payments/:id/sync`) all return either a raw `Wallet`
  document (`balance`, `userId`, `currency`, timestamps — no admin fields on `Wallet`'s schema) or
  a `Payment`/checkout-url shape already traced and found clean in `wallet.md`/`checkout.md`.
  **No leak.**

Conclusion: this module does not exhibit the mutation-serializer bug class found in
`refunds`/`support`. The underlying reason is structural — `CustomerPromo`, `Subscription`, and
`Wallet` simply don't have an admin-only field on their schemas the way `Refund.adminNote` and
`SupportTicket.adminNote/riderId/photosReviewedAt` do, so there's no separate "customer-safe
serializer" to have forgotten to apply on the mutation path in the first place.

## Cards / panels
Full per-card field tables for the three pages are already documented in `rewards.md`, `wallet.md`,
and `subscriptions.md` and were re-verified unchanged against the current page source this pass
(`rewards/page.tsx`, `wallet/page.tsx`, `subscriptions/page.tsx` all match those docs' descriptions
exactly, including the fixes already landed). New this pass:

| Card | Fields consumed | Notes |
|---|---|---|
| Deals carousel card (`DealCarouselCard`, `deals-carousel.tsx:30-83`) | `deal.isPersonal`, `deal.title`, `deal.description`, `deal.code`, `deal._id` (list key), `deal.expiresAt`/`deal.endsAt` (via `formatDealExpiry`), derived `formatDealDiscount(deal)`/`formatDealMinimum(deal)` | `DEAL_GRADIENTS` is a static 3-entry client-side color cycle (`index % 3`), harmless since it's purely cosmetic and doesn't need to stay in sync with any backend key/enum |
| Deals carousel pagination dots/arrows | `activeIndex` (local state), `slideCount` | scroll-position-derived, no backend field |

## Mutations
One row per action, including the dev-only endpoint with no frontend caller (listed for completeness):

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Redeem reward | no (spends points, not literally destructive) | n/a — backend atomic guard makes an accidental double-redeem impossible; see `rewards.md` | yes — blocks all catalog items while one redemption is in flight (`rewards/page.tsx:227`) | yes |
| Wallet top-up (PayMongo intent) | no (redirects off-site) | n/a | yes — `disabled={loading}` in `WalletTopupForm` | yes |
| Toggle pause/resume | no | n/a | yes — `actioningId` guard | yes |
| Cancel subscription | yes — permanent delete, no undo | yes — `window.confirm` (`subscriptions/page.tsx:58-64`, fixed in `subscriptions.md` Finding #1) | yes — same `actioningId` guard | yes |
| `POST /wallets/topup` (dev-only) | no | n/a | n/a — no frontend caller; blocked outright in production (`wallets.service.ts:43-47`) | n/a |

All four customer-reachable mutations were already brought to a clean state by the prior
`rewards.md`/`wallet.md`/`subscriptions.md` fix passes; nothing new to fix here.

## Authorization
- `RewardsController` has `JwtAuthGuard` only (no `RolesGuard`/`@Roles`), but every service method
  requires an existing `Customer` document for `userId`, which non-customer roles don't have —
  same accepted pattern as `login.md`'s note on `customers.controller.ts`, not re-flagged.
- `WalletsController` has `JwtAuthGuard` only; every method is scoped to `req.user.sub` inside the
  service (`findOrCreate`/`debit`/`credit` all key off the authenticated user's wallet) — no route
  or query param can widen it to another user's wallet.
- `SubscriptionsController` is `@Roles(UserRole.CUSTOMER)`-gated, and `update`/`remove` filter by
  `{ _id: id, userId }` — an `_id` for another customer's subscription returns `NotFoundException`,
  not another customer's data (`subscriptions.service.ts:50-54`, `:62-65`).
- `DealsController` is `@Roles(UserRole.CUSTOMER)`-gated, scoped to `req.user.sub` inside
  `listDealsForCustomer`.

No `[authz]` issues found — re-confirms what `rewards.md`/`wallet.md`/`subscriptions.md` already
concluded, extended to the newly-traced `deals` endpoint.

## Findings

1. **No customer-safe serializer anywhere in rewards/wallets/subscriptions — GET and mutation
   responses alike return the raw Mongoose document, including internal fields like `__v` and
   `userId` (the caller's own id, so not cross-customer, but still unnecessary internal-shape
   exposure).** Unlike `payments.service.ts`, which has a `serializePayment()` applied consistently
   to every read *and* mutation endpoint (`payments.service.ts:797-813`), `RewardsService`,
   `WalletsService`, and `SubscriptionsService` never adopted an equivalent pattern —
   `getBalanceAndHistory`/`redeem` (`rewards.service.ts:141-145`, `:187`), `getWallet`/`getTransactions`
   (`wallets.service.ts:26`, `:35`), and `findAll`/`update` (`subscriptions.service.ts:19`, `:58`)
   all return `.find()`/`.create()`/`.save()` results untouched. This is a materially different
   shape of gap than the `refunds`/`support` bug class the task asked to re-check: there, a *GET*
   endpoint was already filtered by a customer-safe serializer and only the *mutation* endpoint
   forgot to apply it (an inconsistency between siblings). Here, GET and mutation are consistent
   with each other — neither is filtered — so a mutation isn't leaking anything a sibling GET
   already withholds; the module simply never built the customer-safe layer in the first place. No
   `adminNote`-equivalent field exists on `CustomerPromo`, `Wallet`, or `Subscription` schemas (see
   Mutation response sensitive-field re-check above), so the practical exposure is limited to
   Mongo-internal bookkeeping (`__v`) and the customer's own `userId`/foreign-key ObjectIds
   (`lastOrderId`, `sourcePromotionId`, `walletId`, `pickupAddressId`, etc.) — not PII, not another
   customer's data, not staff/admin-only content.
   **Fix: left unresolved — product/scope decision.** A proper fix (adding a `serializeReward*`/
   `serializeWallet*`/`serializeSubscription*` layer mirroring `payments.service.ts`) touches 6+
   service methods across 3 modules, and per the research pass, `apps/api/src/modules/ai-agents/tools/{rewards,wallets,subscriptions}.tools.ts`
   call these same service methods directly (not through the HTTP controller), so a fix at the
   service-method-return level would also change what those internal AI-agent tools receive —
   that needs an explicit call on whether the AI tools want the same trimmed shape or the raw one,
   which is outside a customer-web-focused audit's authority to decide. Flagged here as a genuine
   but low-severity finding (no PII/admin-only/cross-customer exposure) for a deliberate follow-up
   pass, rather than fixed blind.

No other issues found. This pass's other purpose was verification (re-applying the known
mutation-serializer *sensitive-field* bug class — the `refunds`/`support` shape specifically —
across every create/update/redeem endpoint in the module, and tracing the previously-unaudited
`deals/` component) rather than first discovery — the three underlying pages were already brought
to a clean, fixed state by `rewards.md` (2026-07-23, 0 issues), `wallet.md` (2026-07-23, 2 fixed),
and `subscriptions.md` (2026-08-23, 2 fixed, 1 left open as a deliberate low-priority UX note). See
those docs for the original findings and fixes; none of the fixes there have regressed (all
re-verified against current source this pass).

## Unused/dead fields
Re-confirms `subscriptions.md`'s existing note: `SubscriptionsService.findAll` returns full
Mongoose documents including `branchId`, `bagSizeId`, `enteredWeightKg/LoadCount/PieceCount`,
`addonIds`, `couponCode`, `pickupAddressId`, `deliveryAddressId`, `lastRunAt`, `lastOrderId`,
`createdAt`, `updatedAt` — none rendered by `SubscriptionRow`. Not sensitive (all the customer's
own order-configuration data), left as-is per `subscriptions.md`'s existing product-decision note.
No new dead/unused fields found in `rewards`/`wallet`/`deals`.

## Loading/error/realtime behavior
All three pages plus `DealsCarousel` use the shared `useCustomerQuery` hook
(`apps/customer-web/src/lib/use-customer-query.ts`) — confirmed its current implementation still
preserves previously-loaded `data` on a failed `reload()` (the `dashboard.md` Finding #1 fix),
consistent across all four consumers checked this pass (rewards, wallet, subscriptions, and now
deals-carousel). `DealsCarousel` additionally treats "not authenticated" as an empty result
(`load` returns `[] as Deal[]` when `!isAuthenticated`, `deals-carousel.tsx:91`) and renders nothing
(`return null`) on error or an empty list rather than showing an error banner — a reasonable choice
for a secondary dashboard widget, not flagged as a gap since a failed/empty deals fetch shouldn't
block or clutter the primary dashboard content. No polling or socket-based realtime updates on any
of the four surfaces — wallet balance, subscription status, and rewards balance/history all require
a manual refresh or page reload to reflect server-side changes (e.g. a subscription's scheduler-set
`lastError`/`lastRunAt`, or a wallet credit from an admin action), matching the already-documented
behavior in `wallet.md`/`rewards.md`/`subscriptions.md`.
