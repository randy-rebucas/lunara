# Shelf assignment & lookup

Tracks where a customer's laundry bag physically sits on a shop shelf during
processing, and lets partner/staff find an order by scanning the shelf slot
or bag tag code.

## Data model

`Order.laundryProcessing` (`apps/api/src/modules/orders/schemas/order.schema.ts:170`)
carries the shelf fields alongside the rest of the processing pipeline state:

| Field             | Type       | Set by                          |
|--------------------|-----------|----------------------------------|
| `shelfSlot`         | `string`  | `setShelfSlot`                  |
| `shelfAssignedAt`   | `Date`    | `setShelfSlot` (server clock)   |
| `shelfAssignedBy`   | `ObjectId`| `setShelfSlot` (acting user)    |

Bag tag codes live per-step on `laundryProcessing.completedSteps[].tagCode`
(set during `advanceProcessingStep`), not on a dedicated top-level field —
shelf lookup searches both.

## API

Both endpoints live in `partner.controller.ts` and are backed by
`ProcessingService` (`processing.service.ts`). Access is role-gated with
`@Roles(PARTNER, STAFF, ADMIN)` and further scoped by
`assertOrderPortalAccess` / `resolvePortalBranchId`.

### `PATCH /api/v1/partner/orders/:orderId/processing/shelf`
Assigns/updates the shelf slot for one order.
- Body: `SetShelfSlotDto { shelfSlot: string (1-50 chars) }`
- `processing.service.ts:336` — loads the order, verifies portal access,
  lazily initializes `laundryProcessing` if absent, stamps slot/time/user.

### `GET /api/v1/partner/orders/shelf-lookup?query=<text>`
Finds the most recently updated order matching `query` as either the shelf
slot or a completed step's tag code (case-sensitive exact match, not a
prefix/fuzzy search).
- `processing.service.ts:352` — `findOnShelf(query, userId, role)`
  - `PARTNER` → scoped to `partnerId == userId`
  - `STAFF` → scoped to their resolved `branchId`
  - `ADMIN` → unscoped (searches across all partners/branches)
  - Returns `{ success: true, data: null }` on no match (200, not 404)
  - Response shape: `PartnerShelfLookupResult` (`packages/types/src/partner.ts:339`)

## Frontend

- `apps/partner-web/src/app/orders/[id]/page.tsx` — shelf slot input/save
  on the order detail page, calls the `PATCH .../processing/shelf` route.
- `apps/partner-web/src/app/shelf-lookup/page.tsx` — dedicated search page,
  calls `GET .../orders/shelf-lookup`, nav entry in `portal-shell.tsx`
  ("Find on shelf", visible to partner/staff/admin).

## Audit findings (2026-07-02)

- **No functional bugs.** DTO validation, role scoping, response shape, and
  frontend/backend route contracts all line up correctly.
- **Missing index (perf) — fixed.** `laundryProcessing.shelfSlot` and
  `laundryProcessing.completedSteps.tagCode` were unindexed, so
  `findOnShelf` did a full collection scan on every search. Added sparse
  partial indexes on both fields in `order.schema.ts` (only indexes orders
  that actually have a shelf slot / tag code, since most don't). Mongoose
  `autoIndex` is on by default, so these build automatically next time the
  API starts — no manual migration needed.
- **Exact match only.** Lookup is an exact string match on the trimmed
  query — no case-insensitivity or partial match. Acceptable for scanned
  codes, but a mistyped/partial slot number returns nothing rather than
  suggestions.
- **Stale build was the actual root cause of the earlier "Cannot GET"
  report** — the route existed correctly in source but `dist/` hadn't been
  rebuilt. Not a code defect; resolved by rebuilding.
