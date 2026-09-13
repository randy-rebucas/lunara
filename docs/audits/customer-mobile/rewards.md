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
| Redeem reward | no (spends points, atomically guarded server-side) | n/a — same reasoning already documented for the web equivalent (atomic guard + clear voucher-code confirmation makes an accidental double-spend a non-issue) | yes — `disabled={redeemingId !== null}` blocks redeeming *any* catalog item while one is in flight, matching the strong guard already praised on customer-web's rewards page | yes (`Alert.alert`) — **[FIXED]** the post-redemption refetch failing no longer blanks the whole screen, see Finding #1 |

## Authorization
Same already-confirmed pattern (no `RolesGuard` on `RewardsController`, but every method requires a real `Customer` document). No `[authz]` issue distinct from what's already documented.

## Findings

1. **[FIXED] A failed post-redemption refetch wiped the entire screen, right after a successful redemption.** The render gate was `!loading && !error && rewards` — but `loading` is only ever set back to `true` by the initial mount effect; `redeem()`'s `await load()` (fired after a successful `POST /rewards/redeem`) runs with `loading` already `false`, so if that refetch failed (transient network issue, unrelated to the redemption itself, which had already succeeded and shown its own `Alert.alert` confirmation), `load()`'s catch set `error`, and the gate immediately hid the points card, tier card, and entire rewards catalog — replacing everything with just the `DataLoadState` error banner. A customer who just redeemed a reward would see their whole rewards screen disappear right after. Same root-cause family as `docs/audits/customer-mobile/subscriptions.md` Finding #3 (stale-but-valid data hidden behind an unrelated `!error` gate), independently present here since this screen predates and doesn't use the shared `useAsyncResource` hook.
   **Fix:** dropped `!error` from the gate — content now renders whenever `rewards` is non-null (i.e., at least one successful load has happened), regardless of a later refresh/reload failure. `DataLoadState`'s error banner still renders above the (now-preserved) stale content when `error` is set, giving the same "banner + old data" behavior as the subscriptions-screen fix.

## Unused/dead fields
None found.

## Loading/error/realtime behavior
Single load with `DataLoadState` retry. No polling or realtime subscription — balance/catalog only refresh on mount or after a successful redeem (`await load()`).
