# Audit: Admin-web — Partner settlements

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/partners/settlements/page.tsx` (`PartnerSettlementsPage`)
- Component(s): `CreateSettlementModal` (same file, inline — not a route)

## Sub-pages
None — no outbound navigation into a detail route. The "Create settlement" flow
is an in-page modal (`CreateSettlementModal`), not a navigated sub-page.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Partner list (sidebar) | GET | `/admin/shops` | `{ shops: PartnerRow[] }` | `AdminController.getShops` -> `AdminService.getShops` |
| Settlement history for selected partner | GET | `/admin/partners/:partnerId/settlements` | `PartnerSettlement[]` | `AdminController.getPartnerSettlements` -> `PartnerOperationsService.getPartnerSettlementsForAdmin` |
| Unsettled orders (modal) | GET | `/admin/partners/:partnerId/unsettled-orders` | `UnsettledOrder[]` | `AdminController.getUnsettledOrders` -> `PartnerOperationsService.getUnsettledOrders` |
| Create settlement | POST | `/admin/partners/:partnerId/settlements` | — | `AdminController.createPartnerSettlement` -> `PartnerOperationsService.createSettlement` |

Note: `:partnerId` here is the shop `User._id` (same id space as `/admin/shops`,
audited in `partners.md`) — a different collection from the white-label `Partner`
brand entity audited in `partner-branding.md`, which also happens to live under
the `/admin/partners` prefix on a different controller
(`PartnersAdminController`). No route collision (different literal suffixes:
`/settlements`, `/unsettled-orders` vs `/branding`, `/active`), just worth noting
for anyone who greps `admin/partners` expecting one meaning.

## Backend trace
`getUnsettledOrders` finds all branches owned by the partner, then all
`COMPLETED_STATUSES` orders on those branches with no `settlementId` yet, joins
in each order's latest payment, and computes `lunaraFee`/`partnerPayout` per
order via `computeOrderFee` (branch-specific commission rate for legacy pricing,
or the order's own baked-in markup for `shop_markup` orders). `createSettlement`
is well-guarded: it first atomically claims the selected orders via
`updateMany` re-asserting `settlementId: { $exists: false }` in the filter
(explicitly commented as closing a double-claim race two concurrent admin
settlement calls could otherwise hit), computes totals from the orders that
were actually claimed (not blindly trusting the request), rolls the claim back
via `$unset` if settlement creation itself throws, and posts a 3-line
double-entry ledger transaction (`order_revenue_clearing` debit,
`cash_out`/`platform_revenue` credit) via `LedgerService.post`. Settlements
created through this admin flow are always stored as `status: 'paid'` with
`paidAt` set immediately — consistent with the page's own description ("Create
settlement records after remitting cash to a partner"); a `'pending'` status
exists in the type/schema but is populated by some other, unaudited creation
path.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Partner sidebar list | `_id`, `email`, `branchNames` (via `branchLabel`) | Reuses the same `/admin/shops` endpoint audited in `partners.md`, but this page only needs `_id`/`email`/`phone`/`branchNames` — `getShops()` still runs its full set of order/rating aggregates to serve this lightweight sidebar. Lower priority than the branches N+1 case fixed earlier (this is a handful of aggregate queries once per page load, not N+1 per row, and partner counts are typically small) — noted, not fixed, since there's no existing lightweight "partner list" endpoint to swap to the way `/admin/branches/parents` existed for the branches case; adding one would be a new endpoint, not a one-line reuse. |
| Settlement history table | `periodStart`/`periodEnd` (via `formatDateRange`), `totalOrders`+`cashOrders`+`digitalOrders`, `status`, `paidAt`, `totalAmount`, `lunaraFee`+`commissionRate`, `partnerPayout` | Table footer re-sums `totalOrders`/`totalAmount`/`lunaraFee`/`partnerPayout` client-side across all loaded settlements — fine, this list isn't paginated so the client total matches the server total exactly. |
| Admin-note callout | `adminNote` (filtered to settlements that have one) | Straightforward. |
| `CreateSettlementModal` > select step | `orderId`, `completedAt`, `bookingType`, `paymentMethod`, `amount`, `partnerPayout`, running `totalGross`/`totalFee`/`totalPayout` derived client-side from `selected` | All orders are pre-selected by default when the modal opens (`orders -> setSelected(all)`) — an admin who doesn't deselect anything before clicking through settles every unsettled order in one batch; this is a product/UX default choice, not flagged as a bug (no evidence period-grouping was intended given `periodStart`/`periodEnd` are just derived from whichever orders end up selected). |
| `CreateSettlementModal` > confirm step | `selectedOrders.length`, `totalGross`/`totalFee`/`totalPayout`, `commissionRate` (shows "(mixed rates)" if selected orders don't share one rate) | This review screen is the de facto confirmation step for the create action — see Mutations. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Create settlement (`handleConfirm`) | effectively irreversible — no delete/void/unsettle endpoint exists anywhere in the API, so once created an admin cannot undo it from the UI | yes, in effect — the 2-step select-then-review wizard shows the exact payout total before the final "Create settlement" click, which is a stronger confirmation than a plain `window.confirm` would be | yes, `disabled={saving}` | yes, `error` shown in the confirm step |

No changes needed — the review-step pattern already satisfies the checklist
better than most single-click mutations audited so far.

## Authorization
`AdminController` is class-level `@Roles(UserRole.ADMIN)` — matches the frontend
(admin-only page). None of these endpoints take a role-scoped filter an admin
could widen (admin sees all partners' settlements by design) — no `[authz]`
findings.

## Findings

1. **`CreateSettlementModal` reimplemented loading/error state instead of using the shared hook.**
   The unsettled-orders fetch (`page.tsx`, pre-fix) used a raw `useEffect` +
   `useState('orders'/'loadError')` + manual `.then/.catch`, instead of
   `useAdminQuery` — the same hook the parent page already uses twice on this
   exact page (`loadPartners`, `loadSettlements`), and the same class of finding
   already fixed once this session in `partner-branding.md`'s detail page. Third
   occurrence of this pattern found across recent audits.
   **Fix:** switched to `useAdminQuery(loadOrders, [partnerId])`
   (`page.tsx:58-62`), with a small separate `useEffect` to seed `selected` with
   every order once `orders` loads (`page.tsx:64-66`) since the hook itself
   doesn't expose an on-success callback. Regression-checked: this is a local
   component, no other consumer to check.

## Unused/dead fields
- `UnsettledOrder.subtotal` and `.cashCollected` are declared on the frontend
  type and returned by `getUnsettledOrders`, but never rendered in the modal's
  order table (only `amount`/`partnerPayout`/`bookingType`/`paymentMethod` are
  shown). `cashCollected` in particular looks like it could matter to an admin
  deciding whether a cash order is actually reconciled before bundling it into a
  settlement — whether to surface it is a product call, not fixed here.
- `pricingModel` and `cashTiming` are computed and returned by
  `getUnsettledOrders` (`partner-operations.service.ts:1131,1134`) but aren't
  even part of the frontend `UnsettledOrder` interface — dropped before the
  component could use them either way.
- `PartnerSettlement.paidBy` (who approved the settlement) is typed and returned
  but never rendered in the settlement history table — same "not surfaced,
  not clearly a bug" category as the above.

## Loading/error/realtime behavior
All three fetches on this page/modal now go through `useAdminQuery` uniformly
(partner list, settlement history, and — after this pass's fix — unsettled
orders), so all three share the same failed-reload-keeps-prior-data behavior.
No realtime socket subscription; settlement history refetches via
`reloadSettlements` only after a settlement is successfully created
(`onCreated={reloadSettlements}`, `page.tsx:424`), which is the correct scope —
no thrashing, no unrelated refetch triggers.
