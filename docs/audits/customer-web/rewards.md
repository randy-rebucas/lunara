# Audit: Customer-web — Rewards

Date: 2026-07-23

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

## Backend trace
`getBalanceAndHistory`/`redeem`/`getOrCreateReferralCode` all require a real `Customer` document to exist for `userId` (`customerModel.findOne({ userId })`), throwing `NotFoundException` otherwise. `RewardsController` itself only has `@UseGuards(JwtAuthGuard)` — no `RolesGuard`/`@Roles(...)` — so in principle any authenticated role could call these routes, but the Customer-document requirement naturally scopes them to real customers regardless (a partner/staff/admin/rider has no `Customer` document and gets a 404), the same pattern already accepted in `docs/audits/customer-web/login.md`'s Authorization section for `customers.controller.ts`. Not re-flagged as a new finding here since it's the identical, already-documented shape of gap.

`redeem` (`rewards.service.ts:131-171`) is well-built: the points deduction uses a single atomic `findOneAndUpdate({ userId, loyaltyPoints: { $gte: item.points } }, { $inc: { loyaltyPoints: -item.points } })` — this closes the race a naive read-then-write (or a purely client-side `canRedeem` check) would leave open, so two near-simultaneous redeem requests (e.g. a double-click that somehow got past the UI's own guard, or two tabs) can't both succeed and drive the balance negative; the second attempt's `$gte` filter simply won't match and returns `null`, which the service turns into a clean `BadRequestException('Not enough points to redeem this reward')`. Voucher/referral code generation both retry on a duplicate-key collision (up to 8 attempts) rather than trusting a single random-generation attempt to be unique.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Loyalty summary card | `balance`, `tier`, `nextTier`, `pointsToNextTier`; `progress` derived client-side (`balance / (balance + pointsToNextTier)`, clamped) | |
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
No issues found. This module is a strong example in this audit series: the redemption race condition is closed with a single atomic Mongo update rather than a read-check-write pattern, and the double-submit guard on redeem is stricter than most other pages' (blocks all catalog items, not just the clicked one, while a redemption is in flight).

## Unused/dead fields
None found — every field in `RewardsData`/`RewardsCatalogItem`/`RewardsTransaction` is rendered.

## Loading/error/realtime behavior
Uses the shared `useCustomerQuery` hook — benefits from the "preserve data on fetch error" fix already made in `docs/audits/customer-web/dashboard.md`, Finding #1 (no separate fix needed here, same hook instance). `DataPageStatus` plus a manual "Try again" retry button handle the loading/error display, matching the pattern used on `/wallet`. No polling or realtime subscription.
