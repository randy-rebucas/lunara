# Audit: Partner-web — Orders (monitor progress)

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/orders/progress/page.tsx`
- Component(s): inline in the page file

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/page.tsx` (or `.../receiving`) | row link, via `partnerOrderHref(o)` | `o._id` -> `id` route param | yes |

Same large, independent order-processing feature already flagged as
out-of-scope for a full trace across multiple prior audits — not re-traced
here.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List in-progress orders | GET | `/partner/orders/progress` | `{ items: PartnerOrderSummary[] }` | `PartnerController.getProgress` -> `PartnerOperationsService.getProgressMonitor` |
| Realtime pipeline updates | socket (same `usePartnerPipelineSocket` hook verified correct in `orders-queue.md`) | — | triggers `reload()` | `TrackingGateway` |

## Backend trace
`getProgressMonitor` scopes via the correctly multi-branch-aware
`dashboardScopeFilter` (already verified across several prior audits),
matches orders from `RECEIVED_AT_SHOP` through `READY_FOR_DELIVERY`, sorted
by `updatedAt: -1` — with **no `.limit()` at all**, unlike the sibling
Incoming-orders query (capped at 100). Items are summarized via
`summarizeIncomingBatch` — this page is the *other* large-scale caller
(alongside Incoming) that the N+1 fix in
`docs/audits/partner-web/dashboard.md` specifically targeted, and since this
query has no cap, it was also the one most exposed to that bug before the
fix — a shop with many orders mid-processing could previously have
triggered dozens+ of sequential per-order `assignedStaffId` lookups on every
load of this page. See Finding #1 for the still-open unbounded-query concern.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| "N in pipeline" summary line | client-derived `items.length`, `readyCount` (`items.filter(status === 'ready_for_delivery').length`) | |
| Order row | `o.bookingType`, `.total`, `.status`, `.currentStepLabel` (fallback `'Processing'`), `.assignedStaffEmail` (conditional — now reliably populated after the N+1 fix), `isReady` (client-derived `status === 'ready_for_delivery'`, drives a highlighted row style + "Ready for delivery rider" note) | |
| Empty state | n/a | shown when not loading, no error, zero items |

## Mutations
None — this page is entirely read-only (a monitoring view; actions on an
order happen from its own detail page, out of scope here).

## Authorization
`GET /partner/orders/progress` is `@Roles(UserRole.PARTNER, UserRole.ADMIN)` — correctly excludes `STAFF`, matching the frontend's `useRequirePartner()` exactly (unlike the sibling Incoming-orders page, which does allow `STAFF`). No `[authz]` issues.

## Findings

1. **Unbounded query — no `.limit()` on a potentially large, unbounded result set.** `getProgressMonitor` (`partner-operations.service.ts:782-801`) fetches *every* order currently between `RECEIVED_AT_SHOP` and `READY_FOR_DELIVERY` for the caller's scope, with no cap — unlike `getIncomingOrders`'s `.limit(100)` or the dashboard's `.limit(8)`. A shop with a large, healthy order volume mid-processing at any given moment could return a correspondingly large list, all transferred to the client and rendered in a single unpaginated column with no virtualization.
   Left unfixed: adding a limit or pagination here is a product/UX decision (unlike Incoming, where capping at "the 100 most recent" is a reasonable proxy for "what needs my attention right now," an in-progress list arguably needs to show *everything* currently in the pipeline for accurate monitoring — silently capping it could hide legitimate orders from the shop). Flagging as a real, concrete scalability concern rather than guessing at the right cap or pagination UX.

No other issues found — role scoping matches on both sides, and this page
was one of the two direct beneficiaries of the N+1 fix already applied in
`docs/audits/partner-web/dashboard.md` (confirmed `assignedStaffEmail` is
now reliably populated via a single batched query instead of one query per
order).

## Unused/dead fields
None — every field this page reads from `PartnerOrderSummary` is genuinely
returned and used.

## Loading/error/realtime behavior
Uses the shared `usePartnerQuery` hook (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md` — this page benefits from that fix
too). Realtime pipeline updates trigger a full reload via the same
`usePartnerPipelineSocket` hook already verified correct in
`orders-queue.md`.
