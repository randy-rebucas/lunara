# Platform Commission (Lunara Revenue)

## Overview

Lunara's sole revenue mechanism is commission on the laundry subtotal of every completed order — delivery fees pass straight through to fund rider payouts and are never part of Lunara's cut. Two pricing models exist side by side; which one an order uses determines *how* the cut is computed, but the settlement math (`totalAmount − lunaraFee = partnerPayout`) is the same either way.

```
Gross revenue (order totals for period)
− Lunara fee  (computed per order — see "Two pricing models" below)
= Partner payout
```

There is no subscription, ads, or other monetization — commission is it.

---

## Two pricing models

`computeOrderFee()` (`apps/api/src/modules/partner/partner-operations.service.ts:117-136`) branches on the order's `pricingModel`:

### 1. Legacy commission model
Used when an order has no `pricingModel` set, or it's explicitly `'legacy_commission'` (i.e. every order created before the shop-markup flow shipped). The fee is computed at settlement time as a percentage of `subtotal`:

```
lunaraFee = Math.round(order.subtotal × branch.commissionRate)
```

This is the model documented in detail below — rate storage, admin editing, snapshotting, etc.

### 2. Shop-markup model
Used when `pricingModel === 'shop_markup'` or `'commission'` **and** `order.baseSubtotal` is set. Here the customer is charged a markup **up front, at booking time** — `basePrice × 1.30` — so Lunara's cut is already baked into the price the customer paid. Settlement doesn't re-apply `commissionRate` on top of it; it just backs the fee out of the difference:

```
lunaraFee = order.subtotal − order.baseSubtotal
```

Because a partner can own several branches with different commission rates, `computeOrderFee()` always looks up the rate per-order (via a `branchId → commissionRate` map) rather than assuming one flat rate for the whole settlement — this matters for the legacy model; the shop-markup model doesn't need a rate lookup at all since the cut is already embedded in the price.

---

## Commission rate

The rate is stored per branch and defaults to **20%**.

| Field | Location | Default |
|---|---|---|
| `commissionRate` | `Branch` document | `0.20` (20%) |

Admin can update a branch's rate at any time via `PATCH /admin/branches/:id`. The rate is **snapshotted** into each `PartnerSettlement` record at creation time so historical settlements are auditable even if the rate changes later.

### Managing it in admin-web

This is already fully manageable through the UI — no raw API calls needed. Go to `/branches`, select a branch, and edit the **"Commission rate (%)"** field in the branch edit panel (`apps/admin-web/src/components/datacenter/branches-board.tsx`). The form:
- Loads the current rate as a percentage (`commissionRate * 100`, line ~269)
- Lets admin type a new percentage (input accepts 0–100)
- Converts back to decimal and saves via `PATCH /admin/branches/:id` (`commissionPct / 100`, line ~401)

Blank input is skipped on save rather than treated as 0, so admin can leave the field untouched without accidentally zeroing the rate.

---

## How fees are computed

Fee computation happens at **settlement time**, not at order creation time. This avoids needing to touch order creation or do a branch lookup at booking time (the branch may not be assigned yet).

```
commissionRate = branch.commissionRate ?? 0.20
lunaraFee      = Σ Math.round(order.subtotal × commissionRate)   // per order
partnerPayout  = totalAmount − lunaraFee
```

Where:
- `subtotal` = order total excluding delivery fee and discounts (the laundry-only amount)
- `totalAmount` = sum of all completed order totals in the period

Logic lives in `apps/api/src/modules/partner/partner-operations.service.ts` → `createSettlement()`.

---

## Settlement lifecycle

### 1. Orders complete
Riders complete pickup + delivery. Orders reach `COMPLETED` status. Gross revenue accumulates.

### 2. Admin creates settlement
```
POST /admin/partners/:partnerId/settlements
Body: {
  "periodStart": "2025-06-01",
  "periodEnd":   "2025-06-30",
  "adminNote":   "June batch — GCash transfer ref #XYZ"   // optional
}
```

The API:
1. Finds all completed orders for the partner's branch in the period
2. Looks up the branch's current `commissionRate`
3. Computes `lunaraFee` and `partnerPayout` per order, then aggregates
4. Creates a `PartnerSettlement` document with `status: 'paid'`
5. Snapshots `commissionRate` into the record

### 3. Partner sees the breakdown
Partner logs in to `partner-web /settlements`:
- **Gross revenue** — total order amounts for the period
- **Lunara fee** — platform commission deducted (shown as −X%)
- **Your payout** — what Lunara actually remits

Admin sees the same columns in `admin-web /partners/settlements` with a totals row showing Lunara's retained revenue across all settlements for that partner.

---

## Data model

### Branch.commissionRate
```
Field:   commissionRate
Type:    Number
Default: 0.20
Min:     0
Max:     1
Schema:  apps/api/src/modules/branches/schemas/branch.schema.ts
```

### PartnerSettlement (commission fields)
```
Field            Type     Description
─────────────────────────────────────────────────────────
totalAmount      Number   Gross: sum of order.total for the period
lunaraFee        Number   Sum of (order.subtotal × commissionRate)
partnerPayout    Number   totalAmount − lunaraFee
commissionRate   Number   Rate snapshotted at settlement time (e.g. 0.20)
```

Full schema: `apps/api/src/modules/partner/schemas/partner-settlement.schema.ts`

---

## API reference

### Get branch commission rate
```
GET /admin/branches/:id/profile
Response: { success: true, data: { branch: { ..., commissionRate: 0.20 }, ... } }
```
Note the `/profile` suffix and the nested `data.branch.commissionRate` path — there is no plain `GET /admin/branches/:id`.

### Update branch commission rate
```
PATCH /admin/branches/:id
Body: { "commissionRate": 0.15 }   // 15%
```

Range: `0` (0%) to `1` (100%). Values outside this range are rejected by the validator.

### List settlements (admin)
```
GET /admin/partners/:partnerId/settlements
Response: PartnerSettlement[]  // includes lunaraFee, partnerPayout, commissionRate
```

### Create settlement (admin)
```
POST /admin/partners/:partnerId/settlements
Body: { "periodStart": "YYYY-MM-DD", "periodEnd": "YYYY-MM-DD", "adminNote"?: "..." }
```

### List settlements (partner-web)
```
GET /partner/settlements
Response: PartnerSettlement[]
```

---

## Revenue visibility (per-order)

`GET /partner/revenue` (service method `getRevenue()` in `partner-operations.service.ts`) computes and returns a per-order commission split in `recentOrders[]`:

| Field | Description |
|---|---|
| `amount` | Order total (gross) |
| `subtotal` | Laundry amount before delivery fee |
| `lunaraFee` | `subtotal × commissionRate` for that order |
| `partnerPayout` | `amount − lunaraFee` |
| `commissionRate` | Branch rate at time of revenue fetch |

The partner revenue page (`apps/partner-web/src/app/revenue/page.tsx`) renders this breakdown in the "Completed orders" table: alongside Date / Order ID / Payment badge / Cash status / Amount, each row also shows **Lunara fee** (`−lunaraFee`, with the commission % alongside) and **Your payout** (`partnerPayout`) — the same visual style as the aggregate breakdown on `/settlements`.

---

## Key files

| File | Purpose |
|---|---|
| `apps/api/src/modules/branches/schemas/branch.schema.ts` | `commissionRate` field on Branch |
| `apps/api/src/modules/branches/dto/update-branch.dto.ts` | Validates rate update (0–1) |
| `apps/api/src/modules/branches/branch-management.service.ts` | `updateBranch()` persists new rate |
| `apps/api/src/modules/partner/schemas/partner-settlement.schema.ts` | Settlement schema with fee fields |
| `apps/api/src/modules/partner/partner-operations.service.ts` | `createSettlement()`, `getRevenue()` |
| `apps/api/src/modules/admin/admin.controller.ts` | Admin settlement endpoints |
| `apps/api/src/modules/partner/partner.controller.ts` | Partner settlement endpoint |
| `apps/partner-web/src/app/settlements/page.tsx` | Partner-facing payout breakdown |
| `apps/partner-web/src/app/revenue/page.tsx` | Per-order commission breakdown (Lunara fee / payout columns) |
| `apps/admin-web/src/app/partners/settlements/page.tsx` | Admin settlement management |
| `apps/admin-web/src/components/datacenter/branches-board.tsx` | Admin commission-rate editor (branch edit panel) |
| `packages/types/src/partner.ts` | `PartnerSettlement`, `PartnerOrderDetail` interfaces |
| `apps/api/src/modules/ledger/LEDGER.md` | Double-entry account definitions and posting rules |
| `apps/api/src/modules/ledger` | `LedgerService.post()` and trial-balance reconciliation |

---

## Example settlement

**Branch commission rate:** 20%

| Order | Subtotal | Delivery fee | Total | Lunara fee (20%) | Partner gets |
|---|---|---|---|---|---|
| #001 | ₱400 | ₱50 | ₱450 | ₱80 | ₱370 |
| #002 | ₱250 | ₱50 | ₱300 | ₱50 | ₱250 |
| #003 | ₱600 | ₱50 | ₱650 | ₱120 | ₱530 |
| **Total** | **₱1,250** | | **₱1,400** | **₱250** | **₱1,150** |

Settlement record:
```json
{
  "totalAmount":    1400,
  "lunaraFee":      250,
  "partnerPayout":  1150,
  "commissionRate": 0.20,
  "status":         "paid"
}
```

> Note: the fee is computed on `subtotal` (laundry amount only), not on the delivery fee. Delivery fees pass through to Lunara to cover rider costs.

---

## Ledger accounting (double-entry)

Every step above also posts to the append-only ledger (`apps/api/src/modules/ledger`), so commission recognition can be reconciled against real money movement instead of trusted from status fields alone. Full account list and posting rules: `apps/api/src/modules/ledger/LEDGER.md`.

**Order lifecycle → revenue recognition:**

```
1. Order paid (PayMongo or wallet)
     Dr platform_cash / customer_wallet_liability
     Cr order_revenue_clearing          ← revenue recognized but not yet settled

2. Rider collects cash at pickup/delivery (cash orders only)
     Dr rider_remittance_receivable
     Cr order_revenue_clearing

3. Admin creates a partner settlement (this is when Lunara's cut is booked)
     Dr order_revenue_clearing
     Cr partner_payable                 ← what Lunara owes the partner
     Cr platform_revenue                ← Lunara's commission, finally recognized

4. Refund on an order already settled (clawback)
     Dr platform_revenue + cash_out
     Cr refund_expense
```

`platform_revenue` is the one account that represents actual Lunara income — it's only credited at settlement (step 3), never at order payment time. `order_revenue_clearing` should trend toward zero on a healthy system; a growing balance means orders are paid but not yet settled, or refunds are outpacing settlement.

Check current recognized revenue and clearing drift via `GET /admin/ledger/trial-balance`.
