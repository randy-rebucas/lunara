# Audit: Customer-mobile — Checkout

Date: 2026-07-24

## Entry point
- Screen: `apps/customer-mobile/app/checkout/[orderId]/index.tsx` — thin wrapper, all logic in:
- Component(s): `src/components/payment-checkout.tsx` (`PaymentCheckout`, treated as its own module per audit scope — genuinely deep, not a thin sub-component), `PaymentMethodPicker` (not separately re-traced), `DataLoadState`

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `checkout/[orderId]/success.tsx` | `PaymentCheckout`'s `onPaid` callback (fires for wallet/cash instant confirmation, or if `/payments/intent` reports `paid: true` outright) | `paymentId` (query param) | yes — `success.tsx` fetches `/payments/:paymentId` directly |

Note: the PayMongo browser-checkout path (GCash/Maya/card) does **not** navigate to `success.tsx` — it stays on the checkout screen and waits for the customer to return from the browser (see Finding #1/#2). `success.tsx` is only reached for the two payment methods that confirm synchronously (`wallet`, `cash`).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load checkout (order + existing payment + wallet balance) | GET | `/payments/orders/:orderId`, `/wallets/me` (parallel) | `{ order, payment }`, `{ balance }` | `PaymentsController.getForOrder` -> `PaymentsService.getForOrder`; `WalletsController.getWallet` |
| Sync pending payment (on load, if one exists) | POST | `/payments/:id/sync` | `{ status }` | `PaymentsController.syncPayment` — already traced in `docs/audits/customer-mobile/wallet.md` |
| Start payment | POST | `/payments/intent` | `{ paid?, checkoutUrl?, payment?: { _id }, receiptCode? }` | `PaymentsController.createIntent` -> `PaymentsService.createIntent` |
| Sync on foreground return (new) | POST | `/payments/:id/sync` | `{ status }` | same |
| Receipt (success screen) | GET | `/payments/:paymentId` | `{ payment, order }` | `PaymentsController.getById` -> `PaymentsService.getById` |

## Backend trace
`createIntent` (`payments.service.ts:170-`) already re-verifies order ownership (`order.customerId !== userId` -> `BadRequestException`) and order status (must be `PENDING`/`PENDING_DISPATCH`, not already paid or cancelled) before creating a payment — the same server-side authority already confirmed for the booking flow in `docs/audits/customer-web/book.md`. `getForOrder`/`getById` are already-scoped read endpoints. Nothing new to add beyond what's already traced for `/payments/:id/sync` in `docs/audits/customer-mobile/wallet.md`.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Order summary | `order.bookingType`, `order.total`, `order.status`, `existingPayment.receiptCode`/`.status` (pending-ref banner) | |
| `PaymentMethodPicker` | `method`, `cashTiming`, `walletBalance`, `order.total` (not separately re-traced — self-contained selector) | |
| Pay button | label varies by method (Cash "Confirm & get receipt" / Wallet "Pay with wallet" / else "Continue to PayMongo") | |
| Success screen hero + receipt card | `payment.status`/`.method`/`.amount`/`.receiptCode`, `orderTotal` | only reachable for wallet/cash (see Sub-pages note) |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Pay (any method) | no | n/a (wallet/cash payments aren't reversible from this screen, but starting one isn't itself destructive) | **[FIXED]** — see Finding #2; previously broken for the PayMongo checkout-URL path specifically | yes (`error`) |

## Findings

1. **[FIXED] The PayMongo checkout-URL path told the customer to "pull to refresh" on a screen with no working pull-to-refresh at all.** `checkout/[orderId]/index.tsx` renders `PaymentCheckout` inside a `KeyboardSafeScrollView` with no `refreshControl` prop, and `KeyboardSafeScrollView` doesn't support one (confirmed by reading the component — no `RefreshControl`/`refreshControl` anywhere in it). A customer sent to the PayMongo browser checkout had no way to make the app re-check their payment status short of leaving and re-entering the checkout screen entirely (which would re-mount and re-run `load()`'s existing sync-if-pending logic) — the in-app instruction was a literal dead end. This is the same root issue just fixed on the wallet top-up flow (`docs/audits/customer-mobile/wallet.md`, Finding #1), here manifesting even more directly since there wasn't even a working manual fallback.
   **Fix:** added an `AppState` listener (mirroring the wallet fix) that re-runs `load()` — which already contains the correct sync-pending-payment logic — once when the app returns to the foreground after a checkout URL was opened, gated by an `awaitingReturnRef` so unrelated foreground transitions don't trigger a spurious reload. Updated the alert copy to stop promising a pull-to-refresh that doesn't exist.

2. **[FIXED] After opening the PayMongo checkout URL once, the Pay button became permanently non-functional for the rest of the screen's lifetime — silently, with no error and no visual indication.** `handlePay`'s double-submit guard (`payingRef`) is set to `true` synchronously before the async call and was only ever reset to `false` on the two failure paths (`catch`, and the "payment could not be started" fallback) — **not** on the successful `checkoutUrl` branch, which is the one path that doesn't navigate away and leaves the component mounted. `paying` (the React state driving the button's `disabled`/label) *was* correctly reset via the `finally` block, so the button visually looked re-enabled — but every subsequent tap hit `if (payingRef.current) return;` and silently no-op'd. A customer whose PayMongo attempt failed or was abandoned, returning to try cash or wallet instead, would find the Pay button completely dead with zero feedback.
   **Fix:** moved `payingRef.current = false` into the `finally` block alongside `setPaying(false)`, so it's reset uniformly regardless of which path was taken — the two success-and-navigate-away branches (`paid`, `cash`) are unaffected since the component unmounts before another tap is possible anyway; the guard still correctly prevents a double-submit for the full duration of any in-flight attempt.

No other issues found — `success.tsx` is a straightforward read-only receipt view, correctly scoped, and `createIntent`'s server-side re-validation of order ownership/status means this screen's client-side state (which order, which method) can't be abused to pay for or manipulate someone else's order.

## Unused/dead fields
None found — every field in the traced payloads is rendered somewhere across the two screens.

## Loading/error/realtime behavior
`PaymentCheckout` uses `DataLoadState` for its own loading/error display. No polling; payment status now updates via the new foreground-sync (Findings #1/#2) in addition to the existing mount-time sync. `success.tsx` has a single load with retry via `DataLoadState`, no polling — reasonable since it's only reached after a payment is already confirmed synchronously.
