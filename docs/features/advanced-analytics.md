# Feature: Advanced analytics (cohort retention, LTV, demand forecasting)

> **Status:** draft (design only — not implemented)
> **Date:** 2026-07-24
> **Author / PR:** —

## Summary

Admin-web's current `reports-board.tsx` (backed by `AdminService.getReports()`) is a rollup dashboard: totals, revenue, average order value, new customers, orders by status/service, for a fixed lookback window (7/14/30 days). It has no concept of a customer cohort, no lifetime-value calculation, and no forecasting. This document scopes what each of those three sub-features would take, and — more importantly — the product decisions each one needs before any schema or query work starts.

This is written as a design doc rather than implemented because all three sub-features are genuinely open-ended without input this session can't supply (see "Open questions" per section).

## 1. Cohort retention

**What it means concretely:** group customers by the month (or week) they placed their first order, then for each subsequent period show what fraction of that cohort placed another order — the classic retention triangle/heatmap.

**Data already available:** `Order.customerId` + `Order.createdAt`/`status` is enough to compute this — no new fields needed. `CustomersService`/`orders.service.ts` already has the raw order history.

**What's missing:** a dedicated aggregation (group orders by customer, find each customer's first-order month, then bucket subsequent orders by months-since-first-order) and a heatmap UI component (admin-web has no chart library currently wired for this shape — check `reports-board.tsx`'s existing bar/list visuals vs. what a cohort grid needs).

**Open questions:**
- Cohort granularity: weekly or monthly? Monthly is coarser but the platform may not have enough order volume yet for weekly cohorts to be meaningful.
- "Retained" definition: any order, or a completed order, or an order above some minimum value?
- How far back do we backfill — all historical orders, or only from a chosen start date?

## 2. LTV (lifetime value)

**What it means concretely:** an estimated total revenue (or profit) a customer will generate over their relationship with Lunara — either historical-to-date LTV (sum of completed order value per customer, trivial to compute) or predictive LTV (projecting future value from early behavior, which needs a model).

**Data already available:** historical LTV (sum of `Order.total` per `customerId` for completed orders) is a simple aggregation — no new infrastructure.

**What's missing for predictive LTV:** this needs a defined formula or model (e.g. average order value × predicted order frequency × predicted customer lifespan), which requires enough historical data to fit, and a decision on whether "predictive" is even worth building before the platform has a few months/quarters of order history to validate against.

**Open questions:**
- Is "LTV" here just historical-to-date total spend (cheap, ships fast), or a genuine prediction (needs a model + validation data Lunara may not have accumulated yet)?
- Per-customer number shown where — a new admin customer-detail field, or an aggregate distribution (e.g. LTV deciles)?

## 3. Demand forecasting

**What it means concretely:** predicting future order volume (platform-wide, per-branch, or per-service) to help with staffing/rider-supply planning.

**Data already available:** `Order.createdAt`/`scheduledPickupAt` history per branch/service exists.

**What's missing:** this is the most infrastructure-heavy of the three. A real forecast needs either a statistical time-series method (e.g. seasonal decomposition, moving averages) or an ML model, a decision on forecast horizon (next day? next week?), and a place to serve/refresh the forecast (a scheduled job, similar to `subscriptions-scheduler.service.ts`'s cron pattern, that recomputes periodically). This is the sub-feature most likely to need a dedicated data/ML effort rather than an incremental admin-web addition.

**Open questions:**
- What's the forecast actually used for — rider staffing, branch capacity planning, marketing spend? The answer changes what granularity/horizon matters.
- Is a simple moving-average/seasonal baseline good enough for v1, or does this need real ML infra (which the codebase has none of today)?

## Affected apps (if built)

| App | Wired? | Notes |
|-----|--------|-------|
| `api` | no | New aggregation endpoints (`admin.service.ts` or a dedicated `analytics` module); forecasting needs a scheduled recompute job |
| `admin-web` | no | New charts/visualizations — cohort heatmap and forecast trend line are UI patterns not currently in the codebase |

## Recommendation

Ship historical-to-date LTV first if any of this is prioritized — it's a simple aggregation over data that already exists, with no open product questions (unlike cohort granularity or forecasting methodology). Cohort retention is the next-cheapest. Demand forecasting should wait until there's a concrete downstream use case (e.g. "riders/branches want a staffing forecast") to size correctly, since it's the one sub-feature that could balloon into its own project.

## Out of scope / follow-ups

- No chart library is currently used in admin-web beyond the simple bar/list visuals already in `revenue-board.tsx`/`reports-board.tsx` — a cohort heatmap or forecast trend line would need one evaluated and added.
- Nothing here should be started until the "Open questions" above have answers.
