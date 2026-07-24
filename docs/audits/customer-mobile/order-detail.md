# Audit: Customer-mobile — Order detail (+ lost-item, refund)

Date: 2026-07-24

## Entry point
- Screen: `apps/customer-mobile/app/orders/[id]/index.tsx` (893 lines — deep feature, audited fully)
- Component(s): `OrderTimeline`, `HandoffQrCard`, `Card`, `Button`, `Input`, `DataLoadState`, `useOrderTrackingSocket`

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/lost-item.tsx` | "Report missing item" (terminal-completed card) / lost-item pill (delivered/completed, non-terminal) | `id` -> `orderId` in POST body | yes |
| `orders/[id]/refund.tsx` | "Request refund" (terminal-completed card only) | `id` -> `orderId` in GET query and POST body | yes |
| `/review/:id` | "View your published review" | `id` -> route param | not re-traced (separate module) |
| `/support/:id` | lost-item submission redirect | ticket id from response | not re-traced |
| `/refunds/:id` | refund submission redirect | refund id from response | not re-traced |

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Order detail | GET | `/orders/:id` | `OrderDetail` | already traced in `docs/audits/customer-web/orders.md` |
| Delivery UI state (conditional) | GET | `/orders/:id/delivery` | `DeliveryUiState` | same |
| Review status | GET | `/reviews/orders/:id` | `{ canReview, review }` | same |
| Account name (for "tap to sign") | GET | `/customers/me` | `{ firstName, lastName }` | already traced |
| Verify delivery | POST | `/orders/:id/delivery/verify` | — | `DeliveryService.customerVerify` |
| Sign delivery | POST | `/orders/:id/delivery/sign` | — | `DeliveryService.customerSign` |
| Submit review | POST | `/reviews` | — | already traced |
| Realtime tracking | Socket.IO `/tracking` (`useOrderTrackingSocket`) | `joinCustomer`, `joinOrder`, `orderStatusUpdate`, `orderEvent`, `locationUpdate` | `TrackingGateway` — already confirmed to verify order ownership before allowing `joinOrder` |
| Report lost item | POST | `/support/lost-items` | `{ _id }` | already traced |
| Request refund (load context) | GET | `/payments/orders/:id` | payment method/cash-timing check | already traced |
| Request refund (submit) | POST | `/refunds` | `{ _id }` | already traced, including the server-side cash-ineligibility guard relevant to Finding #2 |

## Backend trace
All endpoints are the same ones already fully traced for customer-web's order detail (`docs/audits/customer-web/orders.md`) and the refund/support flows (`docs/audits/customer-web/refunds.md`, `docs/audits/customer-web/support.md`) — server-side ownership/eligibility checks confirmed there apply identically here since it's the same API. `useOrderTrackingSocket` mirrors the web socket hook's `joinOrder` call, which the gateway verifies against the order's actual `customerId` before allowing the room join.

## Cards / panels
Same overall structure as `docs/audits/customer-web/orders.md`'s detail page — hero status card, payment-required/pending-dispatch banners, collapsible payment/branch cards, rider location, pickup/delivery QR handoff cards, delivery verify/sign actions, receipts, terminal "All done" card with review/lost-item/refund actions, and a full timeline. Notable mobile-specific details:
- Payment and branch cards are collapsible (`paymentExpanded`/`branchExpanded`) — a mobile-appropriate density choice not present on web.
- The review flow is a bottom-sheet `Modal` here rather than a separate route (web has `/orders/:id/review` as its own page) — a reasonable platform-appropriate difference, not a gap, since both ultimately hit the same `POST /reviews`.
- "Tap to sign as {accountName}" is a mobile-only convenience shortcut alongside the standard signature-name input.

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Verify delivery | no | n/a | **[FIXED]** now yes (`verifying`) — previously none, matching the same gap already found and fixed on customer-web (`docs/audits/customer-web/orders.md`, Finding #1) | yes (`deliveryError`) |
| Sign delivery (button or "tap to sign as X") | no | n/a | **[FIXED]** now yes (`signing`), covering both entry points into `handleSign` | yes (`deliveryError`) |
| Submit review | no | n/a | yes (`disabled={reviewSubmitting \|\| reviewRating < 1}`) | yes (`reviewError`) |
| Report lost item | no | n/a | yes (`disabled={submitting}`) | yes (`error`) |
| Request refund | no | n/a | yes (`disabled={submitting}`), **[FIXED]** now also pre-gated on payment eligibility — see Finding #2 | yes (`error`) |

## Authorization
Same already-confirmed scoping across every endpoint (order, delivery, reviews, support, refunds all verify `req.user.sub` ownership server-side); the tracking socket's `joinOrder` handler independently verifies order ownership too. No `[authz]` issues.

## Findings

1. **[FIXED] "Verify" and "Sign" (both entry points) had no busy/disabled state**, the identical gap already found and fixed on customer-web's order detail page (`docs/audits/customer-web/orders.md`, Finding #1) — a fast double-tap could fire duplicate delivery-verify/sign requests. Both backend handlers are idempotent (re-setting the same fields) except for re-emitting a duplicate `orderEvent` socket notification per repeat call.
   **Fix:** added `verifying`/`signing` state; the "Verify" button, "Sign" button, and the "tap to sign as {accountName}" shortcut are all now guarded — the shortcut specifically needed its own `disabled` prop since it's a separate `Pressable` calling the same `handleSign`, not just relying on the primary button's disabled state.

2. **[FIXED] The refund screen showed the request form unconditionally, without checking (as the equivalent web screen does) whether the order's payment method is even eligible for a wallet refund.** `docs/audits/customer-web/refunds.md`'s companion page (`/orders/:id/refund`) fetches `/payments/orders/:id` and checks the payment's `method`/`cashTiming` before deciding whether to show the form or a "not eligible" notice; this mobile screen fetched the same endpoint but only read `res.order?.total`, discarding `res.payment` entirely — so a customer with a cash-paid order (genuinely ineligible per business rules) could fill out a full refund reason only to have it rejected at submission with a generic error, wasted effort the web screen avoids entirely. Confirmed this was a UX-only gap, not a security one: `RefundsService.createRequest` independently and correctly rejects `PaymentMethod.CASH`/non-refundable methods server-side regardless of what the client shows.
   **Fix:** mirrored the web screen's logic — added `cashBlocked`/`cashLabel` state derived from the same `/payments/orders/:id` response, and the screen now shows a clear "Not eligible for a wallet refund" notice (with the cash-timing label when applicable) instead of the form when the order's payment isn't refundable, matching the web copy closely.

## Unused/dead fields
None found beyond what's covered in Finding #2 (`res.payment` was fetched but unused before the fix).

## Loading/error/realtime behavior
Order detail uses `DataLoadState` for its full-screen loading/error state, plus pull-to-refresh via `RefreshControl`. Realtime tracking triggers a full `load()` on every status/event update rather than patching state locally for most fields (only `location` and the immediate `status` field are patched optimistically) — reasonable given how much of the UI depends on values only the full order payload carries (branch info, payment info, delivery UI state). Lost-item and refund screens each manage their own local loading/error state; refund's is now correctly gated on payment eligibility (Finding #2).
