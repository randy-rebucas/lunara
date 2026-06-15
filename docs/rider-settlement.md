# Rider Settlement

## Overview

Riders earn a fixed fee per task (pickup and delivery). How that fee is settled depends on the order's payment method:

- **Cash orders** — the rider collects cash from the customer, offsets their earned fee, and remits the net amount to Lunara admin. The offset is automatic.
- **Digital/wallet orders** — the full fee accumulates in the rider's wallet balance. The rider requests a payout at any time; admin approves and transfers manually.

---

## Earning rates

| Task | Fee |
|---|---|
| Pickup completed | ₱80 |
| Delivery completed | ₱120 |
| Admin bonus | Manual (any amount) |
| Admin adjustment | Manual (positive or negative) |

Source: `packages/utils/src/rider-ops.ts` → `RIDER_PICKUP_PAYOUT`, `RIDER_DELIVERY_PAYOUT`

---

## Cash order settlement (netting)

### How it works

When a rider completes a cash task, two things happen automatically:

1. **Task earning credited** — `+₱120` added to `rider.walletBalance` (as a `credit` transaction)
2. **Netting debit applied** — `−₱120` immediately deducted (as a `netting` transaction)

Net wallet impact for the cash order = **₱0**. The rider's wallet is not affected, but a `RiderCashRemittance` record is created:

```
cashAmount     = ₱500   (what the customer paid)
earningOffset  = ₱120   (rider's fee for the task)
netRemittance  = ₱380   (what the rider must hand to admin)
status         = pending
```

### Trigger point

Netting fires automatically inside `collectCash()` in both `pickup.service.ts` and `delivery.service.ts`, immediately after `collectCashForOrder()` marks the payment as paid. It runs asynchronously (`void`) so it does not slow down the rider's response.

### Rider-facing UI

After tapping **Cash collected** in the rider app, the cash payment card updates to show:

```
Cash collected · ₱500
─────────────────────────
Cash collected      ₱500
Your fee (offset)  − ₱120
─────────────────────────
Remit to admin      ₱380
```

Component: `apps/rider-mobile/src/components/cash-payment-card.tsx`

### Rider cash summary

```
GET /riders/cash-summary
```

Returns all pending remittances (cash not yet confirmed by admin) and recent history:

```json
{
  "pendingRemittance": {
    "count": 2,
    "totalCashCollected": 900,
    "totalEarningOffset": 200,
    "totalNetRemittance": 700,
    "items": [ ... ]
  },
  "recentRemitted": [ ... ]
}
```

### Admin verifies receipt

After the rider physically hands over the net cash, admin confirms:

```
POST /admin/riders/:userId/cash-remittances/verify
Body: { "remittanceIds": ["id1", "id2"] }   // omit to verify all pending
```

This marks the selected remittances as `remitted`. No further wallet change occurs — the netting debit already settled the account at collection time.

Admin can also list a rider's remittance history:

```
GET /admin/riders/:userId/cash-remittances?status=pending
GET /admin/riders/:userId/cash-remittances?status=remitted
GET /admin/riders/:userId/cash-remittances          // all
```

---

## Digital / wallet order settlement

For GCash, Maya, Wallet, and Stripe payments, no cash changes hands. The rider's full task fee accumulates in their `walletBalance`.

### Step 1 — Configure payout method

Before requesting any withdrawal the rider must set a payout method once:

```
PATCH /riders/payout-method
Body: { "method": "gcash", "gcashNumber": "09XXXXXXXXX" }
```

Supported methods: `gcash`, `maya`, `bank`

### Step 2 — Request withdrawal

```
POST /riders/wallet/withdraw
Body: { "amount": 500 }
```

Rules:
- Minimum withdrawal: **₱100**
- `amount` cannot exceed `withdrawableBalance`
- `withdrawableBalance = walletBalance − pendingHold − pendingWithdrawalTotal`

A `RiderWithdrawal` record is created with `status: pending`.

### Step 3 — Admin approves or rejects

Admin reviews requests at **Riders → Withdrawals** in admin-web.

**Approve:**
```
POST /admin/riders/withdrawals/:id/approve
Body: { "adminNote": "Sent via GCash" }
```
- Debits `rider.walletBalance` by the withdrawal amount
- Creates a `debit` ledger transaction
- Sets withdrawal `status → paid`

**Reject:**
```
POST /admin/riders/withdrawals/:id/reject
Body: { "adminNote": "Reason here" }
```
- Wallet balance is unchanged
- Rider can resubmit

> The actual bank/GCash transfer is done **manually** by admin outside Lunara. Approval just marks it as processed.

---

## Wallet balance breakdown

| Field | Meaning |
|---|---|
| `currentBalance` | Total credits minus all debits (including netting) |
| `pendingEarnings` | Amount on hold (`rider.pendingHold`) |
| `withdrawableBalance` | `currentBalance − pendingHold − pendingWithdrawalTotal` |

Computed by `computeRiderWalletBalances()` in `packages/utils/src/rider-ops.ts`.

---

## Ledger transaction types

All balance movements are recorded in `rider_wallet_transactions`:

| Type | When created |
|---|---|
| `credit` | Task earning (pickup/delivery/bonus/adjustment) |
| `netting` | Cash fee offset at time of cash collection |
| `debit` | Withdrawal approved by admin |
| `hold` | Admin places a hold on the balance |
| `release` | Admin removes a hold |

Reference format for task earnings: `earning:{type}:{orderId}`
Reference format for netting: `netting:{stage}:{orderId}`
Reference format for withdrawals: `withdrawal:{withdrawalId}`

The `(riderUserId, reference)` pair has a **unique index** — all earning credits and netting debits are idempotent.

---

## Key files

| File | Purpose |
|---|---|
| `apps/api/src/modules/riders/rider-wallet.service.ts` | All wallet logic: credits, netting, withdrawals |
| `apps/api/src/modules/riders/schemas/rider-wallet.schema.ts` | `RiderWalletTransaction`, `RiderWithdrawal`, `RiderCashRemittance` schemas |
| `apps/api/src/modules/riders/pickup.service.ts` | Triggers netting after pickup cash collection |
| `apps/api/src/modules/riders/delivery.service.ts` | Triggers netting after delivery cash collection |
| `apps/api/src/modules/riders/riders.controller.ts` | `GET /riders/wallet`, `GET /riders/cash-summary`, `POST /riders/wallet/withdraw` |
| `apps/api/src/modules/admin/admin.controller.ts` | Admin withdrawal approval + remittance verification endpoints |
| `apps/rider-mobile/src/components/cash-payment-card.tsx` | Netting breakdown UI shown after cash collection |
| `packages/utils/src/rider-ops.ts` | Earning rates, wallet balance computation |

---

## Complete flow diagram

```
CASH ORDER                              DIGITAL ORDER
──────────────────────────────          ──────────────────────────────
Customer pays ₱500 cash                 Customer pays ₱500 via GCash

Rider completes pickup/delivery         Rider completes pickup/delivery
  → +₱120 credit (wallet)                → +₱120 credit (wallet)

Rider taps "Cash collected"
  → −₱120 netting debit (wallet)
  → RiderCashRemittance created
    netRemittance = ₱380

Rider app shows:
  "Remit to admin: ₱380"

Rider hands ₱380 to admin              (no action needed)

Admin: POST .../verify                  Rider: POST /riders/wallet/withdraw
  → status = remitted                     → RiderWithdrawal created (pending)

                                        Admin: POST .../approve
                                          → walletBalance − ₱120
                                          → status = paid
                                          → Admin transfers ₱120 manually
```
