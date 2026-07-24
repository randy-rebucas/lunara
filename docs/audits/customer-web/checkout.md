# Audit: Customer-web — Checkout (payment + delete unpaid order)

Date: 2026-07-24

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/checkout/[orderId]/page.tsx`
- Component(s): `src/components/payment/payment-checkout.tsx` (client component, all the logic), `src/components/payment/payment-receipt.tsx` (used by the success sub-page)

## Sub-pages

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `checkout/[orderId]/success/page.tsx` | `window.location.href` redirect on paid/cash/PayMongo-return, `payment-checkout.tsx:85,141,146` | `orderId` route param + `paymentId` query param | yes — fetches `GET /payments/:paymentId`, independent of the checkout page's own `order`/`payment` state |

The success page (`PaymentSuccessPage`) re-syncs (`POST /payments/:id/sync`) then fetches the payment fresh by id — it does not reuse anything the checkout page had in memory, which is correct since it can be reached directly (e.g. after a PayMongo redirect in a fresh page load) without ever having rendered the checkout page in this session. Independent loading/error state (`loadError`), no realtime subscription — appropriate for a one-shot receipt view.

## Data flow

| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load checkout | GET | `/payments/orders/:orderId` | `{order: CheckoutOrder, payment: CheckoutPayment \| null}` | `PaymentsController.getForOrder` → `PaymentsService.getForOrder` |
| Load wallet balance | GET | `/wallets/me` | `{balance: number}` | (wallets module, not traced in depth — out of scope) |
| Sync pending payment | POST | `/payments/:id/sync` | `{status, _id}` | `PaymentsController.syncPayment` → `PaymentsService.syncPayment` |
| Create payment intent | POST | `/payments/intent` | `{paid?, checkoutUrl?, payment?, receiptCode?}` | `PaymentsController.createIntent` → `PaymentsService.createIntent` |
| Delete unpaid order | DELETE | `/orders/:id` | — | `OrdersController` → `OrdersService.cancelByCustomer` |
| Success page: get payment | GET | `/payments/:id` | `PaymentReceiptData` | `PaymentsController.getById` → `PaymentsService.getById` |

## Backend trace
- **`getForOrder`** (`payments.service.ts:85-120`): ownership enforced *inside the service* (`order.customerId.toString() !== userId` → `BadRequestException`), not via a `@Roles`/route guard — functionally correct today, but see Findings #3. Opportunistically re-syncs a `PENDING` PayMongo payment before returning, swallowing sync errors (the page still loads with the pre-sync status on a transient PayMongo API failure).
- **`syncPayment`** (`payments.service.ts:159-168`): ownership via `payment.userId.toString() !== userId`. Calls `syncPaymongoPayment` → `fulfillPayment`, which is **correctly race-safe**: an atomic `findOneAndUpdate({_id, status:{$ne:PAID}}, {status:PAID,...})` claim (`payments.service.ts:472-494`) means the webhook (`POST /payments/webhooks/paymongo`) and this frontend-triggered sync poll can race on the *same* payment without double-fulfilling it — only one wins, the other's claim returns `null` and no-ops.
- **`createIntent`** (`payments.service.ts:170-309`): ownership + order-status checks are all server-side (not just the frontend's `PENDING`/`PENDING_DISPATCH` assumptions). Branches per `PaymentMethod`:
  - **WALLET**: debits atomically via `WalletsService.debit` (balance-guarded, unique-reference-indexed), and if the subsequent `markOrderPaid` throws, reverses the ledger entry and re-credits the wallet — a real compensating-transaction pattern, not just a try/catch that leaves money in limbo.
  - **CASH**: saves the payment `PENDING` and immediately calls `confirmOrder` — the order is confirmed/dispatched before any cash has actually changed hands, by design (the rider collects cash later via a separately-audited, race-safe `collectCashForOrder` claim).
  - **PayMongo channels**: creates a checkout session and returns `checkoutUrl` for redirect; reconciliation on return happens through the same race-safe `fulfillPayment` claim as `syncPayment`.
  - See Findings #1 (fixed) for the serious gap this module actually had: nothing previously prevented *two concurrent `createIntent` calls* for the same order from both creating separate pending payment rows in the first place — each per-method branch above being individually race-safe didn't help once two full payment records already existed side by side.
- **`cancelByCustomer`** (`orders.service.ts:328-348`, backing `DELETE /orders/:id`): re-verifies ownership and `order.status === PENDING` server-side (doesn't trust the frontend's button-visibility guard), checks no `PAID` payment exists first, then `deleteMany`s *all* payment docs for the order before deleting the order itself — no orphaned payment records left behind.

## Cards / panels

| Card | Fields consumed | Notes |
|---|---|---|
| Order summary | `order.bookingType`, `order.total`, `order.status`, `existingPayment.receiptCode`/`status` (pending-ref line) | — |
| Payment method picker (PayMongo/Cash/Wallet) | `CUSTOMER_PAYMENT_OPTIONS` (shared constant from `@lunara/utils`, filtered by `channel:'paymongo'`), `walletBalance` | cash-timing sub-choice (`pickup`/`delivery`) is local UI state only, sent as `cashTiming` in the intent body — matches backend's required-when-CASH validation |
| Insufficient-wallet notice | `walletBalance < order.total` (client-derived) | correctly also re-validated server-side by `WalletsService.debit`'s balance guard — the client check is a UX nicety, not the actual authority |
| Pay button | `paying`, `deleting`, `insufficientWallet` | see Mutations |
| Delete order button | only rendered when `order.status === OrderStatus.PENDING` | matches the server's own re-check in `cancelByCustomer` |

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Pay (any method) | no (WALLET debits money but isn't "destructive" in the delete sense) | n/a | yes client-side (`payingRef` ref-guard, checked synchronously before `setPaying`, `payment-checkout.tsx:122-124` — stronger than a state-based guard since it can't race with React's batched updates) **and now** yes server-side (see Findings #1) | yes — inline `error` state |
| Delete unpaid order | yes (order is gone, "This cannot be undone" in the confirm copy) | yes — `window.confirm(...)` before proceeding (`payment-checkout.tsx:103-109`) | yes — `disabled={paying \|\| deleting}` | yes — inline `error` state |

## Authorization
No role guard at the controller level for `GET /payments/orders/:orderId`, `POST /payments/:id/sync`, `POST /payments/intent`, or `GET /payments/:id` (all just `JwtAuthGuard`) — ownership is enforced entirely by manual checks inside each service method (`order.customerId`/`payment.userId` vs. `req.user.sub`). This is functionally correct today (verified for all four), but it's a fragile pattern: a future edit to any of these service methods that drops or miscopies the inline check would silently remove the protection, with no `@Roles`/route-level guard as a backstop. `DELETE /orders/:id` does have both (`@Roles(CUSTOMER)` at the controller **and** a service-level ownership check) — the inconsistency between that endpoint and the four payment ones is worth normalizing, but doing so is a broader `payments.controller.ts` refactor across every route in that controller, not a single-module fix — flagging as `[authz]` finding #3 below rather than fixing unilaterally in a checkout-scoped pass.

## Findings

1. **Two concurrent `POST /payments/intent` calls for the same order could both succeed, creating duplicate payment records — double wallet-debit or double PayMongo charge — `[fixed]`.** `createIntent` (`payments.service.ts:170-309`, pre-fix) checked "no PAID payment exists" then did `deleteMany` (clear stale pending rows) followed by `paymentModel.create(...)` — none of this was atomic, and the `Payment` schema had no unique constraint tying a pending payment to its order. Two near-simultaneous requests (a slow first response causing a client retry, or the same account open in two tabs/devices) could both pass every check and both create a separate `PENDING` payment doc for the same order:
   - For **WALLET**: both calls independently call `WalletsService.debit`, which is individually atomic and balance-guarded — but the guard is per-call, not per-order, so if the wallet balance was ≥ 2× the order total, **both debits would succeed**, draining the wallet twice for one order.
   - For **PayMongo methods**: both calls create two separate checkout sessions. If the customer completed both (two tabs, or paid the first and retried before seeing it succeed), both webhooks legitimately fulfill two different `Payment` docs — `confirmOrder`/`markOrderPaid` being individually idempotent per-payment didn't stop the underlying **double charge** through PayMongo itself, since each session is a real, independent transaction.
   **Fix:** added a partial unique index on `Payment` — `{orderId:1, purpose:1, status:1}`, unique, filtered to `status:'pending' AND orderId exists` (`apps/api/src/modules/payments/schemas/payment.schema.ts`) — and wrapped the `create()` call in `createIntent` in a try/catch that turns the resulting duplicate-key error (E11000) into a clean `BadRequestException('A payment is already being processed for this order...')` instead of letting the losing request proceed into a wallet debit or PayMongo session creation (`payments.service.ts:210-231`, plus a new `isDuplicateKeyError` helper mirroring the identical pattern already used in `wallets.service.ts`, `rider-wallet.service.ts`, `rewards.service.ts`, `promotions.service.ts`, and `ledger.service.ts`). **Regression check**: grepped the whole `apps/api/src` for every `paymentModel.create(...)` call — only two exist, this one and `createWalletTopupIntent`'s (`payments.service.ts:344`, wallet top-ups, no `orderId`). The partial filter explicitly requires `orderId` to exist so wallet top-up payments (which have none) are never subject to this constraint — verified this wouldn't have collapsed all users' pending top-ups onto one global unique key (an early version of this fix's index, without the `orderId: {$exists: true}` condition, would have done exactly that, since MongoDB treats a missing field as `null` for uniqueness purposes across documents — caught and corrected before finalizing).

2. **Same double-intent race exists, unfixed, in `createWalletTopupIntent`** (`payments.service.ts:326-370`, backing the customer-web Wallet page, already separately audited in [wallet.md](wallet.md)). It has the identical `deleteMany`-then-`create` shape for `purpose:'wallet_topup'` payments, with no equivalent unique-index protection (deliberately excluded from this fix's index — see Findings #1). Left unfixed here as out of scope for the checkout module specifically — cross-referencing so a future pass on the Wallet module doesn't miss it. The risk profile is lower than the order-payment case (a top-up amount is capped and user-initiated with no downstream order-fulfillment side effects to duplicate), but the double-wallet-debit-via-two-tabs scenario is structurally identical.

3. **[authz] Payment endpoints rely solely on manual ownership checks, not route-level role guards.** `GET /payments/orders/:orderId`, `POST /payments/:id/sync`, `POST /payments/intent`, and `GET /payments/:id` (`payments.controller.ts`) only carry `JwtAuthGuard` — no `@Roles(UserRole.CUSTOMER)`. Every one of them does correctly check `order.customerId`/`payment.userId` against `req.user.sub` inside the service, so there's no live vulnerability today, but it's inconsistent with `DELETE /orders/:id`'s pattern (both a `@Roles` decorator *and* a service-level check) in the same payment/order flow, and leaves no defense-in-depth if a future edit to any of these four service methods drops the inline check. Left unfixed: adding `@Roles` decorators here is a `payments.controller.ts`-wide change (would need to confirm no non-customer role legitimately calls any of these four routes elsewhere in the app, e.g. an admin support tool) — a broader review than this single-module audit should make unilaterally.

## Unused/dead fields
None found in `CheckoutOrder`/`CheckoutPayment` (`payment-checkout.tsx:18-32`) — every field declared is read somewhere in the component.

## Loading/error/realtime behavior
Independent `loading`/`error` state via a manual `useEffect` + `cancelled` flag (not a shared `useAsyncQuery`-style hook — this component doesn't use one, unlike several admin/partner-web boards), correctly guarding against a state update after unmount. No realtime subscription on the checkout page itself; the success page's payment status is fetched fresh on load via its own sync-then-fetch, which is the appropriate one-shot pattern for a receipt view reached via redirect rather than a live dashboard.
