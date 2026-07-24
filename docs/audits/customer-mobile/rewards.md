# Audit: Customer-mobile — Rewards

Date: 2026-07-24

## Entry point
- Screen: `apps/customer-mobile/app/rewards.tsx`
- Component(s): `Card`, `Button`, `DataLoadState`

## Sub-pages
None.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Balance + tier + history | GET | `/rewards/me` | `RewardsBalance` | already traced in `docs/audits/customer-web/rewards.md` |
| Catalog | GET | `/rewards/catalog` | `RewardsCatalogItem[]` | same |
| Redeem | POST | `/rewards/redeem` | `{ voucher: { code }, balance }` | same — includes the atomic `findOneAndUpdate({ loyaltyPoints: { $gte } }, { $inc })` guard against a race-condition double-redeem, already confirmed safe |

## Backend trace
Same already-fully-traced endpoints — no new backend behavior. Every method still requires a real `Customer` document (naturally scoping this to customer accounts only, per the precedent already documented for `docs/audits/customer-web/rewards.md`).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Points card (tap to expand history) | `rewards.balance` | |
| Transaction history (collapsible) | `transactions[]` (`type`, `amount`, `description`, `createdAt`) | |
| Tier card | `tier`, `nextTier`, `pointsToNextTier`; `progress` derived client-side | `TIER_ICONS` keyed by tier name — falls back to a generic star icon for any unrecognized tier, graceful |
| "How it works" | static `Alert.alert` copy | |
| Rewards catalog | per-item `title`, `description`, `points`, `discountType`/`discountValue`; `canRedeem` derived client-side | `CATALOG_STYLE` keyed by catalog item id, falls back to `DEFAULT_ITEM_STYLE` for any unstyled id — won't break if the backend catalog adds a new item |
| "More rewards coming soon" note | static | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Redeem reward | no (spends points, atomically guarded server-side) | n/a — same reasoning already documented for the web equivalent (atomic guard + clear voucher-code confirmation makes an accidental double-spend a non-issue) | yes — `disabled={redeemingId !== null}` blocks redeeming *any* catalog item while one is in flight, matching the strong guard already praised on customer-web's rewards page | yes (`Alert.alert`) |

## Authorization
Same already-confirmed pattern (no `RolesGuard` on `RewardsController`, but every method requires a real `Customer` document). No `[authz]` issue distinct from what's already documented.

## Findings
No issues found.

## Unused/dead fields
None found.

## Loading/error/realtime behavior
Single load with `DataLoadState` retry. No polling or realtime subscription — balance/catalog only refresh on mount or after a successful redeem (`await load()`).
