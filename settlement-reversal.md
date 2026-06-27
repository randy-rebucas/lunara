# Gap 1 Analysis: Settlement Reversal Workflow

## Context

A settlement reversal is needed when an admin-created settlement was posted in error — wrong orders included, wrong commission rate applied, duplicate settlement, or a partner dispute that was validated. Currently settlements are one-way: created directly as `'paid'` with no ability to undo. The ledger entries, order `settlementId` references, and the settlement record all become permanent. This gap describes the full workflow, data model changes, and implementation plan to support authorized reversals.

---

## Reversal Triggers (When to Reverse)

| Trigger | Who Initiates |
|---|---|
| Wrong orders included in settlement | Admin |
| Duplicate settlement created | Admin |
| Commission rate error discovered | Admin |
| Partner-disputed amount validated by admin | Partner requests → Admin approves |

The workflow is **admin-only authorization** (no partner self-service reversal). Partners can see reversal status but cannot initiate or approve.

---

## State Machine

```
created → PAID
              ↓ (admin initiates)
         REVERSAL_PENDING
              ↓ (second admin approves) OR (same admin, time-gated)
         REVERSAL_APPROVED
              ↓ (system processes: ledger + order unlink)
         REVERSED
              OR
         REVERSAL_REJECTED (back to PAID, no change)
```

Keep it simple: **two-admin rule not required for MVP** — a single admin can initiate and approve (but the step still exists for audit trail). A future config can require a second approver for large amounts.

---

## Schema Changes

### `PartnerSettlement` schema (`apps/api/src/modules/partner/schemas/partner-settlement.schema.ts`)

**Status enum — extend:**
```ts
status: 'pending' | 'paid' | 'reversal_pending' | 'reversal_approved' | 'reversed' | 'reversal_rejected'
```

**New fields to add:**
```ts
reversalRequestedAt?: Date
reversalRequestedBy?: ObjectId   // admin userId
reversalReason?: string          // required on request
reversalApprovedAt?: Date
reversalApprovedBy?: ObjectId    // admin userId (can be same as requester for MVP)
reversalRejectedAt?: Date
reversalRejectionReason?: string
reversedAt?: Date
timeline: SettlementTimelineEntry[]   // follows RefundTimelineEntry pattern
```

**`SettlementTimelineEntry` sub-schema (no _id, inline):**
```ts
{ stage: string; label: string; at: Date; note?: string }
```
Matches `RefundTimelineEntry` exactly — reuse the pattern from `apps/api/src/modules/refunds/schemas/refund-request.schema.ts`.

**No new collection** — all reversal state lives on the existing `PartnerSettlement` document.

---

## API Endpoints (Admin only)

All under `apps/api/src/modules/admin/admin.controller.ts` + a new `SettlementReversalService`:

| Method | Path | Action |
|---|---|---|
| `POST` | `/admin/partners/:partnerId/settlements/:id/request-reversal` | Admin initiates reversal, sets reason, status → `reversal_pending` |
| `POST` | `/admin/partners/:partnerId/settlements/:id/approve-reversal` | Admin approves, triggers ledger reversal + order unlink, status → `reversed` |
| `POST` | `/admin/partners/:partnerId/settlements/:id/reject-reversal` | Admin rejects, records reason, status → `reversal_rejected` (back to `paid`) |
| `GET` | `/admin/settlements/pending-reversals` | List all `reversal_pending` settlements across all partners |

### Approve-reversal processing steps (in order):

1. Find settlement, verify status is `reversal_pending`
2. Post offsetting ledger transaction with `transactionRef = reversal:<settlementId>`:
   ```
   Debit:  cash_out           amount=partnerPayout   (reverses original credit)
   Credit: order_revenue_clearing  amount=totalAmount (reverses original debit)
   Debit:  platform_revenue   amount=lunaraFee        (reverses original credit)
   ```
   Wait — must balance: debits = credits. The reversal is the mirror image of the original 3-line post.
3. Unlink orders: `Order.updateMany({ settlementId: settlement._id }, { $unset: { settlementId: '' } })`
4. Set `status = 'reversed'`, `reversedAt = now`, append timeline entry
5. Return updated settlement

**Idempotency:** `transactionRef = reversal:<settlementId>` ensures the ledger reversal can't be double-posted.

---

## Shared Types (`packages/types/src/partner.ts`)

Extend `PartnerSettlement` interface:
```ts
status: 'pending' | 'paid' | 'reversal_pending' | 'reversal_approved' | 'reversed' | 'reversal_rejected'
reversalRequestedAt?: string
reversalRequestedBy?: string
reversalReason?: string
reversalApprovedAt?: string
reversalApprovedBy?: string
reversalRejectedAt?: string
reversalRejectionReason?: string
reversedAt?: string
timeline?: Array<{ stage: string; label: string; at: string; note?: string }>
```

---

## Admin UI (`apps/admin-web/src/app/partners/settlements/page.tsx`)

On each settlement row in the history table, add a context action button for `'paid'` settlements:

- **"Request reversal"** → opens a modal asking for `reversalReason` (required text), then POSTs to request endpoint
- For `'reversal_pending'` settlements: show **"Approve"** and **"Reject"** buttons
- Status badges: add amber "Reversal pending", red "Reversed", slate "Reversal rejected"
- Show timeline as expandable section (same pattern as the existing order expansion)

---

## Partner UI (`apps/partner-web/src/app/settlements/page.tsx`)

- Show updated status badges for `reversal_pending` / `reversed` / `reversal_rejected`
- For reversed settlements: show `reversalReason` in the expanded detail (partner sees why)
- No action buttons for partner — read-only visibility only

---

## New Service File

Create `apps/api/src/modules/admin/settlement-reversal.service.ts`:
- `requestReversal(settlementId, adminId, reason)`
- `approveReversal(settlementId, adminId, note?)`
- `rejectReversal(settlementId, adminId, reason)`
- `listPendingReversals()`

Inject: `PartnerSettlement` model, `Order` model, `LedgerService`.

Register in `apps/api/src/modules/admin/admin.module.ts`.

---

## What NOT to Build (MVP Scope)

- ❌ Partner-initiated dispute/reversal requests (partner only sees status)
- ❌ Two-admin approval requirement (single admin can do both steps)
- ❌ Partial reversal (only full settlement reversal)
- ❌ Email/push notification on reversal (can add later via `PartnerNotificationsService`)
- ❌ Auto-reversal time window (e.g., "can only reverse within 7 days") — manual admin judgment

---

## Verification

1. Create a settlement in admin-web for a test partner
2. Click "Request reversal" → enter reason → confirm `status = reversal_pending` in DB
3. Click "Approve" → confirm:
   - Settlement `status = reversed`
   - Ledger has a matching `reversal:<id>` transaction with mirror entries
   - Orders linked to this settlement have `settlementId` removed
   - Orders now appear in unsettled-orders list again
4. Create a second settlement, request reversal, then click "Reject" → confirm `status = reversal_rejected`, orders still linked
5. Partner portal shows correct status badges and reversal reason for reversed settlement
6. Attempt to approve the same reversal twice → ledger idempotency prevents duplicate entry
