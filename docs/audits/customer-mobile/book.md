# Audit: Customer-mobile — Book (booking wizard)

Date: 2026-07-24

## Entry point
- Screen: `apps/customer-mobile/app/book.tsx` (1672 lines — deep module, audited fully, same scope treatment as `docs/audits/customer-web/book.md`)
- Component(s): `BookingProgress`, `PickupSchedulePicker`, `BranchPickerSheet`, `PaymentMethodPicker`, `ScheduleSupportPrompt`

## Sub-pages
None as detail routes. On success, `placeOrder()` navigates to `/orders/:id` (already audited) or, **new as of this fix**, `/checkout/:id` (already audited) when payment couldn't be started but the order itself was created.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Booking config | GET | `/booking/config` | `BookingConfig` | already traced in `docs/audits/customer-web/book.md` |
| Addresses | GET | `/addresses` | `AddressOption[]` | already traced |
| Reorder source | GET | `/orders/:reorderParam` | `ReorderSourceOrder` | already traced |
| Availability (per address/branch) | GET | `/booking/availability?addressId=&branchId=` | area/slots/holidays/dispatch note | already traced |
| Nearby shops | GET | `/booking/shops?addressId=` | `ShopOption[]` | already traced |
| Live quote | POST | `/booking/quote?addressId=` | `QuoteBreakdown` | already traced |
| Wallet balance (confirm step) | GET | `/wallets/me` | `{ balance }` | already traced |
| Create order | POST | `/booking/orders` | `{ _id, total }` | already traced — same server-side quote re-derivation, no client-trusted price |
| Start payment | POST | `/payments/intent` | `{ paid?, checkoutUrl?, payment?, receiptCode?, message? }` | already traced in `docs/audits/customer-mobile/checkout.md` |

## Backend trace
Same already-traced, correctly-scoped endpoints as both `docs/audits/customer-web/book.md` (booking/quote/order-creation, no client-trusted pricing) and `docs/audits/customer-mobile/checkout.md` (`/payments/intent`, order-ownership re-verified server-side in `createIntent`). Nothing new server-side — the finding in this module is entirely about how the **client** sequences two separate mutating calls.

## Cards / panels
Same step structure as the web wizard (address -> shop -> service -> schedule -> weight (mode-dependent) -> add-ons -> review -> confirm), adapted for mobile with a `BranchPickerSheet` for shops with multiple nearby branch variants (no web equivalent — a mobile-specific enhancement) and inline `PaymentMethodPicker` on the confirm step (web's checkout is a separate screen; mobile folds payment method selection directly into the wizard's last step).

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Apply/remove promo code | no | n/a | yes (`disabled={!form.couponCode.trim() \|\| promoLoading}` / `disabled={promoLoading}`) | yes (`error`) |
| Advance step (`goNext`) | no | n/a | implicit (each step's own validation blocks `Continue` until satisfied; no explicit stepping-in-flight state, but there's no async work on most steps to race — `review` step's `refreshQuote()` isn't separately guarded against a rapid double-tap of "Continue", a minor gap not present on web's equivalent `stepping` state, but low-impact since a duplicate quote request is idempotent and harmless) | yes (`error`) |
| Place order + start payment (`placeOrder`) | no (creates a PENDING order + payment attempt, not a charge by itself) | n/a | yes — synchronous `placingOrderRef` guard, same strong pattern already praised in `docs/audits/customer-web/book.md` | **[FIXED]** — see Finding #1 |

## Authorization
Every endpoint this flow touches is already confirmed `@Roles(UserRole.CUSTOMER)`-gated and scoped to `req.user.sub`/order ownership server-side (booking availability/shops/quote/order-creation via `validateAddressForUser`; payment intent via `createIntent`'s order-ownership check). No `[authz]` issues.

## Findings

1. **[FIXED] `placeOrder` treated order-creation and payment-initiation as a single atomic unit in its try/catch, but they're two separate API calls — if the order was created successfully and only the *payment* step then failed, the customer saw a generic "Booking failed" error implying nothing happened, while a real PENDING order had actually been created in their account.** Retrying (the natural response to "Booking failed") would call `POST /booking/orders` again from scratch, creating a **second, duplicate** PENDING order — the first one left orphaned, unpaid, and invisible to the customer at that moment (it would only surface later if they happened to check "My orders"). This is a materially worse failure mode than the equivalent web flow, which creates the order and then navigates to a dedicated `/checkout/:orderId` screen as a separate step — a failure there doesn't risk re-running order creation, since the order-creation step already fully completed and committed to its own screen transition before payment is ever attempted. Mobile's single-function, single-try/catch design conflated the two.
   **Fix:** tracked the created order's id (`createdOrderId`) once `/booking/orders` succeeds; if the subsequent `/payments/intent` call then throws, or returns a response with none of `paid`/cash-confirmed/`checkoutUrl` set, the customer now sees an "Order created — continue to checkout" alert routing to `/checkout/:orderId` (the already-audited standalone checkout screen, which itself already knows how to load and retry payment for an existing order, including the `AppState`-driven foreground-sync fix from `docs/audits/customer-mobile/checkout.md`) instead of a bare failure message with no path forward and a silent duplicate-order risk on retry. Also moved `placingOrderRef.current = false` into the `finally` block (previously only reset on failure paths) for the same reasoning already applied in `docs/audits/customer-mobile/checkout.md`, Finding #2 — though here the pre-fix code's success paths all `return` after triggering a screen-leaving `Alert`, so this specific change is more a consistency/defensive fix than one closing an active dead-button bug like that earlier case.

No other issues found. The address/config/reorder loading effects all have proper `.catch` handling (no missing-catch gaps here, unlike some of the auth/onboarding screens audited earlier), and the order-creation/quote endpoints are already confirmed to fully re-derive pricing server-side with no client-trusted total anywhere in the flow.

## Unused/dead fields
None found.

## Loading/error/realtime behavior
Each step's data (availability, shops, quote) is fetched independently with its own loading/error state (`availabilityLoading`/`availabilityError`, `shopsLoading`, etc.) rather than a shared hook — appropriate for a multi-step wizard where different steps need different data in flight at different times. No polling or realtime subscription, consistent with the web wizard.
