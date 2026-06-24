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
Rider submits remittance in-app ("I've handed over the cash")
       │  POST /riders/remit-cash
       │  rider_remittance.status = pending → submitted
       ▼
Admin verifies the remittance batch
       │  POST /admin/riders/:userId/cash-remittances/verify
       │  rider_remittance.status = submitted → remitted
       │  ledger: debit platform_cash / credit rider_remittance_receivable
       ▼
Admin creates a settlement record for the partner (separate from rider remittance)
       │  POST /admin/partners/:partnerId/settlements
       │  { periodStart, periodEnd, adminNote }
       ▼
Partner sees settlement in their portal
       GET /partner/settlements
```

---

## User guide

### For the rider

The rider-mobile app prompts cash collection at the appropriate stage (pickup or delivery). Once collected, the payment is marked as paid and a receipt code is generated for both parties.

The rider does not remit the full cash amount — the app nets out the rider's earned fee for that order (`earningOffset`) before showing the amount to remit (`netRemittance`). The cash payment card shows this breakdown once collected.

This isn't just a display calculation — each collection creates a `rider_remittance` record (`pickup.service.ts` / `delivery.service.ts` → `RiderWalletService`). On the **Wallet** screen, the rider sees their running "Cash to remit" total (cash collected, fee offset, net amount owed) and taps **"I've handed over the cash"** once they've physically given the net amount to admin. That calls `POST /riders/remit-cash`, which flips all their pending remittances to `submitted` — it does not confirm receipt by itself; an admin still has to verify the batch before it's considered settled.

If the rider taps "Cash collected" while offline, the action queues via the app's offline-sync layer instead of failing — the screen shows "Cash collection pending sync — stay online before pickup/delivery" until connectivity is restored and the queued `collect-cash` call actually reaches the API.

### For Lunara admin

#### Verifying rider cash remittances

This step confirms cash physically received from a rider — it is separate from, and happens before, partner settlement.

1. `GET /admin/riders/:userId/cash-remittances` — lists a rider's pending/submitted/remitted cash remittances.
2. Once the rider has handed over cash, call `POST /admin/riders/:userId/cash-remittances/verify` (optionally with specific `remittanceIds`) to mark them `remitted`. This posts a ledger entry clearing `rider_remittance_receivable` against `platform_cash`.
3. Until verified, remittances stay in `pending`/`submitted` and the rider's "Cash to remit" balance keeps growing as they collect more.

> **Implementation gap:** these two endpoints have no admin-web page or button calling them yet. `admin-web` only surfaces `rider_remittance_receivable` as a read-only balance label in the accounting board (`accounting-board.tsx`) — there is no UI to list a rider's remittances or trigger verification. Until a page is built, an admin must call the API directly (e.g. via curl/Postman). Every other step in this flow (rider collection, rider submit, partner settlement creation, partner view) has working UI on both ends.

#### Viewing per-partner settlement history

1. In admin-web, go to `/partners/settlements`.
2. Select a partner from the left panel.
3. Their settlement history is shown on the right — period, order count (with cash/digital split, e.g. "12 (5C / 7D)"), status badge, paid date, and three amount columns: **Gross** (`totalAmount`), **Lunara fee** (`lunaraFee`, with the commission % shown alongside), and **Partner payout** (`partnerPayout`). A totals row sums orders/gross/fee/payout across all settlements shown.

> **Implementation gap:** there is no **Partners → Settlements** sidebar link in admin-web (`admin-shell.tsx` nav list has no entry for `/partners/settlements`). The page works once navigated to directly, but an admin currently has no way to reach it by clicking through the UI.

#### Creating a new settlement

Partner settlements pay the **partner** their share of revenue for completed orders in a period — they are not the same as rider cash remittances (which move cash from rider to admin). A settlement can be created regardless of whether the underlying cash for that period has been remitted/verified yet.

1. Go to `/partners/settlements` and select the partner.
2. Click **+ Create settlement**.
3. Set the **period start** and **period end** to cover the orders included in this remittance (the modal defaults to the 1st of the current month through today).
4. Optionally add an **admin note** (e.g., "Cash remitted via GCash transfer").
5. Click **Mark as settled**.

The system automatically:
- Queries all completed orders for that partner within the period
- Counts cash vs. digital orders
- Sums the total revenue (`totalAmount`) and computes `lunaraFee` (commission on subtotal) and `partnerPayout` (`totalAmount − lunaraFee`)
- Records the settlement as paid with your admin user ID and the current timestamp, and posts the corresponding ledger entries

> **Note:** If there are no completed orders in the selected period, the request will fail with an error message. Adjust the date range accordingly.

### For the partner

#### Revenue page — per-order payment breakdown

In partner-web, go to **Revenue** (`/revenue`).

Below the daily chart, a "Completed orders" table shows recent completed orders with:
- **Payment badge** — "Cash collected" (green) / "Cash pending" (amber) for cash orders, or a blue badge for GCash/Maya/Wallet
- **Cash status** — "Collected at {pickup/delivery} · {time}" or "Pending collection" for cash orders; "N/A" for digital
- **Filter buttons** — All / Cash / Digital
- A footer link to **View settlements →**

#### Settlements page

Go to `/settlements`.

This page shows four summary cards, then a table:
- **Outstanding balance** — what Lunara still owes the partner, pulled live from the accounting ledger (`GET /partner/ledger-balance`), not from the settlement records themselves
- **Total paid out to you** — sum of `partnerPayout` across all `paid` settlements
- **Last settlement payout** — most recent settlement's payout amount and paid date
- **Revenue tracking** — a link back to `/revenue`
- **Settlement history table** — period, order count (with cash/digital split), status badge (Paid/Pending), paid date, **Gross revenue** (`totalAmount`), **Lunara fee** (`lunaraFee`, with commission % shown), and **Your payout** (`partnerPayout`)
- **Admin notes** — any notes from Lunara about the transfer method or reference number, listed below the table

When Lunara creates a new settlement for the partner, it appears here on next page load/refresh (there's no live push — the partner needs to refresh or revisit the page).

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
| `commissionRate` | Number | Partner's commission rate at settlement time (defaults to `0.20`) |
| `lunaraFee` | Number | Platform commission: sum of `order.subtotal × commissionRate` (delivery fee excluded) |
| `partnerPayout` | Number | What the partner actually receives: `totalAmount − lunaraFee` |
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

**Collection:** `rider_remittance`

| Field | Type | Description |
|---|---|---|
| `riderUserId` | ObjectId | Rider who collected the cash |
| `orderId` | ObjectId | Order the cash belongs to |
| `paymentId` | ObjectId | The `payments` document this remittance nets against |
| `stage` | `'pickup' \| 'delivery'` | Where the cash was collected |
| `cashAmount` | Number | Full cash amount collected |
| `earningOffset` | Number | Rider's fee for this order, netted out |
| `netRemittance` | Number | `max(0, cashAmount − earningOffset)` — what the rider owes admin |
| `status` | `'pending' \| 'submitted' \| 'remitted'` | `pending` on collection, `submitted` after the rider taps "handed over," `remitted` after admin verifies |
| `submittedAt` / `remittedAt` | Date? | Set at each transition |
| `verifiedBy` | ObjectId? | Admin who verified the batch |

A unique index on `(riderUserId, orderId, stage)` makes remittance creation idempotent.

> **Note:** `createSettlement` (partner payouts) is independent of the `rider_remittance` pipeline (rider-to-admin cash). It recomputes `totalAmount`/`cashOrders` from completed orders in the period and does not check whether the corresponding cash has actually been verified as remitted yet — these are two separate ledgers (`partner_payable` vs. `rider_remittance_receivable` / `platform_cash`) that aren't cross-checked against each other.

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
      "commissionRate": 0.2,
      "lunaraFee": 480,
      "partnerPayout": 2720,
      "status": "paid",
      "paidAt": "ISO date",
      "paidBy": "adminUserId",
      "adminNote": "GCash transfer ref #12345",
      "createdAt": "ISO date"
    }
  ]
}
```

```
GET /partner/ledger-balance
```
Returns `{ partnerId, payableBalance }` — the partner's live `partner_payable` ledger balance (what Lunara still owes them), independent of the settlement history list. Backs the "Outstanding balance" card on `/settlements`.

#### Rider-facing (cash remittance, distinct from partner settlements)

```
GET /riders/cash-summary
```
Returns the rider's pending remittance totals (`totalCashCollected`, `totalEarningOffset`, `totalNetRemittance`, `items[]`) plus `recentRemitted[]`.

```
POST /riders/remit-cash
```
Marks all of the rider's `pending` remittances as `submitted`. Returns `{ submittedCount, totalNetRemittance }`. Throws `404` if there are no pending remittances.

#### Admin-facing

```
GET /admin/riders/:userId/cash-remittances
```
Lists a rider's remittances, optionally filtered by `status` query param.

```
POST /admin/riders/:userId/cash-remittances/verify
```
Marks remittances `remitted` (optionally scoped to specific `remittanceIds` in the body) and posts the clearing ledger entry. Returns `{ verifiedCount, totalNetRemittance }`.

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

apps/api/src/modules/riders/
├── pickup.service.ts                  ← collectCash() → PaymentsService.collectCashForOrder + RiderWalletService netting
├── delivery.service.ts                ← collectCash() → same, for delivery stage
├── rider-wallet.service.ts            ← netEarningsAgainstCash, submitRemittance,
│                                         getCashSummary, verifyRemittanceBatch
└── riders.controller.ts               ← GET cash-summary, POST remit-cash

apps/rider-mobile/
├── app/wallet.tsx                     ← "Cash to remit" summary + "I've handed over the cash"
└── src/components/cash-payment-card.tsx ← per-order collect button + netting breakdown
```

---

### Key service methods

All settlement logic lives in `PartnerOperationsService` ([`partner-operations.service.ts`](../apps/api/src/modules/partner/partner-operations.service.ts)).

| Method | Description |
|---|---|
| `getRevenue(userId, role)` | Returns revenue summary + `recentOrders[]` with payment details |
| `getSettlements(userId, role)` | Returns settlements for the partner (or all if admin) |
| `getPartnerSettlementsForAdmin(partnerId)` | Returns settlements for a specific partner ID |
| `createSettlement(adminUserId, partnerId, dto)` | Queries completed orders in period, computes totals/commission/payout, creates the settlement record, and posts the ledger entries |
| `formatSettlement(doc)` | Serializes a settlement document to the API response shape |

`createSettlement` joins three collections: `orders` (to find completed orders in the period), `payments` (to classify cash vs. digital), and writes to `partner_settlements`. It also posts a double-entry transaction via `LedgerService.post(...)`: a debit to `order_revenue_clearing`, a credit to `partner_payable` for `partnerPayout`, and a credit to `platform_revenue` for `lunaraFee`.

Rider cash remittance lives in `RiderWalletService` ([`rider-wallet.service.ts`](../apps/api/src/modules/riders/rider-wallet.service.ts)):

| Method | Description |
|---|---|
| `netEarningsAgainstCash(riderUserId, orderId, paymentId, cashAmount, stage)` | Called by `PickupService`/`DeliveryService` right after cash is marked collected. Creates the `rider_remittance` record and posts the `rider_remittance_receivable` / `order_revenue_clearing` ledger entry |
| `submitRemittance(riderUserId)` | Flips the rider's `pending` remittances to `submitted` |
| `getCashSummary(riderUserId)` | Returns pending + recently-remitted totals for the Wallet screen |
| `verifyRemittanceBatch(riderUserId, adminUserId, remittanceIds?)` | Admin-only: flips `pending`/`submitted` remittances to `remitted` and posts the `platform_cash` clearing entry |

---

### Extending this feature

**Admin-web UI for rider cash remittance verification** — `GET /admin/riders/:userId/cash-remittances` and `POST /admin/riders/:userId/cash-remittances/verify` are implemented and working on the backend, but there is no admin-web page that calls them. Build a page (e.g. under `/riders/:userId/cash` or a "Cash remittances" tab) that lists pending/submitted remittances per rider and lets admin select and verify a batch — mirroring the partner settlements page pattern.

**Adding a "pending" settlement workflow** — `createSettlement` currently marks all settlements as `paid` immediately. To support a two-step approve flow (create pending → admin approves later), add a `status` param to the DTO, a separate `approveSettlement(id, adminUserId)` method, and a `PATCH /admin/partners/:partnerId/settlements/:id/approve` endpoint.

**Email/push notification on settlement** — after `this.settlementModel.create(...)` in `createSettlement`, fire a notification to the partner user (e.g., via `PartnerOrderNotificationService` or a new `PartnerFinanceNotificationService`).

**Partner payout request** — analogous to the rider withdrawal system (`rider_withdrawals` collection). Partners could submit a payout request; admin approves and creates the settlement record at the same time.
