# Audit: Admin-web — Promotions

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/promotions/page.tsx` -> `PromotionsBoard` (`apps/admin-web/src/components/datacenter/promotions-board.tsx`)

## Sub-pages
None — no outbound navigation into a detail route. "View orders" links to
`/orders?search=<code>` (`promotions-board.tsx:620`), a query-param deep link
into the already-audited Orders module, not a per-record detail page of this
module.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Promotion list (with real usage stats) | GET | `/admin/promotions` | `Promotion[]` | `AdminController.getPromotions` -> `AdminService.getPromotions` |
| Create promotion | POST | `/admin/promotions` | — | `AdminController.createPromotion` -> `AdminService.createPromotion` |
| Toggle active | PATCH | `/admin/promotions/:id` | — | `AdminController.updatePromotion` -> `AdminService.updatePromotion` |

No delete endpoint exists, matching the frontend (no delete button anywhere —
deactivating is the only way to retire a code, consistent with keeping
historical redemption stats attached to a real record instead of removing it).

## Backend trace
`getPromotions()` seeds nothing destructive, lists every promotion, then
aggregates real redemption stats per code from the `orders` collection
(`$match: { couponCode: { $in: codes }, status: { $nin: CANCELLED } }`, grouped
by code for `redemptions`/`discountGiven`/`revenueImpact`) — these are real
usage numbers, not estimates. `createPromotion`/`updatePromotion` are simple
document writes; `Promotion.code` is `unique: true` at the schema level (see
Finding 1, now fixed). The full discount-value input (`discountValue`, no
upper bound in the DTO) is safely clamped at the point it actually matters —
`computePromotionDiscountAmount()` in `@lunara/utils` clamps a `percent` type
to `Math.min(100, Math.max(0, discountValue))` and always caps the final
discount to never exceed the order subtotal/delivery fee — so an admin
entering an unreasonable value (e.g. 500%) can't cause a negative-total order;
it would just display a misleading "500% off" label in this admin list, a
display nit rather than a financial risk, not fixed here.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| State banner | Client-derived `derivePromoState()` — nominal if any promo is active and not expired | Straightforward. |
| Stat tiles (6) | `promos.length`, client `activeCount`/`inactiveCount` (accounting for expiry via `isPromoExpired`), `totalRedemptions`/`totalDiscountGiven`/`totalRevenueImpact` (client-summed across the full, uncapped list) | The full promotion list is fetched in one call with no server cap (unlike Refunds/Withdrawals) — dataset is inherently small (marketing codes, not per-order records), so client-side summing here is accurate and not the capped-window bug found on those two boards. |
| Status tabs (3) | Tab counts | Derived from the same full, uncapped `promos` array as the stat tiles — no discrepancy risk, correctly proportioned to this page's small dataset. |
| Create promotion form | `code`, `title`, `discountType`, `discountValue`, `minOrderAmount`, `audience`, `kind`, `maxUsesPerCustomer`, `newCustomerWithinDays`, `startsAt`/`endsAt` | Client input bounds (`min={0}`/`min={1}`) match the DTO's `@Min` validators field-for-field. |
| Promo catalog table | `code`, `title`, discount label (via `formatDiscount`), `redemptions` (+ `ShareBar` vs `maxRedemptions`), `discountGiven`, status (`expired`/`isActive`) | Full use. |
| Right rail — promotion detail | `description`, `discountType`+`discountValue` (via `formatDiscount`), `minOrderAmount`, `audience` (via `formatAudience`), `maxUsesPerCustomer` (via `formatUsesPerCustomer`), `startsAt`/`endsAt` (via `formatValidity`), `redemptions`/`discountGiven`/`revenueImpact` | Full use — every field on `Promotion` is read somewhere on this page. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Create promotion | no | n/a | yes, `disabled={saving}` | yes |
| Toggle active/inactive | no (deactivating only stops *new* redemptions; doesn't affect orders already placed) | n/a — not destructive enough to need one | **fixed** — was missing, see Finding 2 | yes |

## Authorization
`AdminController` is class-level `@Roles(UserRole.ADMIN)` — matches the
frontend (admin-only page). No role-scoped filter to widen (platform-wide
promotion catalog by design) — no `[authz]` findings. No PII involved.

## Findings

1. **Duplicate promotion code would surface as an unhandled error.**
   `Promotion.code` is `unique: true` at the schema level
   (`promotion.schema.ts:9`), but `createPromotion` (pre-fix,
   `admin.service.ts`) called `this.promotionModel.create(...)` with no
   handling for the resulting Mongo E11000 duplicate-key error — an admin
   creating a code that already exists (case-insensitively, since both the
   schema and the frontend uppercase it) would get an opaque failure instead of
   a clear "that code already exists" message. Same class of finding already
   fixed twice this session (`PartnersService.updateBrandConfig`'s duplicate
   domain, `LaundryTagsService.generateBatch`'s duplicate code retry loop).
   **Fix:** wrapped `promotionModel.create()` in a try/catch that rethrows
   E11000 as a `ConflictException` naming the offending code
   (`admin.service.ts`, `createPromotion`).

2. **Toggle active/inactive had no double-submit guard.** The "Deactivate"/"Activate"
   button (`promotions-board.tsx:615-622`, pre-fix) had no `disabled` state tied
   to the in-flight request — a fast double-click could send two overlapping
   `PATCH` toggle requests, and since each is a plain flip of `isActive` (not an
   atomic "set to X" with a precondition), two overlapping toggles could leave
   the promotion in whichever state the slower response happened to land on,
   silently contradicting what the admin intended (e.g. meaning to deactivate
   once, but a double-click flips it twice back to active).
   **Fix:** added a `togglingId` state set for the duration of the request,
   disabling the button (and showing "Saving…") while that specific promotion's
   toggle is in flight (`promotions-board.tsx`).

## Unused/dead fields
None — every field on `Promotion` is read and rendered somewhere on the page.

## Loading/error/realtime behavior
Standard `useAdminQuery` behavior (spinner while `null`, failed reload keeps
prior data, `alert-error` on failure) — same pattern as every other audited
admin-web board. No realtime socket subscription or polling; reasonable for a
low-frequency marketing-config page with no other actor pushing changes.
