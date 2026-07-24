# Audit: Partner-web — Reports

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/reports/page.tsx`
- Component(s): `ReportList` (inline in the page file)

## Sub-pages
None — no outbound navigation into a dynamic detail route. The "Revenue →"
link goes to `/revenue`, a sibling top-level page with its own data (daily
revenue/payout series), not a detail view of this page's own report.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load report | GET | `/partner/reports?days=7\|14\|30` | `PartnerReportData` | `PartnerController.getReports` -> `PartnerOperationsService.getReports` |

## Backend trace
`getReports` windows on `updatedAt >= (now - days)` (not `createdAt`) via the
same `dashboardScopeFilter` used by the dashboard (`PARTNER` -> own
`partnerId`+owned `branchId`s, `ADMIN` -> unscoped) — so this is honestly a
report of orders *touched* in the period, not *placed* in it, which matches
the page's own copy ("All orders touched in this period, grouped by current
status", `page.tsx:152`) rather than contradicting it. `payout` is
`revenue - totalFee`, where `totalFee` sums `computeOrderFee` per completed
order using each order's own branch's `commissionRate` (via
`resolvePartnerBranches`/`commissionRateMap`) — the same fee-computation
helper already documented and used by `getDashboard`. No N+1: one `orders`
query plus one `branches` query, all in-memory aggregation after that.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Total orders | `report.totalOrders` | |
| Completed | `report.completedOrders`, `completionRate` (client-derived: `round(completedOrders/totalOrders*100)`, guarded against `totalOrders === 0`) | |
| Earnings (completed) | `report.payout` (fallback `report.revenue` only if `payout` is `null`/`undefined`, not if it's legitimately `0`) | |
| Avg order value | `report.averageOrderValue`, gated on `report.completedOrders > 0` (shows `'—'` otherwise) | revenue-based average, correctly labeled as such, not conflated with payout |
| Orders by status / Completed by service | `report.ordersByStatus`, `report.completedByService` (both `Record<string, number>`, sorted desc by count client-side via `sortedEntries`) | key labels are raw status/booking-type strings with underscores replaced by spaces — no hardcoded label map to drift out of sync with backend enum values, unlike some other pages' category maps |
| Days filter chips (7/14/30) | `days` (local state, drives the `days` query param and the `usePartnerQuery` reload dependency) | |
| Export CSV | all of the above fields plus the two `Record` breakdowns flattened into extra rows | button disabled only when `!report`, not when a refresh is in flight — exporting the last-known-good report during a background refresh is reasonable, not a bug |

## Mutations
None — this page is read-only (a report view), aside from the client-only "Export CSV" action which doesn't touch the network.

## Authorization
`GET /partner/reports` is `@Roles(UserRole.PARTNER, UserRole.ADMIN)` (`partner.controller.ts:502`), matching the frontend's `useRequirePartner()` (`PARTNER`/`ADMIN` only, no `STAFF`). Scope is derived entirely server-side from `req.user` via the shared `dashboardScopeFilter`/`resolvePartnerBranches` helpers (already verified correct in prior audits) — no request param can widen it. No `[authz]` issues.

## Findings

1. **[FIXED] Dead, misleadingly-named field in the report response.** `getReports` (pre-fix, `partner-operations.service.ts:894`) returned `processingStepsCompleted: LAUNDRY_PROCESSING_STEPS.length` — but `LAUNDRY_PROCESSING_STEPS` is the static, fixed list of *defined pipeline step types* (a constant, same value on every call regardless of period/data), not anything about steps actually completed in the reported period. The name strongly implies a dynamic, period-derived metric — and a field with the identical name exists elsewhere in the codebase (`support.service.ts:548`, `order.laundryProcessing?.completedSteps?.length`) computing something real and per-order, which is almost certainly where this name was copied from and then wired to the wrong value. The field was never declared in the frontend's `PartnerReportData` type (`packages/types/src/partner.ts:182-192`) and never read by this page — confirmed dead, not silently relied upon anywhere.
   **Fix:** removed the field from `getReports`'s response and the now-unused `LAUNDRY_PROCESSING_STEPS` import — `apps/api/src/modules/partner/partner-operations.service.ts`. Typechecked `apps/api` clean.

No other issues found — every other field the backend returns is declared in `PartnerReportData` and rendered somewhere on this page, and the "touched in period" (`updatedAt`) windowing is accurately described by the page's own copy rather than silently differing from what a reader would assume.

## Unused/dead fields
None remaining after the fix above — every field in `PartnerReportData` is now both returned and rendered.

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md` — this page benefits from that fix
too). No polling or realtime subscription — a manual "Refresh" button and
changing the days filter both trigger a reload; reasonable for a
point-in-time report rather than a live operational view.
