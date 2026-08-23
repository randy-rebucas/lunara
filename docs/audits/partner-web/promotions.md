# Audit: Partner-web — Promotions

Date: 2026-08-23

## Entry point
- Page: `apps/partner-web/src/app/promotions/page.tsx` (`'use client'`, single self-contained component — no separate promotions component file)
- Component(s): `AuthLoading`, `DataPageStatus`, `PageHeader` (shared UI), plus inline form/list markup

## Pre-existing partial edit (resolved)
A prior interrupted edit had left the JSX broken: the `{canManageOwn && (` conditional
opened at `page.tsx:164` (wrapping the "Your promo codes" section) was never closed —
the section's `</section>` at line 279 was followed directly by the platform-wide
`<section>` with no `)}` in between. This nested the unconditional "Platform-wide
promotions" section inside the `canManageOwn` conditional and would have failed to
compile (or, depending on JSX parsing, silently hidden the platform section from
STAFF/ADMIN users). Fixed by inserting the missing `)}` after line 279, restoring the
two sections to siblings as originally intended (own promos gated on
`canManageOwn`, platform promos always shown). Verified no other unclosed
conditionals/duplicate blocks/unreachable code elsewhere in the file.

## Sub-pages
None — no outbound navigation (`Link`/`router.push`/`<a href=`) into a detail route. The page is a single flat list-plus-form view.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Platform promotions | GET | `/partner/promotions` | `PartnerPromotion[]` | `PartnerController.getActivePromotions` -> `PromotionsService.listActivePromotionsForPartner` |
| Own promotions | GET | `/partner/promotions/mine` | `OwnPromotion[]` | `PartnerController.listOwnPromotions` -> `PromotionsService.listPromotionsForPartnerOwner` |
| Create promotion | POST | `/partner/promotions` | body `CreatePartnerPromotionDto`-shaped | `PartnerController.createOwnPromotion` -> `PromotionsService.createPartnerPromotion` |
| Toggle active | PATCH | `/partner/promotions/:id/active` | body `{ isActive: boolean }` | `PartnerController.setOwnPromotionActive` -> `PromotionsService.setPartnerPromotionActive` |

`partnerFetch` (`apps/partner-web/src/lib/partner-api.ts:83`) unwraps `body.data`, matching the `{ success, data }` envelope every service method returns.

## Backend trace
`listActivePromotionsForPartner` (`promotions.service.ts:424`) queries `Promotion` for `kind: STANDARD, isActive: true` within the start/end window, then re-filters with `isPromotionActive` and maps through `serializeDealFromPromotion`. No partner/branch scoping — intentionally platform-wide, read-only.

`listPromotionsForPartnerOwner` (`promotions.service.ts:466`) queries `Promotion.find({ partnerUserId })`, any approval status, serialized via `serializePartnerPromotion`. Correctly scoped to the calling partner's own `req.user.sub`, no request param can widen it.

`createPartnerPromotion` (`promotions.service.ts:476`) validates discount caps server-side (`MAX_PARTNER_PERCENT_DISCOUNT = 50`, `MAX_PARTNER_FIXED_DISCOUNT = 300`, matching the frontend's `MAX_PERCENT_DISCOUNT`/`MAX_FIXED_DISCOUNT` constants at `page.tsx:33-34` — duplicated but consistent), forces `fundedBy: 'partner'`, `approvalStatus: 'pending'`, `partnerUserId` from the authenticated user (not client-supplied). Handles duplicate-code conflicts (Mongo 11000) with a 409.

`setPartnerPromotionActive` (`promotions.service.ts:518`) loads the promo by id, checks `promo.partnerUserId.toString() === partnerUserId` before allowing the toggle — correctly scoped, no widening possible via the `:id` param (ownership is re-verified server-side regardless of what id is passed).

No obvious N+1s or unindexed queries — all four calls are single-document/simple-filter Mongo operations.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| New promo code form (`canManageOwn` only) | `code`, `title`, `discountType`, `discountValue`, `minOrderAmount`, `maxUsesPerCustomer`, `startsAt`, `endsAt`, `description` (all local form state) | `discountCap` (50/300) is a client-side hardcoded mirror of the backend's `MAX_PARTNER_PERCENT_DISCOUNT`/`MAX_PARTNER_FIXED_DISCOUNT` — must be kept in sync manually; backend re-validates so no real bypass risk, just a maintenance footgun. |
| Own promo code card (per item) | `title`, `description`, `approvalStatus`, `isActive`, `discountType`+`discountValue` (via `formatDiscount`), `code`, `startsAt`/`endsAt` (via `formatDateRange`), `minOrderAmount`, `adminNote` | `approvalBadge()` derives a status pill client-side from `approvalStatus`/`isActive` — a hardcoded color map (`amber`/`red`/`primary`/`slate`) that must stay in sync with the backend's `approvalStatus` enum values. Turn on/off button hidden once `approvalStatus === 'rejected'`. |
| Platform promo card (per item) | `title`, `description`, `discountType`+`discountValue`, `code`, `startsAt`/`endsAt`, `minOrderAmount` | Read-only, no actions. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Create promo code | no (starts pending, reviewable) | n/a | yes — `disabled={saving}` on submit button | yes — `formError` rendered in an `alert-error` inside the form |
| Toggle active on/off | no (reversible, no re-review needed) | n/a | yes — `disabled={togglingId === promo._id}` on the button | **was no** — `toggleError` was set but never rendered anywhere in JSX; fixed (see Findings #1) |

## Authorization
`/partner/promotions` (list platform-wide) is guarded `@Roles(PARTNER, STAFF, ADMIN)` and matches the frontend, which fetches it for all three roles unconditionally. `/partner/promotions/mine`, the POST, and the PATCH are all guarded `@Roles(PARTNER)` only — the frontend correctly gates the entire "Your promo codes" section (form + own-promo fetch + toggle) behind `canManageOwn = user?.role === UserRole.PARTNER`, so STAFF/ADMIN never see UI for actions they'd get a 403 on. Role-scoped filters (`listPromotionsForPartnerOwner`, `setPartnerPromotionActive`) both key off `req.user.sub` server-side, not any client-supplied id — a partner cannot pass another partner's id to read or toggle someone else's promotions. No `[authz]` issues found.

## Findings
1. **Failure visibility gap on toggle mutation (now fixed):** `toggleError` was set on a failed PATCH (`page.tsx:147`, pre-fix) but never rendered — a user clicking "Turn on/off" and hitting a failure (e.g. network blip, stale `_id`) would see the button return to its normal label with zero feedback, looking like a silent no-op.
   **Fix:** Added `{toggleError && <div className="alert-error mt-3" role="alert">{toggleError}</div>}` right below the section's intro paragraph at `page.tsx:176`, matching the existing `formError` alert convention used in the create form. Verified with `tsc --noEmit` — no new errors.

2. **Interrupted edit left the JSX conditional unclosed (now fixed):** see "Pre-existing partial edit" section above for full detail. `page.tsx:164-280`.
   **Fix:** inserted the missing `)}` after the "Your promo codes" section's closing `</section>` at line 279-280.

3. Dead fields fetched via `/partner/promotions` but not in the frontend's `PartnerPromotion` type or rendered: `expiresAt`, `isPersonal`, `audience` (see Unused/dead fields below). Not sensitive, low priority.
   **Fix:** left unfixed — trimming the backend's `serializeDealFromPromotion` shape is shared with `listDealsForCustomer` (customer-web deals feed), which does need `isPersonal`/`audience`; narrowing it partner-side would mean forking the serializer for one extra field per response, not worth it for three harmless extra fields. Out of scope / not a real problem.

4. Client-side discount caps (`MAX_PERCENT_DISCOUNT = 50`, `MAX_FIXED_DISCOUNT = 300` at `page.tsx:33-34`) duplicate the backend's `MAX_PARTNER_PERCENT_DISCOUNT`/`MAX_PARTNER_FIXED_DISCOUNT` (`promotions.service.ts:41-42`) with no shared constant — currently in sync, but a future change to one without the other would silently create a UI/backend mismatch (form would allow entering a value the backend then rejects, or vice versa cap the input tighter than necessary).
   **Fix:** left unfixed — would require introducing a shared constants module consumed by both an API service and a Next.js app (a `@lunara/utils`/`@lunara/types`-style package addition), which is a larger structural change than this audit's scope; flagging for a follow-up.

## Unused/dead fields
- `expiresAt`, `isPersonal`, `audience` — returned by `serializeDealFromPromotion` for `/partner/promotions` but absent from the frontend's `PartnerPromotion` interface and never read by the component. Not sensitive (no PII/auth material), just unused payload weight (see Finding #3).

## Loading/error/realtime behavior
Both fetches use the shared `usePartnerQuery` hook (`apps/partner-web/src/lib/use-partner-query.ts`), which preserves previously-loaded `data` on a failed reload (only clears loading state and sets `error`) — a failed refresh does not wipe prior data. Loading/error/empty states are rendered per-section via the shared `DataPageStatus` component, consistent with other partner-web pages. No sockets or polling on this page — refreshes only happen explicitly after `createPromotion`/`toggleActive` via `reloadOwn()`.
