# Audit: Admin-web — Partner invoices

Date: 2026-09-01

## Entry point
- Page: `apps/admin-web/src/app/partners/invoices/page.tsx`
- Component(s): inline `CreateInvoiceModal`, `MarkPaidModal` (same file)
- Related: `apps/admin-web/src/app/partners/subscriptions/page.tsx` (subscription/promo state that determines `subscriptionFeeDue` on each invoice)

## Sub-pages
None — no outbound navigation into a detail route. The invoices page and the subscriptions page are siblings under the same "Finance" nav section, not parent/child, but subscriptions state directly drives what an invoice bills, so it's covered here.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load partners | GET | `/admin/shops` | `{ shops: PartnerRow[] }` | `AdminController` (shops list) |
| Load invoices for partner | GET | `/admin/partners/:id/invoices` | `PartnerInvoice[]` | `PartnerOperationsService` (invoice list) |
| Load uninvoiced orders | GET | `/admin/partners/:id/uninvoiced-orders` | `UninvoicedOrder[]` | `PartnerOperationsService.getUninvoicedOrders` |
| Load credit balance | GET | `/admin/partners/:id/credit-balance` | `{ outstanding: number }` | `PartnerOperationsService` |
| Create invoice | POST | `/admin/partners/:id/invoices` | — | `PartnerOperationsService.createInvoice` (`partner-operations.service.ts:1896-2203`) |
| Mark paid | POST | `/admin/invoices/:id/mark-paid` | — | `PartnerOperationsService.markInvoicePaid` (`:2207-2260`) |
| Download PDF | GET | `/admin/invoices/:id/pdf` | blob | `PartnerInvoicePdfService.build` |
| List subscriptions | GET | `/admin/billing/subscriptions` | `SubscriptionRow[]` | `SubscriptionService.list()` |
| Apply/remove promo (new) | POST/DELETE | `/admin/billing/subscriptions/:partnerId/promotion` | — | `BillingPromotionService.redeem` / `.remove` |

## Backend trace
`createInvoice` computes `subscriptionFeeDue` via `computeDueSubscriptionFee` (`partner-operations.service.ts:359-362`), which returns `0` unless the subscription's billing cycle is actually due (`isCycleDue`). When due, `applyPromotionDiscount` (`:364-375`) zeroes the fee if `promotionDiscountType === 'free_months'` and `promotionFreeMonthsRemaining > 0`. After the invoice document is created, `SubscriptionService.advancePeriod` (`subscription.service.ts:104-127`) advances the billing period by one month and — only then — decrements `promotionFreeMonthsRemaining`, clearing the promo fields once it hits 0. `commissionDue`/`riderCostDue` (the per-order commission) are computed independently from `completedOrders` and are **not** affected by the promo — the founding-partner privilege only discounts the platform subscription fee, not order commission.

A promo is granted per-partner via `BillingPromotionService.redeem` (`billing-promotion.service.ts:40-71`), reachable at `POST /admin/billing/subscriptions/:partnerId/promotion`. It is a manual, code-based redemption (a partner self-redeems from their billing settings, or previously required a raw API call — see Findings) — no automatic "founding partner" flag exists on the partner/user model.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Partner list | `p.branchNames`, `p.email`, `p._id` | client-derived label via `branchLabel()` |
| Invoice table row | `invoiceNumber`, `periodStart/End`, `totalOrders`, `cashOrders`/`digitalOrders`, `status`, `emailError`/`emailedAt`, `dueDate`, `totalCollected`, `commissionDue`+`commissionRate`, `riderCostDue`, `subscriptionFeeDue`, `amountDue`, `creditApplied`/`creditTotal`/`creditRecovered`/`creditOrderCount` | status badge is a 3-way client map (`paid`/`void`/else "Pending") that must stay in sync with backend `PartnerInvoice.status` enum |
| Invoice table footer | sums of `totalOrders`, `totalCollected`, `commissionDue`, `riderCostDue`, `subscriptionFeeDue`, `amountDue` | client-side reduce over the currently loaded page (no pagination on this endpoint) |
| CreateInvoiceModal — order picker | `orders[].completedAt/orderId/bookingType/paymentMethod/amount/commissionDue` | — |
| CreateInvoiceModal — confirm step | `selectedOrders` totals, `outstandingCredit` | commission-rate label shows "(mixed rates)" when selected orders span >1 rate |
| Subscriptions table (sibling page) | `promotionCode`, `promotionFreeMonthsRemaining` (added by this audit) | previously fetched by the backend aggregate but not rendered anywhere in admin-web |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Create invoice | no (claims orders, but reversible via admin edit path) | two-step wizard (select → confirm) acts as soft confirmation | yes — `saving` disables the button | yes — `alert-error` in modal |
| Mark paid | yes-ish (books ledger entries, reactivates subscription) | no explicit confirm dialog, but requires opening a modal and clicking through | yes — `saving` disables button | yes |
| Download PDF | no | n/a | yes — `downloadingId` disables the specific row's button | yes — `downloadError` banner |
| Apply promo (new) | no | plain form submit, no confirm — low risk (idempotent, reversible via Remove) | yes — `saving` disables buttons | yes |
| Remove promo (new) | yes for the partner (kills their free-month discount immediately) | no explicit confirm | yes | yes |

## Authorization
No role-scoped access issue found: all these routes sit under admin-only controllers (`AdminController`, `BillingAdminController` — `@Roles(UserRole.ADMIN)` at `billing-admin.controller.ts:20`). No partner-supplied ID can widen scope since `partnerId` comes from the admin-selected row, not user input reflected back into a filter.

## Findings

1. **No admin-web UI existed to grant a founding partner their free-usage promo, despite the promo-codes page explicitly claiming that capability.** `apps/admin-web/src/app/partners/promo-codes/page.tsx:218-220` states "Partners redeem these themselves from their billing settings, **or you can apply one directly to a partner's subscription**" — but no admin-web page called `POST /admin/billing/subscriptions/:partnerId/promotion` or its `DELETE` counterpart (confirmed via repo-wide grep for `redeem`). The endpoint has existed and worked correctly all along (`billing-admin.controller.ts:89-97`, `billing-promotion.service.ts:40-71`); only the UI was missing. Impact: the only way to enroll a founding partner in their free year was either the partner self-redeeming a code from partner-web (dependent on the partner actually doing it) or an admin hand-crafting a raw API call — a real risk that a founding partner is never actually granted the free year the business promised.
   **Fix:** added an "Apply promo" action + `ApplyPromoModal` to `apps/admin-web/src/app/partners/subscriptions/page.tsx` (POST to apply, DELETE to remove), plus a new "Promo" column showing the active code and remaining free months. Typechecked clean.

2. **Admin had no visibility into which partners are on a founding-partner promo or how many free months remain**, since `SubscriptionRow` (`partners/subscriptions/page.tsx`) omitted `promotionCode`/`promotionFreeMonthsRemaining` even though `SubscriptionService.list()` (`subscription.service.ts:31-61`) already returns those fields (the aggregate only excludes the joined `partner`/`plan` objects, not native subscription fields). Impact: no way to audit at a glance whether a founding partner's free year is still active, already expired, or was never applied — directly relevant to honoring the 1-year privilege correctly.
   **Fix:** same change as #1 — added the `promotionCode`/`promotionFreeMonthsRemaining` fields to the frontend type and rendered them as a "Promo" column.

3. **The founding-partner privilege only discounts the subscription fee, not order commission** — `computeDueSubscriptionFee`/`applyPromotionDiscount` (`partner-operations.service.ts:359-375`) only ever touch `subscriptionFeeDue`; `commissionDue`/`riderCostDue` are computed independently per order and always charged in full regardless of an active `free_months` promo. If "1 year of free usage" is meant to include commission-free order processing (not just the platform subscription fee), invoices are currently still charging founding partners commission during their free year.
   **Fix:** confirmed with product (2026-09-01) — the founding-partner privilege is subscription-fee-only by design; commission is always charged. No code change needed.

4. No orphaned enforcement gap in the decrement logic itself: `advancePeriod` is called from exactly two mutually-exclusive paths (`createInvoice` when a subscription cycle is actually billed, and `recordSubscriptionPayment` for out-of-cycle manual payments — `partner-operations.service.ts:2069`, `:2281`), so a founding partner's free months cannot be double-decremented by both flows for the same cycle. No fix needed.

## Unused/dead fields
None found beyond what's now fixed in Findings #1/#2 — `promotionCode`/`promotionFreeMonthsRemaining` were returned by the backend but unused anywhere in admin-web prior to this audit's fix.

## Loading/error/realtime behavior
Both `partners/invoices/page.tsx` and `partners/subscriptions/page.tsx` use the shared `useAdminQuery` hook (`apps/admin-web/src/lib/use-admin-query.ts`) for loading/error state — standard pattern shared with most other admin-web boards, no page-specific deviation. No realtime/socket/poll triggers on either page; invoices/subscriptions reload only on explicit user action (`reload()` after a mutation).
