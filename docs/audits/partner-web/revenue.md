# Audit: Partner-web — Revenue

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/revenue/page.tsx`
- Component(s): `PaymentBadge` (inline in the page file)

## Sub-pages
None — no outbound navigation into a dynamic detail route. "Full reports →"
and "View settlements →" link to sibling top-level pages (`/reports`,
already audited in `docs/audits/partner-web/reports.md`; `/settlements`, not
yet audited), not detail views of this page's own data.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load revenue | GET | `/partner/revenue` | `PartnerRevenueData` | `PartnerController.getRevenue` -> `PartnerOperationsService.getRevenue` |

## Backend trace
`getRevenue` scopes every query through the shared `revenueOrderFilter`
(`COMPLETED_STATUSES` + `branchId $in` the caller's own branches via
`resolvePartnerBranches` — correctly aggregates across *all* of a
multi-branch partner's branches, unlike the single-arbitrary-branch issue
found in `docs/audits/partner-web/profile.md`'s `resolveBranch`). It computes
today/week/month/all-time revenue and fee/payout breakdowns
(`computeOrderFee`, the same shared per-order fee helper used by
`getReports` and `getDashboard`), a 7-day daily chart series, and the 200
most recent completed orders with per-order payment status. See Finding #1
for a real N+1 query pattern found and fixed here.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Today | `data.todayPayout` (fallback `data.today` if `payout` is null/undefined), `.todayOrders`, `.avgOrderToday` (shown only if `todayOrders > 0`) | |
| Last 7 days | `data.weekPayout`/`.week`, `.weekOrders` | |
| Month to date | `data.monthPayout`/`.month`, `.monthOrders`, `.avgOrderMonth` | |
| All time | `data.allTimePayout`/`.allTimeRevenue`, `.allTimeCompletedOrders` | |
| Daily breakdown bar chart | `data.daily[].date/revenue/payout/orders`, `chart.maxRevenue`/`.totalWeek`/`.bestDay` (all client-derived from `data.daily`) | bar height and "best day" label are client-computed from already-server-computed per-day payout; consistent single source of truth (server), no client/server duplication of the fee math itself |
| Daily table (reversed chronological) + 7-day total footer | same `data.daily` fields | |
| Completed orders table + Cash/Digital/All filter | `o.completedAt`, `.orderId` (truncated to last 8 chars, uppercased, for display only), `.paymentMethod`, `.cashCollected`, `.cashTiming`, `.cashCollectedAt`, `.partnerPayout` (fallback `.amount`) | `PaymentBadge` hardcodes GCASH/MAYA/WALLET display labels — matches `PaymentMethod` enum values currently in use, would silently fall back to showing the raw method string for any new method added later (graceful degradation, not a crash) |
| Export CSV | `data.daily[].date/revenue/payout/orders` | button disabled only when `!data`, same "export last-known-good during a background refresh" pattern as Reports, not a bug |

## Mutations
None — this page is read-only (a revenue/earnings view), aside from the client-only "Export CSV" action.

## Authorization
`GET /partner/revenue` is `@Roles(UserRole.PARTNER, UserRole.ADMIN)` (`partner.controller.ts:511`), matching the frontend's `useRequirePartner()` (no `STAFF`). Scope comes entirely from `revenueOrderFilter`'s server-derived `branchId $in` clause — no request param exists to widen it. No `[authz]` issues.

## Findings

1. **[FIXED] N+1 query pattern — the 7-day chart re-fetched data already loaded by the week query, one query per day, sequentially.** `getRevenue` (pre-fix) fetched `week` (`updatedAt >= weekStart`, i.e. exactly the same 7-day window) via a single query, then immediately re-fetched the *same* underlying data again with 7 additional sequential `await`ed queries inside a `for` loop — one per day, each re-querying orders already present in the `week` array (`partner-operations.service.ts:914-1002`, pre-fix). `today` was a third redundant query on top of that (`updatedAt >= startOfDay`, a strict subset of `week`'s range). Net effect: every load of this page issued roughly 12 sequential/parallel DB round-trips where 4 would do, with 7 of them serialized one after another (not even parallelized via `Promise.all`) — a real, measurable latency cost on a page a partner might refresh often to check earnings.
   **Fix:**
   - Removed the separate `today` query; it's now derived by filtering the already-fetched `week` array (`o.updatedAt >= startOfDay`), which is always valid since `weekStart <= startOfDay` by construction — `apps/api/src/modules/partner/partner-operations.service.ts:914-916,958-960`.
   - Removed the 7-iteration per-day DB query loop; each day's orders are now derived by filtering the already-fetched `week` array against the exact same `[d, next)` boundaries the per-day query used, preserving identical semantics (including the existing local-vs-UTC date-boundary behavior — unchanged, not a new bug introduced) — `apps/api/src/modules/partner/partner-operations.service.ts:985-996`.
   - Net result: 4 DB queries per page load (`week`, `month`, `recentCompleted`, the branch-grouped aggregate) instead of ~12, with no behavior change — every returned number is computed from the identical underlying documents as before, just fetched once instead of up to three times each.
   - Typechecked `apps/api` clean. This method has no other callers to regression-check (`getRevenue` is only reached via this one controller route).

No other issues found — every field `PartnerRevenueData`/`PartnerOrderDetail` return that this page actually needs is correctly rendered, and role/branch scoping is correctly aggregated across all of a multi-branch partner's branches (unlike the `Profile`/`Settings` single-branch issue).

## Unused/dead fields
`todayFee`/`weekFee`/`monthFee`/`allTimeFee` are computed and returned but
never displayed — the page only shows net payout figures, consistent with
its own framing ("Amounts reflect your payout after Lunara processing"),
appears to be a deliberate simplification rather than an oversight. Similarly,
`PartnerOrderDetail`'s `subtotal`, `lunaraFee`, `commissionRate`,
`pricingModel`, `bookingType`, and `receiptCode` are returned per order but
not rendered in the "Completed orders" table, which only shows the final
payout — same pattern, likely deliberate. None of these are sensitive
(they're the partner's own revenue/fee figures), so not flagged as findings.

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md` — this page benefits from that fix
too). No polling or realtime subscription — a manual "Refresh" button is the
only way to get fresher numbers, reasonable for an earnings summary rather
than a live operational view.
