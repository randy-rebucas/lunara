# Audit: Partner-web — Orders (incoming)

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/orders/incoming/page.tsx`
- Component(s): inline in the page file, no separate board component

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/receiving/page.tsx` | "Receive at shop" link, `page.tsx:130` (shown when `o.canReceiveAtShop`) | `o._id` -> `id` route param | yes |
| `orders/[id]/page.tsx` or `.../receiving` | row link / "Open →", via `partnerOrderHref(o)` | `o._id` -> `id` route param | yes |

Both targets are the same large, independent order-processing feature
already flagged as out-of-scope for a full trace in multiple prior audits
(`customers.md`, `messages.md`, `orders-queue.md`, `shelf-lookup.md`,
`dashboard.md`) — not re-traced here.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List incoming orders | GET | `/partner/orders/incoming` | `{ items: PartnerOrderSummary[] }` | `PartnerController.getIncoming` -> `PartnerOperationsService.getIncomingOrders` |
| Accept order | POST | `/partner/orders/:orderId/accept` | — | `PartnerController.acceptOrder` -> `PartnerOperationsService.acceptPartnerOrder` |
| Request delivery | POST | `/partner/orders/:orderId/request-delivery` | — | `PartnerController.requestDelivery` -> `PartnerOperationsService.requestDelivery` + `notifyDeliveryDispatch` |
| Realtime pipeline updates | socket (same `usePartnerPipelineSocket` hook verified correct in `orders-queue.md`) | — | triggers a full reload | `TrackingGateway` |

## Backend trace
`getIncomingOrders` filters to `INCOMING_STATUSES` + `dispatchStatus:
'dispatched'` + a non-null `branchId`, scoped by `order.partnerId` directly
for `PARTNER` (a per-order ownership tag set at dispatch time, not dependent
on a branch lookup — correctly covers a multi-branch partner's orders across
*all* their branches without needing `resolvePartnerBranches`), by
`resolvePortalBranchId`/`applyStaffBranchFilter` for `STAFF`, and unscoped
for `ADMIN`. `.limit(100)`, sorted by `createdAt: -1`. Items are summarized
via `summarizeIncomingBatch` — the same helper fixed for an N+1 (per-order
`assignedStaffId` lookup) in `docs/audits/partner-web/dashboard.md`; this
page is one of the two larger-scale callers that fix specifically targeted
(up to 100 items here vs. 8 on the dashboard), so it benefits directly. Each
role's `allowStaffToRequestDelivery` flag is read from *one* branch's
`portalSettings` — for `PARTNER`, via `branchModel.findOne({ partnerUserId
})` with no sort (the same single-arbitrary-branch pattern documented in
`docs/audits/partner-web/profile.md`/`settings.md`) — a multi-branch partner
whose branches have different values for this setting would get whichever
branch's value Mongo returns first, applied uniformly to every order in the
list regardless of which branch each order actually belongs to. Low-stakes
(only gates whether a `canRequestDelivery` capability flag is `true`, not a
security boundary — `STAFF` still can't act on data outside their own
branch either way), not re-documented as a new finding since it's the exact
already-tracked root cause, just noted here for completeness.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| "Needs attention" banner | client-derived `needsAction` (count where `canAccept \|\| canReceiveAtShop \|\| canRequestDelivery \|\| !partnerAcceptedAt`) | |
| Order row | `o.bookingType`, `.status`, `.branchName` (conditional), `.currentStepLabel`, `.receivingStepLabel`, `.slaLabel` (all conditional), `!o.partnerAcceptedAt` (partner-only "Awaiting shop acceptance" note), `.total` | |
| Accept order button | shown when `partner && o.canAccept` | |
| Receive at shop link | shown when `o.canReceiveAtShop` (any role, matches backend `STAFF` inclusion on `getReceiving`, traced in `SHELF.md`'s sibling receiving flow) | |
| Request delivery button | shown when `o.canRequestDelivery` (backend already folds `allowStaffRequestDelivery` into this flag server-side per `summarizeIncoming`, so the frontend doesn't need its own role check here) | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Accept order | no | n/a | yes, but coarse — `disabled={!!busy}` disables **every** action button on **every** row while any one action is in flight (`busy` is a single shared string, not keyed per-row) | yes (`error`) |
| Request delivery | no | n/a | same coarse shared-`busy` guard as above | yes (`error`) |

The shared `busy` guard is stricter than necessary (blocks unrelated rows during one action) but not incorrect — it prevents any double-submit, just at page granularity instead of row granularity. Not flagged as a bug, just noted as a minor UX tightness others might want to loosen.

## Authorization
`GET /partner/orders/incoming` is `@Roles(PARTNER, STAFF, ADMIN)`; `POST .../accept` is `@Roles(PARTNER, ADMIN)` (matches the frontend's `partner &&` gate on the Accept button — `STAFF` never sees it); `POST .../request-delivery` is `@Roles(PARTNER, STAFF, ADMIN)` (matches the frontend showing that button to any role, with the capability itself pre-filtered server-side via `canRequestDelivery`). All three match `useProtectedPage({ roles: [PARTNER, ADMIN, STAFF] })`. No `[authz]` issues.

## Findings

1. **A fully-built "Request pickup" backend capability has no frontend consumer anywhere in partner-web.** `summarizeIncoming` computes and returns `canRequestPickup` (`partner-operations.service.ts:1470-1473`: true when accepted, no rider assigned yet, and status is `SHOP_ASSIGNED`/`CONFIRMED`) as part of `PartnerOrderSummary`, and a corresponding `POST /partner/orders/:orderId/request-pickup` route exists and is wired to a real service method (`partner.controller.ts:433-442`) — but grepping the entire `apps/partner-web/src` tree for `canRequestPickup` finds zero matches. No page renders a "Request pickup" button, unlike the parallel `canRequestDelivery` flag which this exact page does act on. Either this was a feature that shipped on the backend but never got its frontend button, or pickup requests are intentionally rider/dispatch-initiated only and this flag/route are vestigial.
   Left unfixed: adding a UI action for this is a feature decision (is partner-initiated pickup-request still wanted, and if so, on which page — this one, alongside Request delivery?), not a bug fix — flagging clearly rather than guessing at intent by adding a button unprompted.

No other issues found — role scoping is correctly enforced server-side (order-level `partnerId` tag for `PARTNER`, branch-resolved for `STAFF`), and every field this page reads from `PartnerOrderSummary` is genuinely returned by the backend.

## Unused/dead fields
`canRequestPickup` — see Finding #1, the more complete version of this
observation (it's not just unused on this page, it's unused everywhere).

## Loading/error/realtime behavior
This page manages `items`/`error` with local `useState` + a manual `load()`
in a `useEffect`, rather than `usePartnerQuery` — and unlike that shared
hook (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md`), this page's own `load()` doesn't
wipe `items` on failure either, since it only calls `setItems` on the
success path (`page.tsx:23-26`) and lets the `.catch()` at the call site set
`error` separately (`page.tsx:30,40`) — so a failed reload here already
correctly preserves the last-loaded list, same protective behavior as the
now-fixed shared hook, just arrived at independently. Realtime pipeline
updates trigger a full reload on any `partnerPipelineUpdated`/
`branchPipelineUpdated` event for the branches represented in the current
list, using the same hook already verified correct in `orders-queue.md`.
