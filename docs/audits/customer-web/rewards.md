# Audit: Customer-web — Rewards

Date: 2026-08-31 (updated; see Findings #1-#3 below, added on top of the 2026-07-23 pass)

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/rewards/page.tsx` (`'use client'`)
- Component(s): `PageShell`, `PageHeader`, `DataPageStatus`, `Card`/`CardBody`, `Button`

## Sub-pages
None.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Balance + tier + history | GET | `/rewards/me` | `Omit<RewardsData, 'catalog'>` | `RewardsController.getBalance` -> `RewardsService.getBalanceAndHistory` |
| Catalog | GET | `/rewards/catalog` | `RewardsCatalogItem[]` | `RewardsController.getCatalog` -> `RewardsService.getCatalog` |
| Redeem | POST | `/rewards/redeem` | `{ voucher: { code }, balance }` | `RewardsController.redeem` -> `RewardsService.redeem` |
| Referral code | GET | `/rewards/me/referral-code` | `{ referralCode }` | `RewardsController.getReferralCode` -> `RewardsService.getOrCreateReferralCode` |
| Referral stats | GET | `/rewards/me/referral-stats` | `{ referredCount, pointsEarned }` | `RewardsController.getReferralStats` -> `RewardsService.getReferralStats` |

`RewardsController.getTransactions` (`GET /rewards/me/transactions`) exists but is never called from this page — see Unused/dead fields.

## Backend trace
`getBalanceAndHistory`/`redeem`/`getOrCreateReferralCode` all require a real `Customer` document to exist for `userId` (`customerModel.findOne({ userId })`), throwing `NotFoundException` otherwise. `RewardsController` itself only has `@UseGuards(JwtAuthGuard)` — no `RolesGuard`/`@Roles(...)` — so in principle any authenticated role could call these routes, but the Customer-document requirement naturally scopes them to real customers regardless (a partner/staff/admin/rider has no `Customer` document and gets a 404), the same pattern already accepted in `docs/audits/customer-web/login.md`'s Authorization section for `customers.controller.ts`. Not re-flagged as a new finding here since it's the identical, already-documented shape of gap.

`redeem` (`rewards.service.ts:131-171`) is well-built: the points deduction uses a single atomic `findOneAndUpdate({ userId, loyaltyPoints: { $gte: item.points } }, { $inc: { loyaltyPoints: -item.points } })` — this closes the race a naive read-then-write (or a purely client-side `canRedeem` check) would leave open, so two near-simultaneous redeem requests (e.g. a double-click that somehow got past the UI's own guard, or two tabs) can't both succeed and drive the balance negative; the second attempt's `$gte` filter simply won't match and returns `null`, which the service turns into a clean `BadRequestException('Not enough points to redeem this reward')`. Voucher/referral code generation both retry on a duplicate-key collision (up to 8 attempts) rather than trusting a single random-generation attempt to be unique.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Loyalty summary card | `balance`, `tier`, `nextTier`, `pointsToNextTier`, `currentTierMin`; `progress` derived client-side as `(balance - currentTierMin) / (nextTierMin - currentTierMin)`, clamped | see Finding #1 — `currentTierMin` was added to fix a wrong progress calc |
| Redeem/error banners | `redeemMessage`/`redeemError` (local state) | |
| Rewards catalog | per-item `title`, `description`, `points`, `discountType`/`discountValue` (via `formatDiscount`); `canRedeem` derived client-side (`balance >= item.points`) | client-side `canRedeem` is only a UX hint — the backend independently and atomically re-checks sufficient balance at redemption time (see Backend trace), so a stale/optimistic client balance can't lead to an over-redeem |
| Points history | per-transaction `type`, `amount`, `description`, `createdAt` | same list-key pattern (`${createdAt}-${i}`) as `/wallet`'s transaction list, consistent |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Redeem reward | no (spends points for a voucher, not reversible via this UI, but not literally destructive) | n/a — a confirmation dialog would be reasonable given it spends a limited resource, but the disabled/"X to go" button state combined with a clear success message showing the voucher code makes an accidental redeem unlikely; not flagged as a gap given the backend's atomic guard against any double-charge | yes — `disabled={!canRedeem || redeemingId !== null}` blocks redeeming *any* catalog item while one is already in flight, not just the same item (stronger than a per-item-only guard) | yes (`redeemError`) |

## Authorization
See Backend trace — no `RolesGuard` on `RewardsController`, but every method requires an actual `Customer` document, which non-customer roles don't have. No `[authz]` issue distinct from the already-documented, accepted pattern in `docs/audits/customer-web/login.md`.

## Findings

1. **Tier progress bar was mathematically wrong.** `page.tsx:128` (pre-fix) computed `progress = balance / (balance + pointsToNextTier)`, which — since `pointsToNextTier = nextTier.min - balance` — simplifies to `balance / nextTier.min`, i.e. progress from **zero points**, not progress within the current tier band. A customer who just crossed into "Star" (min 500) heading to "Comet" (min 1500) saw the bar at 33% instead of ~0%, and the bar would never visually reset at a tier-up. This is a shared-code bug: the identical formula (`points / (pointsToNextTier + points)`) was independently duplicated in `apps/customer-mobile/app/rewards.tsx:107-110`, so both customer-facing surfaces showed the wrong progress.
   **Fix:** `RewardsService.getTierProgress` (`apps/api/src/modules/rewards/rewards.service.ts:30-41`) now also returns `currentTierMin`. Both frontends were updated to compute `(balance - currentTierMin) / (nextTierMin - currentTierMin)`: `apps/customer-web/src/app/(authenticated)/rewards/page.tsx:122-130` and `apps/customer-mobile/app/rewards.tsx:106-112`. Typechecked clean on `apps/api`, `apps/customer-web`, and `apps/customer-mobile`.

2. Referral-stats fetch failure is silently swallowed the same way as the referral-code fetch already noted below (`page.tsx:75-80`, `.catch(() => {})`) — if `/rewards/me/referral-stats` fails, the "friends joined" / "pts from referrals" mini-cards just don't render (the `referralStats` gate at `page.tsx:178` requires non-null), with no error shown. Left unfixed: same deliberate degrade-quietly pattern as the referral-code call right above it in the same effect, not worth flagging as a standalone gap distinct from the existing UI/UX note.

3. `GET /rewards/me/transactions` (`rewards.controller.ts:21-25`) is dead code from the frontend's perspective — no caller in `customer-web` or `customer-mobile`; the rewards page gets its transaction list from `/rewards/me` instead, which already includes `transactions` in its payload. Left unfixed — removing a controller route is a contract change best done deliberately (something else, e.g. a mobile version or an internal tool, could still call it) rather than as a side effect of this audit.

This module remains a strong example otherwise: the redemption race condition is closed with a single atomic Mongo update rather than a read-check-write pattern, and the double-submit guard on redeem is stricter than most other pages' (blocks all catalog items, not just the clicked one, while a redemption is in flight).

## Unused/dead fields
`PointsTransaction` documents returned inside `/rewards/me`'s `transactions` array carry `reference`, `sourceType`, `_id`, and `updatedAt` (`apps/api/src/modules/rewards/schemas/points-transaction.schema.ts`) that the frontend `RewardsTransaction` type doesn't declare and the UI doesn't render — not sensitive (all scoped to the requesting customer's own data), just wire waste. `GET /rewards/me/transactions` is a fully dead endpoint — see Finding #3.

## Loading/error/realtime behavior
Uses the shared `useCustomerQuery` hook — benefits from the "preserve data on fetch error" fix already made in `docs/audits/customer-web/dashboard.md`, Finding #1 (no separate fix needed here, same hook instance). `DataPageStatus` plus a manual "Try again" retry button handle the loading/error display, matching the pattern used on `/wallet`. No polling or realtime subscription.

## UI/UX notes
- The loyalty summary card's progress bar (`page.tsx:150-155`) has no `role="progressbar"`/`aria-valuenow` etc. — a purely visual `<div>` width, so a screen reader gets no indication of tier progress beyond the surrounding text (which does convey the same info in words, so this is a minor a11y gap rather than a missing information issue).
- Catalog redeem buttons use three different label states (`Redeeming…` / `Redeem` / `N to go`) on the same button — clear and information-dense, a good pattern other "spend a resource" actions in the app could reuse.
- Success/error banners after redeem (`redeemMessage`/`redeemError`) appear below `ShareInviteCard`, i.e. not immediately next to the catalog section that triggered them — on a long page a customer may need to scroll to notice the confirmation. Left as a note; not fixed inline since moving the banner risks disrupting the card order other tests/screenshots may depend on, and it's still visible without scrolling on typical viewport heights.
- Referral code fetch failure is silently swallowed (`.catch(() => {})`, `page.tsx:71`) — if `/rewards/me/referral-code` fails, the card just falls back to the generic "Invite friends..." copy with no error shown, which is a reasonable degrade (not a broken UI) but means a persistent failure is invisible to both the customer and anyone debugging from a screenshot/report. Same pattern for referral-stats — see Finding #2.
