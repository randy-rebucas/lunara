# Audit: Customer-web — Wallet

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/wallet/page.tsx` (`'use client'`)
- Component(s): `PageShell`, `PageHeader`, `DataPageStatus`, `AuthLoading`, `Card`/`CardBody`, `WalletTopupForm` (`components/payment/wallet-topup-form.tsx`)

## Sub-pages
None — no outbound navigation into a dynamic detail route. `/book` is a sibling page link only.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Balance | GET | `/wallets/me` | `{ balance: number }` | `WalletsController.getWallet` -> `WalletsService.getWallet` |
| Transactions | GET | `/wallets/me/transactions` | `WalletTransaction[]` | `WalletsController.getTransactions` -> `WalletsService.getTransactions` |
| Start top-up | POST | `/payments/wallet-topup/intent` (via `WalletTopupForm`) | `{ checkoutUrl?: string; payment?: { checkoutUrl?: string } }` | `PaymentsController.createWalletTopupIntent` -> `PaymentsService.createWalletTopupIntent` |
| Sync top-up (post-redirect) | POST | `/payments/:id/sync` (only when `?topupPaymentId=` is present in the URL) | `Payment` (`{ status, ... }`) | `PaymentsController.syncPayment` -> `PaymentsService.syncPayment` |

## Backend trace
`getWallet`/`getTransactions` both call `findOrCreate(userId)` first (upserts a zero-balance wallet if none exists) — correctly scoped to `req.user.sub`, no request param can widen it. `getTransactions` returns the 50 most recent transactions for that wallet, sorted newest-first; the page doesn't paginate beyond that (acceptable — a wallet history view, not expected to need deep pagination in this UI).

`createWalletTopupIntent` validates `amount` server-side (`CreateWalletTopupIntentDto`, `@Min(100)`) and rejects non-PayMongo methods (`isPaymongoMethod` check) — matches the frontend's preset-amount-only UI (500/1000/2000, no free-text amount field, so no client path to send an invalid amount). It also proactively deletes the user's other pending `wallet_topup` payments before creating a new one, preventing an accumulation of abandoned PENDING top-up records from repeated attempts.

`syncPayment` (`payments.service.ts:159-168`) loads the payment by id and throws `BadRequestException('Not your payment')` if `payment.userId !== req.user.sub` — correctly scoped, a customer cannot sync someone else's payment by guessing an id. It calls `syncPaymongoPayment`, which is a no-op returning normally (still 200, payment status unchanged) if PayMongo hasn't confirmed the session yet, marks the payment `FAILED` if the session expired, or calls `fulfillPayment` (which atomically claims the payment via a `findOneAndUpdate` guard against double-processing, then credits the wallet) if PayMongo reports it paid. The endpoint only throws for a genuine failure (e.g. PayMongo API unreachable), not for "still pending" — see Finding #1 for why the frontend needed to distinguish these.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Refresh button (header) | none — triggers `reload()` | disabled while `loading \|\| refreshing` |
| Balance card | `balance` (via `formatCurrency`); `lowBalance` derived client-side (`balance > 0 && balance < 500`) | the `< 500` threshold is a hardcoded magic number, not backend-configurable — minor, consistent with similar hardcoded thresholds noted (not flagged) elsewhere in this audit series |
| Top-up success/status banner | `topUpSuccess` (local state, set by the post-redirect sync effect) | **[FIXED]** — see Finding #1 |
| Top-up form (`WalletTopupForm`) | local `amount`/`method` state; `CUSTOMER_PAYMENT_OPTIONS` filtered to `paymongo` channel (static) | preset amounts only (₱500/₱1,000/₱2,000), no free-text amount input |
| Transaction history list | per-item: `type`, `amount`, `description`, `createdAt` (formatted via `formatTransactionDate`) | credit/debit styled with `+`/`−` and color; list key is `${createdAt}-${i}` since transactions have no exposed `_id` in this response shape — acceptable since the list is append-only/sorted and not reordered client-side |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Start PayMongo top-up | no (redirects off-site to complete payment) | n/a | yes (`disabled={loading}` in `WalletTopupForm`) | yes (`error` in the form) |
| Refresh balance/transactions | no | n/a | yes (`disabled={loading \|\| refreshing}`) | yes (`DataPageStatus` + "Try again" retry button) |

## Authorization
No cross-tenant exposure — every endpoint this page calls (`/wallets/me`, `/wallets/me/transactions`, `/payments/wallet-topup/intent`, `/payments/:id/sync`) is scoped to `req.user.sub` server-side, and `syncPayment` explicitly rejects a payment id that doesn't belong to the caller. No `[authz]` issues.

## Findings

1. **[FIXED] The post-redirect top-up sync effect showed a false-positive "Top-up confirmed" message even when the payment was still pending, and a misleading "Payment received" message on genuine sync failures.** `wallet/page.tsx`'s effect (triggered by `?topupPaymentId=` in the URL after returning from PayMongo checkout) treated *any* successful `POST /payments/:id/sync` response as proof the top-up succeeded — but `syncPayment` returns 200 even when PayMongo hasn't confirmed the session yet (`syncPaymongoPayment` no-ops silently in that case, per `payments.service.ts:457-470`), so a user whose payment was still processing would see "Top-up confirmed. Your wallet balance has been updated." with an unchanged balance. Separately, the `catch` branch (a genuine API/network failure, not "still pending" — those don't throw) unconditionally claimed `'Payment received — refreshing balance…'`, which is actively wrong when the sync call itself failed and nothing was confirmed.
   **Fix:** the effect now reads `res.data.status` from the sync response and messages accordingly — `'paid'` shows the confirmed message, `'failed'` shows a clear "did not go through" message, anything else (still `'pending'`) shows a neutral "we haven't received confirmation yet" message instead of a false success claim; the `catch` branch now says the sync couldn't be confirmed rather than asserting the payment was received. As a side effect this also fixed a secondary issue where `window.history.replaceState` only ran on the success path, leaving `?topupPaymentId=` in the URL after a sync failure — a page refresh would then silently re-trigger the sync attempt every time. It's now cleared unconditionally alongside the (corrected) success-path messaging.

## Unused/dead fields
None found — every field in `WalletTransaction`/`WalletData` is rendered.

## Loading/error/realtime behavior
Uses the shared `useCustomerQuery` hook (`docs/audits/customer-web/dashboard.md`, Finding #1 — the "wipes data on error" bug already fixed there applies here too, confirmed this page's own render logic doesn't depend on `data` being `null` on error). `DataPageStatus` handles loading/error display; a manual "Try again" button re-triggers `reload()` on error. No polling or realtime subscription — balance/transaction updates only happen via explicit refresh or the post-redirect sync effect.
