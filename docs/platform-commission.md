# Platform Commission (Lunara Revenue)

## Overview

Lunara charges a percentage-based commission on the laundry subtotal of every completed order. This fee is deducted when admin creates a settlement for a partner — the partner receives the gross revenue minus Lunara's cut.

```
Gross revenue (order totals for period)
− Lunara fee  (subtotal × commissionRate per order)
= Partner payout
```

---

## Commission rate

The rate is stored per branch and defaults to **20%**.

| Field | Location | Default |
|---|---|---|
| `commissionRate` | `Branch` document | `0.20` (20%) |

Admin can update a branch's rate at any time via `PATCH /admin/branches/:id`. The rate is **snapshotted** into each `PartnerSettlement` record at creation time so historical settlements are auditable even if the rate changes later.

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
GET /admin/branches/:id
Response includes: { commissionRate: 0.20 }
```

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

The partner revenue page (`/revenue`) includes a per-order breakdown showing the commission split for each completed order:

| Field | Description |
|---|---|
| `amount` | Order total (gross) |
| `subtotal` | Laundry amount before delivery fee |
| `lunaraFee` | `subtotal × commissionRate` for that order |
| `partnerPayout` | `amount − lunaraFee` |
| `commissionRate` | Branch rate at time of revenue fetch |

Endpoint: `GET /partner/revenue`
Service method: `getRevenue()` in `partner-operations.service.ts`

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
| `apps/admin-web/src/app/partners/settlements/page.tsx` | Admin settlement management |
| `packages/types/src/partner.ts` | `PartnerSettlement`, `PartnerOrderDetail` interfaces |

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
