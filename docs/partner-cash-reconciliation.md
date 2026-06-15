# Partner Cash Reconciliation

## Overview

When a customer pays with cash, the rider collects the money at pickup or delivery and remits it to Lunara (admin). The partner (laundry shop) never handles cash directly — they earn revenue from completed orders and receive payouts from Lunara. This document describes both how the system works technically and how each role uses it day to day.

---

## How the flow works

```
Customer pays cash
       │
       ▼
Rider collects at pickup or delivery
       │  payment.cashCollectedBy = riderId
       │  payment.paidAt = timestamp
       │  payment.status = PAID
       ▼
Rider remits cash to Lunara admin (offline / manual transfer)
       │
       ▼
Admin creates a settlement record for the partner
       │  POST /admin/partners/:partnerId/settlements
       │  { periodStart, periodEnd, adminNote }
       ▼
Partner sees settlement in their portal
       GET /partner/settlements
```

---

## User guide

### For the rider

No change to the rider workflow. The rider-mobile app already prompts cash collection at the appropriate stage (pickup or delivery). Once collected, the payment is marked as paid and a receipt code is generated for both parties.

### For Lunara admin

#### Viewing per-partner settlement history

1. In admin-web, go to **Partners → Settlements** (`/partners/settlements`).
2. Select a partner from the left panel.
3. Their settlement history is shown on the right — period, order counts, cash vs. digital split, amount, and paid date.

#### Creating a new settlement

After receiving a cash remittance from a rider (via GCash, bank transfer, or in-person handover):

1. Go to **Partners → Settlements** and select the partner.
2. Click **+ Create settlement**.
3. Set the **period start** and **period end** to cover the orders included in this remittance.
4. Optionally add an **admin note** (e.g., "Cash remitted via GCash transfer — ref #12345").
5. Click **Mark as settled**.

The system automatically:
- Queries all completed orders for that partner within the period
- Counts cash vs. digital orders
- Sums the total revenue
- Records the settlement as paid with your admin user ID and the current timestamp

> **Note:** If there are no completed orders in the selected period, the request will fail with an error message. Adjust the date range accordingly.

### For the partner

#### Revenue page — per-order payment breakdown

In partner-web, go to **Revenue** (`/revenue`).

Below the daily chart, a table shows all recent completed orders with:
- **Payment badge** — Cash (green = collected, amber = pending), GCash, Maya, or Wallet
- **Cash status** — whether the rider collected, at which stage (pickup or delivery), and the collection time
- **Filter buttons** — filter by All / Cash / Digital

#### Settlements page

Go to **Settlements** (`/settlements`) in the sidebar.

This page shows:
- **Total settled** — cumulative amount Lunara has paid out to your shop
- **Settlement history** — each record shows the period covered, order count, cash/digital split, paid date, and amount
- **Admin notes** — any notes from Lunara about the transfer method or reference number

When Lunara creates a new settlement for your account, it will immediately appear here.

---

## Technical reference

### Data model

**Collection:** `partner_settlements`

| Field | Type | Description |
|---|---|---|
| `partnerId` | ObjectId | Partner user ID |
| `periodStart` | Date | Start of the covered period (inclusive) |
| `periodEnd` | Date | End of the covered period (inclusive) |
| `totalOrders` | Number | Completed orders in the period |
| `cashOrders` | Number | Orders paid in cash |
| `digitalOrders` | Number | Orders paid via wallet/GCash/Maya/Stripe |
| `totalAmount` | Number | Sum of `order.total` for all orders in the period |
| `status` | `'pending' \| 'paid'` | Settlement status (currently always created as `paid`) |
| `paidAt` | Date | When the settlement was created (Mongoose timestamps also populate `createdAt`) |
| `paidBy` | ObjectId | Admin user who created the settlement |
| `adminNote` | String? | Optional free-text note from admin |

**Related fields on the `payments` collection** (existing, not added by this feature):

| Field | Description |
|---|---|
| `method` | `CASH`, `GCASH`, `MAYA`, `WALLET`, `STRIPE` |
| `cashTiming` | `'pickup'` or `'delivery'` — when the rider collects |
| `cashCollectedBy` | ObjectId of the rider who collected |
| `paidAt` | Timestamp when cash was marked collected |
| `status` | `PAID` once collected |

---

### API endpoints

#### Partner-facing

```
GET /partner/revenue
```
Returns revenue summary stats plus `recentOrders[]` — up to 200 most recent completed orders with per-order payment details.

**New field in response (`recentOrders` array):**
```json
{
  "orderId": "string",
  "completedAt": "ISO date",
  "amount": 250,
  "bookingType": "wash_fold",
  "paymentMethod": "CASH",
  "cashTiming": "pickup",
  "cashCollected": true,
  "cashCollectedAt": "ISO date",
  "receiptCode": "PAY-xxx-yyy"
}
```

```
GET /partner/settlements
```
Returns all settlement records for the authenticated partner, sorted newest first.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "string",
      "partnerId": "string",
      "periodStart": "ISO date",
      "periodEnd": "ISO date",
      "totalOrders": 12,
      "cashOrders": 5,
      "digitalOrders": 7,
      "totalAmount": 3200,
      "status": "paid",
      "paidAt": "ISO date",
      "paidBy": "adminUserId",
      "adminNote": "GCash transfer ref #12345",
      "createdAt": "ISO date"
    }
  ]
}
```

#### Admin-facing

```
GET /admin/partners/:partnerId/settlements
```
Returns all settlement records for a specific partner. Same response shape as above.

```
POST /admin/partners/:partnerId/settlements
```
Creates a new settlement. Computes totals from the database — do not send amounts manually.

**Request body:**
```json
{
  "periodStart": "2026-06-01",
  "periodEnd": "2026-06-14",
  "adminNote": "Optional note"
}
```

**Errors:**
- `400 Bad Request` — invalid dates, `periodStart >= periodEnd`, or no completed orders found in the period
- `404 Not Found` — partner has no branch record in the database

---

### Module structure

```
apps/api/src/modules/partner/
├── schemas/
│   ├── partner-settlement.schema.ts   ← new
│   └── shop-inventory.schema.ts
├── dto/
│   ├── create-settlement.dto.ts       ← new
│   └── ...
├── partner-operations.service.ts      ← getRevenue, getSettlements,
│                                         getPartnerSettlementsForAdmin,
│                                         createSettlement
└── partner.controller.ts              ← GET /partner/settlements

apps/api/src/modules/admin/
└── admin.controller.ts                ← GET/POST /admin/partners/:id/settlements

packages/types/src/
└── partner.ts                         ← PartnerSettlement, PartnerOrderDetail,
                                          PartnerRevenueData.recentOrders

apps/partner-web/src/
├── app/
│   ├── revenue/page.tsx               ← per-order table with payment badges
│   └── settlements/page.tsx           ← new settlements history page
└── components/portal-shell.tsx        ← Settlements nav link

apps/admin-web/src/
└── app/partners/settlements/page.tsx  ← new admin settlement management page
```

---

### Key service methods

All settlement logic lives in `PartnerOperationsService` ([`partner-operations.service.ts`](../apps/api/src/modules/partner/partner-operations.service.ts)).

| Method | Description |
|---|---|
| `getRevenue(userId, role)` | Returns revenue summary + `recentOrders[]` with payment details |
| `getSettlements(userId, role)` | Returns settlements for the partner (or all if admin) |
| `getPartnerSettlementsForAdmin(partnerId)` | Returns settlements for a specific partner ID |
| `createSettlement(adminUserId, partnerId, dto)` | Queries completed orders in period, computes totals, creates the settlement record |
| `formatSettlement(doc)` | Serializes a settlement document to the API response shape |

`createSettlement` joins three collections: `orders` (to find completed orders in the period), `payments` (to classify cash vs. digital), and writes to `partner_settlements`.

---

### Extending this feature

**Adding a "pending" settlement workflow** — `createSettlement` currently marks all settlements as `paid` immediately. To support a two-step approve flow (create pending → admin approves later), add a `status` param to the DTO, a separate `approveSettlement(id, adminUserId)` method, and a `PATCH /admin/partners/:partnerId/settlements/:id/approve` endpoint.

**Email/push notification on settlement** — after `this.settlementModel.create(...)` in `createSettlement`, fire a notification to the partner user (e.g., via `PartnerOrderNotificationService` or a new `PartnerFinanceNotificationService`).

**Partner payout request** — analogous to the rider withdrawal system (`rider_withdrawals` collection). Partners could submit a payout request; admin approves and creates the settlement record at the same time.
