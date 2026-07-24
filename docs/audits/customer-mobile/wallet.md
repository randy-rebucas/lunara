# Audit: Customer-mobile — Wallet (tabs)

Date: 2026-07-24

## Entry point
- Screen: `apps/customer-mobile/app/(tabs)/wallet.tsx`
- Component(s): `Card`, `DataLoadState`, `FlatList` (transaction list with header/footer)

## Sub-pages
None — no dedicated transactions-detail route exists (confirmed via search); see Finding #2 for the "View all" link that implies one does.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Balance | GET | `/wallets/me` | `{ balance: number }` | `WalletsController.getWallet` — already traced in `docs/audits/customer-web/wallet.md` |
| Transactions | GET | `/wallets/me/transactions` | `WalletTransaction[]` | `WalletsController.getTransactions` |
| Start top-up | POST | `/payments/wallet-topup/intent` | `{ checkoutUrl?, payment?: { _id, status, ... } }` | `PaymentsController.createWalletTopupIntent` |
| Sync top-up (on app foreground return) | POST | `/payments/:id/sync` | `{ status: string }` | `PaymentsController.syncPayment` -> `PaymentsService.syncPayment` |

## Backend trace
Same endpoints already fully traced for customer-web's `/wallet` — no new backend behavior. `createWalletTopupIntent` returns the full serialized `payment` (including `_id`, needed for the fix below) alongside `checkoutUrl`; `syncPayment` scopes to `req.user.sub` and is a no-op (200, unchanged status) if PayMongo hasn't confirmed yet — the same characteristics already established in `docs/audits/customer-web/wallet.md`, which is what made that screen's original "any success = confirmed" bug possible and is exactly what this screen needed to guard against too (see Finding #1).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Balance card | `balance` | |
| Top-up card | `topUpMethod` (GCash/Maya/card, from `CUSTOMER_PAYMENT_OPTIONS` filtered to `paymongo`), fixed `TOP_UP_AMOUNT = 500` (no amount picker, unlike the web version's ₱500/₱1,000/₱2,000 presets — a real but minor feature gap, not flagged as a bug since a single fixed amount is a valid, if less flexible, product choice) | |
| "View all" link (transaction history header) | none — **no `onPress` at all** | see Finding #2 |
| Transaction list | per-item `type`, `amount`, `description`, `createdAt` | credit rows are always labeled "Successful" and debit rows always "Completed" (`txStatus`) regardless of the underlying transaction's actual state — `WalletTransaction` doesn't even carry a status field, so this is decorative, not misleading data (there's nothing to disagree with) |
| "100% secure" footer card | static copy, wrapped in a non-functional `Pressable` (press-feedback styling with no `onPress`) | minor code smell — an interactive-looking element with no action — not flagged as a separate finding since, unlike "View all", it makes no promise of navigating anywhere; the message itself is the complete content |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Start top-up | no (opens an external checkout) | n/a | yes (`disabled={topUpLoading}`) | yes (`Alert.alert`) |

## Authorization
Same already-confirmed scoping (`/wallets/me`, `/wallets/me/transactions`, `/payments/wallet-topup/intent`, `/payments/:id/sync` all scoped to `req.user.sub`). No `[authz]` issues.

## Findings

1. **[FIXED] After starting a top-up, the returned payment id was discarded and the screen relied entirely on the customer manually pulling to refresh — with no active sync attempt and no way to distinguish "still pending" from "confirmed" or "failed."** `topUp()` fetched `data.payment?._id` off the intent response but never stored it; once the user was sent to the PayMongo checkout in the browser, the only guidance was a static alert ("pull to refresh"), and `load()` only re-fetches `/wallets/me`/`/wallets/me/transactions` — it never calls `/payments/:id/sync`. Since wallet crediting normally happens via a webhook independent of any client sync call, this wasn't a total dead end (the balance would eventually update once the webhook landed and the user happened to refresh again), but it's materially weaker than the established pattern already used elsewhere in this app: `components/payment-checkout.tsx`'s `load()` proactively syncs any `pending` payment it finds on mount. This screen had no equivalent nudge at the one moment it matters most — right when the customer returns from completing (or abandoning) the checkout.
   **Fix:** the payment id returned from `createWalletTopupIntent` is now stored in a ref before opening the checkout URL; an `AppState` listener fires once when the app returns to the foreground, calls `/payments/:id/sync`, reloads the wallet, and — mirroring the same status-aware messaging already fixed on customer-web (`docs/audits/customer-web/wallet.md`, Finding #1) — shows a clear "Top-up confirmed" or "Payment did not go through" alert rather than assuming success. The ref is cleared after firing once so a later unrelated foreground transition (e.g. switching apps for an unrelated reason) doesn't re-trigger a stale sync.

2. **"View all" (transaction history section header) has no `onPress` handler at all, and there's no dedicated transactions screen anywhere in the app to link it to** (confirmed via search — `wallet.tsx` is the only screen touching wallet transactions). Since this screen already renders every transaction `/wallets/me/transactions` returns (capped at 50 server-side, per the already-audited web endpoint) directly in its own list, "View all" currently implies a fuller view exists when it doesn't.
   **Left unfixed** — removing the link outright vs. building a real paginated transactions screen is a product call, not a safe default to guess at during an audit pass; flagging so it's a deliberate decision rather than an accidental dead affordance.

## Unused/dead fields
None found in the API payloads themselves — Finding #2 is a UI affordance with no backing feature, not an unused data field.

## Loading/error/realtime behavior
Uses `DataLoadState` with a retry button. No polling; realtime balance updates only happen via the new foreground-sync (Finding #1), manual pull-to-refresh, or the next full screen load. `FlatList`'s data is switched to `[]` while `loading || error` so stale transaction rows never render underneath the loading/error header — a slightly different (stricter) approach than the "leave stale data visible under an error" pattern used elsewhere in this series, but reasonable here since `DataLoadState` already fully occupies that space instead of appearing above a list.
