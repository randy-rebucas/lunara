# Audit: Rider-mobile — Earnings (history + breakdown)

Date: 2026-07-24

## Entry point
- Page: `apps/rider-mobile/app/earnings.tsx`
- Component(s): inline `PeriodCard`, `ActivityStat`, `EarningRow` — no sub-components in other files. Uses `src/components/earning-type-badge.tsx` for the per-row type pill.

## Sub-pages
None — no outbound navigation into a detail route. This is itself the deep sub-page reached from both `(tabs)/index.tsx`'s "View earnings history" link and `(tabs)/profile.tsx`'s "Earnings history" row (see [home.md](home.md) and [profile.md](profile.md) Sub-pages tables), audited here per the scope carve-out for separate deep features.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Earnings summary + recent entries | GET | `/riders/earnings` | `EarningsData` | `RidersController.getEarnings` → `RidersService.getEarnings` |

Same endpoint already traced in [home.md](home.md) Data flow (`weekEarnings`/`monthEarnings` for the home dashboard's two tiles) — this screen fetches its own independent copy on mount rather than reading anything from the shared context, which is appropriate here since it also needs `recentEarnings[]`, `todayPickups/Deliveries`, and `lifetimeEarnings`, none of which the context loads.

## Backend trace
`RidersService.getEarnings` (`riders.service.ts:712-748`): five queries run in parallel — two `countDocuments` for today's pickup/delivery completions (scoped by `pickupRiderId`/`deliveryRiderId` matching the caller), `riderWalletService.sumCreditsSince` for week/month (a `$match`+`$group` aggregation over the rider's wallet transactions, scoped by `riderUserId`), and `getRecentEarningEntries` (a scoped `find` capped at 30, filtered to `type:'credit'` and `reference` matching `^earning:`). No N+1, all scoping correct. `lifetimeEarnings` and `totalEarnings` in the response are both set to the same `rider.totalEarnings` value (`riders.service.ts:741-742`) — see Unused/dead fields.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Period grid (4 tiles: Today/Week/Month/Lifetime) | `todayEarnings`, `weekEarnings`, `monthEarnings`, `lifetimeEarnings` | same shape as the home dashboard's earnings grid ([home.md](home.md) Cards table) but sourced entirely from this one endpoint here, vs. home's grid which splits across `/riders/me` (today/lifetime) and `/riders/earnings` (week/month) — two different screens showing the same four numbers via two different fetch compositions. Not a bug (both ultimately read the same `rider.totalEarnings`/`todayEarnings` fields), just worth knowing if the two ever need to be reconciled. |
| Today's activity (2 stats) | `todayPickups`, `todayDeliveries`, hardcoded `RIDER_PICKUP_PAYOUT`/`RIDER_DELIVERY_PAYOUT` (shared constants from `@lunara/utils`) | the "per task" rate shown is a flat constant, not the rider's actual computed average or the backend's per-task payout logic — if per-task payout ever varies (surge pricing, distance-based pay, promos), this label would silently misrepresent actual earnings without the constant being updated; flagged as a fidelity note, not a bug, since the constant is presumably still the flat rate in effect |
| Earnings breakdown (list) | `recentEarnings[]` → `item.type`, `item.orderId`/`item.note`, `item.earnedAt`, `item.amount` | reference label falls back `orderId → note → 'Manual credit'`; date formatted locally — no dead fields here, every field is used |

## Mutations
None — this screen is read-only (no create/update/delete actions).

## Authorization
Single endpoint, correctly scoped to `req.user.sub` throughout the service and its wallet-service calls — no cross-rider access surface, no `[authz]` findings.

## Findings

1. **Dead empty `<View>` rendered above the breakdown list — `[fixed]`.** `data.recentEarnings.length > 0 ? <View style={styles.breakdownCard} /> : null` (`earnings.tsx:358-360`, pre-fix) rendered a childless `View` styled with `breakdownCard`'s border/shadow/background whenever there was at least one earning entry — a visible empty bordered sliver appearing between the error banner and the first real breakdown row, with no content and no apparent purpose (each `EarningRow` already renders inside its own `breakdownCard`-styled wrapper via `renderEarningItem`). Almost certainly a leftover from an earlier layout where the list wasn't yet split into per-row cards.
   **Fix:** removed the dead `View` — `apps/rider-mobile/app/earnings.tsx` (list header, after the error banner). Verified no other consumer of this exact JSX block exists (it's page-local, not a shared component), so nothing else was affected.

## Unused/dead fields
- `EarningsData.totalEarnings` is fetched but never read by this screen (only `lifetimeEarnings` is used, `earnings.tsx:321`) — and per the backend trace above, `totalEarnings` and `lifetimeEarnings` are set to the exact same value (`rider.totalEarnings`), so this is a genuinely redundant field in the API response, not just an unused-but-meaningful one. Low priority (four extra bytes on the wire, not sensitive), noting rather than fixing since removing a field from a shared response type risks breaking another consumer not checked in this pass (e.g. admin-web's rider profile view, not audited here).

## Loading/error/realtime behavior
Independent `loading`/`refreshing`/`error` state, with a sensible split between a full-screen error (only when there's no cached data to fall back to: `error && recentEarnings.length===0 && lifetimeEarnings===0`, `earnings.tsx:262`) and an inline error banner (when there's prior data still worth showing, `earnings.tsx:352-357`) — better than the all-or-nothing patterns seen elsewhere in this app. No realtime subscription; earnings update only via pull-to-refresh or re-navigation, which is appropriate for a historical/summary screen.
