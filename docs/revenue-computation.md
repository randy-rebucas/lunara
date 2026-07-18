# Revenue Computation

How Lunara computes "revenue" across the admin dashboard, revenue board, and reports.
Source: [`apps/api/src/modules/admin/admin.service.ts`](../apps/api/src/modules/admin/admin.service.ts).

## Core rule

```
revenue = Σ order.total  for orders where order.status ∈ COMPLETED
```

```ts
const COMPLETED = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];
```

`order.total` is the **customer-facing gross amount** on the order:

```
total = subtotal - discount + deliveryFee
```

(`order.schema.ts:349-362`). This is gross revenue, not Lunara's take — it does **not**
subtract partner payouts. Partner commission/payout math lives separately on
`baseSubtotal` and `pricingModel` (see [platform-commission.md](platform-commission.md)),
and is computed at settlement, not at order-completion time.

Orders that are cancelled, still in progress, or otherwise not in `COMPLETED` contribute
`0` to every revenue figure below.

Time filters use `order.updatedAt` (i.e. when the order was last touched / completed),
**not** `order.createdAt`. An order created last week but completed today counts as
today's revenue.

## `getRevenue()` — Revenue board (admin.service.ts:1056-1205)

This is the primary endpoint behind the revenue board UI. It computes, in parallel:

| Field | How it's computed |
|---|---|
| `today` / `todayOrders` | Completed orders with `updatedAt >= startOfDay` |
| `month` (`summary.thisMonth`) | `sumRange(startOfMonth)` — Mongo `$match` + `$group` sum of `total` |
| `summary.lastMonth` | `sumRange(startOfLastMonth, startOfMonth)` |
| `summary.ytd` | `sumRange(startOfYear)` |
| `allTimeCompleted` | `countDocuments({status: COMPLETED})` (count only, no sum) |
| `week` | Rolling 7-day window (`weekStart` = today − 6 days), includes `subtotal`, `deliveryFees`, `discounts` broken out separately, plus `revenue` |
| `prevWeek` | The 7 days before `week`, for comparison |
| `daily` / `prevDaily` | Per-day revenue+orders buckets for both weeks, keyed by local calendar day (`localDayKey`, not UTC) |
| `byBranch` | Revenue/orders grouped by `branchName`, top 8 by revenue |
| `byService` | Revenue/count grouped by `bookingType` |
| `byPayment` | **Not from orders** — aggregated separately from `paymentModel` where `purpose: 'order'`, `status: 'paid'`, `paidAt >= weekStart`, grouped by `method` |
| `topDays` | Top 5 days from `daily` by revenue |

### Derived metrics

- `revenueDelta` / `ordersDelta` — `pctDelta(current, previous)`, returns `null` if
  `previous <= 0` (avoids divide-by-zero / infinite %), else `round(((cur-prev)/prev)*1000)/10`
  (one decimal place).
- `avgOrderValue = round(week.revenue / week.orders)` (0 if no orders).
- `avgPerDay = round(week.revenue / 7)`.

### Query strategy

- `sumRange()` (month/lastMonth/YTD) runs as a Mongo aggregation — sums happen in the DB.
- The daily/weekly/branch/service breakdowns instead pull **all completed orders from the
  last 14 days into memory** in one query (`windowOrders`), then bucket them in JS. This
  avoids 5+ separate aggregations but means the endpoint's memory cost scales with
  2-week order volume.

## Other revenue computations (same file, different slices)

- **Dashboard summary** (`admin.service.ts:~212-267`) — month/week revenue and a branch
  leaderboard shown on the main admin dashboard. Same `COMPLETED` + `total` rule, computed
  independently from `getRevenue()` (duplicate logic, not shared).
- **`getReports(days)`** (`admin.service.ts:1207`) — revenue for a custom trailing window
  (default 7 days), filtered by `createdAt` (not `updatedAt`, unlike the revenue board)
  before filtering completed. Also returns `averageOrderValue`.
- **Partner revenue** (`admin.service.ts:~837-904`) — per-partner `revenue` (all-time) and
  `revenue30d`, via separate `$group` aggregations keyed by `partnerId`. Same `total`-sum
  rule, scoped to one partner's orders.

## Things to double check in review

1. **`updatedAt` vs `createdAt` inconsistency** — the revenue board uses `updatedAt`,
   `getReports()` uses `createdAt`. An order created outside the report window but
   completed inside it is counted differently between the two views. Confirm this is
   intentional.
2. **Gross vs. net** — every figure here is gross customer revenue (`total`), not Lunara's
   commission/margin. If "revenue" is meant to represent platform take, this is the wrong
   number; see `platform-commission.md` for the commission-side calculation.
3. **Duplicate logic** — the dashboard summary and `getRevenue()` both compute week/month
   revenue independently. A fix to one won't propagate to the other.
4. **14-day in-memory window** — `windowOrders` load is unbounded by pagination; revenue
   board latency will grow with daily order volume in that window.
