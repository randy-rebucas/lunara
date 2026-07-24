# Audit: Admin-web — Overview (dashboard) page

Date: 2026-07-22 (findings 1 and 2 fixed 2026-07-22)

## Entry point
- Page: `apps/admin-web/src/app/page.tsx` (client component, renders `<OperationsCenterBoard />`)
- Component: `apps/admin-web/src/components/datacenter/operations-center-board.tsx`

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Initial load + manual "Sync" + socket-triggered reload | GET | `/admin/dashboard` | `DashboardData` (operations-center-board.tsx:15) | `AdminController.getDashboard` (admin.controller.ts:196) -> `AdminService.getDashboard` (admin.service.ts:145) |
| Realtime subscription | WS | `admin-realtime` socket, events `dispatchQueueUpdated` / `dispatcherAlert` | `useAdminOperationsSocket` | triggers `reload()` of the same dashboard fetch, no separate payload consumed |

## Backend trace
`AdminService.getDashboard` runs ~19 queries in parallel (`Promise.all`) covering
counts (orders, riders, users by role, tickets, promos, pending dispatch), a
month-to-date completed-orders scan for revenue, an 8-order "recent orders" find,
a previous-week window for delta comparisons, a 7-day settled-orders window used to
build the trend/revenue-by-day series and branch/rider leaderboards, a status-group
aggregate, and three `countDocuments`/`estimatedDocumentCount` calls for all-time
totals. It then does a second round-trip to resolve rider and customer display names
for the leaderboard + recent-orders list. This is a lot of work behind one endpoint
but it's parallelized and window-scoped (not full-collection scans except the intentional
`estimatedDocumentCount`), so it's acceptable for a dashboard refresh rather than a
per-keystroke call.

## Cards / panels

Every widget on the page reads from the single `DashboardData` payload — there is
no per-card fetch. Listed in render order:

| Card | Fields consumed | Notes |
|---|---|---|
| System state banner | `counts.pendingDispatch`, `counts.openTickets`, `counts.activeOrders` | State (nominal/attention/critical) derived client-side by `deriveSystemState()` (operations-center-board.tsx:57-61); thresholds (10 tickets, 15 dispatch, 50 active) are hardcoded, not server-driven or configurable. |
| Stat cards (6): Orders (7d), Active orders, Completed (7d), Revenue (7d), Laundry partners, Riders | `week.orders`, `deltas.orders`, `counts.activeOrders`, `counts.ordersToday`, `week.completed`, `deltas.completed`, `revenue.week`, `deltas.revenue`, `counts.partners`, `counts.activePromos`, `counts.totalRiders`, `counts.ridersOnline` | Each card links out (`/orders`, `/revenue`, `/partners`, `/riders`, etc.); "Riders" card additionally derives `riderPct` client-side from `ridersOnline / totalRiders`. |
| Orders overview (line chart) | `trend[]` (`date`, `created`, `completed`, `cancelled`) | Renders all three series via `TrendLineChart`/`TrendLegend` (dash-charts.tsx) — full use of the trend payload, no dead sub-fields. |
| Orders by status (donut) | `statusBreakdown[]` (`key`, `label`, `count`), `totals.totalOrders` | Colors mapped client-side via `STATUS_COLORS` (operations-center-board.tsx:94-101); any backend status-bucket `key` not present in that map silently falls back to gray `#94a3b8` — bucket keys and the color map must be kept in sync manually (currently in sync: pending/confirmed/in_progress/out_for_delivery/completed/cancelled). |
| Quick actions | none (static links) | `QUICK_ACTIONS` (operations-center-board.tsx:236-243) is a hardcoded list of 6 shortcut links; not server-configurable. |
| Live activity | `activity[]` (`orderId`, `status`, `branchName`, `at`), sliced to first 5 | Backend already returns activity pre-sorted by most recent; slice is just a display cap, no re-sort needed client-side. |
| Top laundry shops | `topBranches[]` (`id`, `name`, `orders`, `revenue`) | Backend caps to top 5 and pre-sorts by revenue (admin.service.ts:265-268); frontend renders as-is. |
| Top riders | `topRiders[]` (`id`, `name`, `deliveries`) | Same pattern — backend caps to top 5, pre-sorted by delivery count. |
| Revenue overview | `revenue.week`, `revenue.month`, `revenue.monthOrders`, `revenueDaily[]` | See Finding 2 (fixed) — month figures now shown alongside the weekly bar chart. |
| Recent orders (table) | `recentOrders[]` (`_id`, `status`, `bookingType`, `total`, `customer`, `branchName`, `riderName`, `createdAt`), sliced to first 6 | Backend sends 8, UI shows 6 — 2 fetched rows never displayed; harmless (cheap over-fetch, not worth trimming). `updatedAt` also sent but unused, see below. |
| System overview | `counts.customers`, `totals.totalOrders`, `totals.completedOrders`, `totals.cancellationRate`, `counts.staff`, `counts.openTickets` | Static 6-row grid, each linking to the relevant management page. |

## Findings (fixed)

1. **[FIXED] A failed background refresh wiped the whole dashboard, not just stale data.**
   `useAsyncQuery` (packages/hooks/src/use-async-query.ts) called `setError(...)`
   **and** `setData(null)` in its catch block. The overview page's socket handler
   (`operations-center-board.tsx:268-275`) calls `reload()` on every
   `dispatchQueueUpdated`/`dispatcherAlert` event, so a transient refetch failure
   blanked the entire rendered dashboard. Fix: `reload()` no longer clears `data` on
   error — it now only sets the error message, so the last-good render stays on
   screen with the error banner shown above it. Since `useAsyncQuery` lives in
   `@lunara/hooks`, this fix applies to every admin-web page built on `useAdminQuery`,
   not just this one.

2. **[FIXED] `revenue.month` and `revenue.monthOrders` were fetched but never rendered.**
   The backend computes and returns them (admin.service.ts:212, 332-333); the
   frontend type declared them but no code read them. Fix: the "Revenue overview"
   panel (`operations-center-board.tsx`) now shows a "Month to date" line with
   `revenue.month` and the order count from `revenue.monthOrders`, alongside the
   existing weekly figure.

## Unused/dead fields
- `recentOrders[].updatedAt` — **[REMOVED 2026-07-22]** was returned by the backend but never read by
  the frontend (which already shows `createdAt`). Dropped from `AdminService.getDashboard`'s
  `recentOrders` mapping; no frontend change needed since it was never typed there.

## Loading/error/realtime behavior
- Loading: handled — spinner shown only on first load (`loading && !data`,
  operations-center-board.tsx:346), so manual "Sync" clicks don't blank the screen
  (button flips to "Syncing…" and is disabled instead).
- Error: banner shown via `alert-error` when `error` is set; as of the Finding 1 fix,
  the rest of the panel keeps rendering the last-good `data` underneath the banner
  instead of disappearing on a failed reload.
- Empty states: each panel (activity, top branches, top riders, recent orders) has
  its own explicit empty message, correctly scoped per-list rather than one global
  empty state.
- Realtime: `useAdminOperationsSocket` (apps/admin-web/src/lib/use-admin-operations-socket.ts)
  uses a ref-backed handler pattern so the socket subscription itself is only set up
  once (`useEffect` with `[]` deps at line 43-51), even though the passed-in handlers
  close over `reload`. No thrashing/resubscribe risk. `socketLive` is polled via a
  2s `setInterval` (operations-center-board.tsx:277-281) purely to reflect connection
  status in the UI badge — harmless, but it's a redundant poll layered on top of an
  already-event-driven socket; could instead be driven by `onConnected` callbacks if
  `useAdminOperationsSocket` exposed them directly (it already returns `connected`,
  which this component doesn't use — it re-derives the same value via polling instead).
