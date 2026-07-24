# Audit: Customer-mobile — Refunds (list + detail)

Date: 2026-07-24

## Entry point
- Screen: `apps/customer-mobile/app/refunds/index.tsx`
- Component(s): `Card`, `DataLoadState`

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `refunds/[id].tsx` | refund row tap | `r._id` -> `id` route param | yes |

`refunds/[id].tsx` is a read-only detail/timeline view — no mutations, covered in full here rather than a separate doc. Actual refund *submission* happens on `orders/[id]/refund.tsx` (already audited in `docs/audits/customer-mobile/order-detail.md`) — this list only navigates into that flow indirectly via the order detail screen, it has no create affordance of its own.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List refund requests | GET | `/refunds` | `RefundRow[]` | already traced in `docs/audits/customer-web/refunds.md` |
| Refund detail | GET | `/refunds/:id` | `{ refund: RefundDetail }` | same |

## Backend trace
Same already-traced, correctly-scoped endpoints (`listCustomerRefunds`/`getCustomerRefund`, both filtered/verified by `customerId`). Nothing new server-side.

## Cards / panels

**List:**
| Card | Fields consumed | Notes |
|---|---|---|
| Refund row | `orderId` (truncated), `requestedAmount`, `status` (via `formatRefundStatus`, styled open/resolved by local `RESOLVED_STATUSES`) | **[FIXED]** — see Finding #1 |
| Empty state | none | |

**Detail:**
| Card | Fields consumed | Notes |
|---|---|---|
| Status pill | `status` | |
| Refund flow stepper | `REFUND_FLOW` (shared with web) + `stage`/`status` | |
| Request card | `reason`, `requestedAmount`, `approvedAmount`, `rejectionReason`, `processedAt` (-> "credited to your wallet") | |
| Timeline | `timeline[]` | |
| Footer actions | static links to `/orders/:orderId` and `/(tabs)/wallet` | |

## Mutations
None on either screen — both are read-only.

## Authorization
Same already-confirmed scoping. No `[authz]` issues.

## Findings

1. **[FIXED] The refund list's "resolved vs. open" status grouping omitted `rejected` entirely, so a denied refund displayed with the same "in-progress" visual styling (primary/blue pill) as one that's actually still pending or under review.** `RESOLVED_STATUSES = new Set(['processed', 'closed', 'approved'])` (pre-fix) didn't include `'rejected'` — confirmed against the real `RefundStatus` enum (`pending`/`under_review`/`verified`/`approved`/`rejected`/`processed`/`closed`) and against customer-web's equivalent `isOpenRefundStatus` helper (`lib/refunds.ts`), which correctly excludes `rejected`/`closed`/`processed` from "still open." A customer scanning their refund list would see a rejected request looking identical to an actively-progressing one, with no visual cue it had actually been denied (the real status text is still shown via `formatRefundStatus`, so it wasn't fully hidden — but the color-coded pill, the primary at-a-glance signal, was misleading).
   **Fix:** changed `RESOLVED_STATUSES` to `{'processed', 'closed', 'rejected'}` — dropping `approved` (which, per the backend's own semantics, is a decision made but payout not yet completed, so it's more accurately "still open" until `processed`) and adding `rejected`, aligning exactly with web's `isOpenRefundStatus` open/closed boundary.

## Unused/dead fields
None found.

## Loading/error/realtime behavior
List uses `DataLoadState` with retry + pull-to-refresh. Detail uses `DataLoadState` for its single load with retry. No polling or realtime subscription on either screen — a refund's status only updates on manual refresh or navigation, consistent with the equivalent web pages.
