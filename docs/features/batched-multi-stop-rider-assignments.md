# Feature: Batched / multi-stop rider assignments

> **Status:** draft (design only — not implemented)
> **Date:** 2026-07-24
> **Author / PR:** —

## Summary

Today a rider can hold exactly one active pickup or delivery task at a time (`rider-assignment.service.ts` assigns one order to one rider; `rider-mobile`'s active-assignment state models a single task). This document scopes what it would take to let dispatch group several pickups or deliveries into one multi-stop trip for a rider, and for rider-mobile to present that as a sequenced route instead of one-task-at-a-time offers.

This is a substantial change to the dispatch data model and rider-facing task flow — bigger than the other gaps addressed alongside it in this pass, so it's written up as a design rather than implemented directly.

## Current state (why this is a real gap)

- `apps/api/src/modules/riders/rider-assignment.service.ts`: `assignPickupRider`/`assignDeliveryRider` each bind one `Order._id` to one `riderId`. There is no entity representing "this rider's trip contains orders A, B, C in this order."
- `apps/rider-mobile/src/context/rider-operations.tsx`: `ActiveAssignment` is a single-task shape (`GET /riders/active-assignment` returns at most one task). `app/tasks.tsx` lists individual offers a rider can accept one at a time, not a route.
- Order status transitions (`packages/utils` `ORDER_STATUS_FLOW`, enforced in `orders.service.ts`) are all single-order state machines — nothing currently models "stop 2 of 3."

## Proposed model

### New entity: `RiderTrip`

A trip groups 2+ orders assigned to the same rider for the same phase (pickup or delivery), with a sequence.

```
RiderTrip {
  _id
  riderId: ObjectId
  phase: 'pickup' | 'delivery'
  status: 'active' | 'completed' | 'cancelled'
  stops: [
    {
      orderId: ObjectId
      sequence: number          // 1-indexed stop order
      status: 'pending' | 'arrived' | 'completed' | 'skipped'
      arrivedAt?: Date
      completedAt?: Date
    }
  ]
  createdAt, updatedAt
}
```

Orders keep their existing `pickupRiderId`/`deliveryRiderId` fields exactly as today (single rider per order, unchanged) — `RiderTrip` is an additive grouping/sequencing layer, not a replacement for the per-order assignment fields. This means every existing single-order code path (status transitions, handoff QR, earnings, SLA) keeps working unmodified for the common single-stop case; `RiderTrip` only exists when dispatch explicitly batches stops.

### Dispatch: forming a trip

Extend `rider-assignment.service.ts` with `assignPickupTrip(riderId, orderIds[], assignedByUserId)`:
- Validates every order is unassigned and eligible for pickup (mirrors today's per-order validation in `assignPickupRider`).
- Creates a `RiderTrip` with `stops` in the order given (dispatch or an admin picks/orders the stops — no route optimization in this design, see "Out of scope").
- Calls the existing single-order `assignPickupRider` logic per order (reused, not duplicated) so every existing side effect (notifications, tracking events, order status transition) still fires per order.
- Same shape for `assignDeliveryTrip`.

### Rider-mobile: consuming a trip

- `GET /riders/active-assignment` response gains an optional `trip` field: when present, rider-mobile shows a stop list (stop 1 of 3, etc.) instead of a single task card.
- New screen `app/trip/[id].tsx` (sibling to today's `app/pickup/[id].tsx`/`app/delivery/[id].tsx`): shows the ordered stop list, lets the rider mark the current stop complete (reuses the existing per-order pickup/delivery completion endpoints unchanged), and advances to the next stop.
- Navigation deep-links (`task-contact.ts`) work unchanged per-stop — no routing/sequencing logic needed on the client, dispatch already fixed the order.
- Earnings (`riders.service.ts` payout crediting) needs no change — payouts are already per-order.

### Admin/dispatch UI

Wherever pickup/delivery rider assignment currently happens (likely `admin-web` dispatch queue or `rider-assignment.service.ts` callers), add a "batch with nearby pickups" action that lets an operator multi-select orders in the same area/window and call `assignPickupTrip` instead of assigning them one at a time.

## Affected apps

| App | Wired? | Notes |
|-----|--------|-------|
| `api` | no | New `RiderTrip` schema/module, extend `rider-assignment.service.ts` |
| `admin-web` | no | Multi-select + "batch assign" action in dispatch queue |
| `partner-web` | N/A | Not partner-facing |
| `customer-web` | N/A | No customer-visible change (still see one order's own status) |
| `customer-mobile` | N/A | Same |
| `rider-mobile` | no | New trip view, stop-sequenced completion flow |

## Shared packages

- `@lunara/types` — `RiderTrip`, `TripStop` interfaces; extend `ActiveAssignment`-equivalent rider-mobile response type
- `@lunara/utils` — no changes to `ORDER_STATUS_FLOW` (per-order transitions untouched)

## Open questions before implementation

1. **Sequencing**: who orders the stops — dispatch manually, or a simple distance-based sort? (Explicitly out of scope for this design: true route optimization was already scoped out in this pass.)
2. **Partial completion**: if a rider can't complete stop 2 (customer unreachable), does the trip continue to stop 3, or does dispatch need to intervene? Needs a `skipped` stop status and a re-assignment path.
3. **Mixed-phase trips**: this design keeps pickup trips and delivery trips separate (a trip is all-pickup or all-delivery). Combining pickup+delivery stops in one trip is a bigger change and is not covered here.
4. **Capacity**: does a batched trip count toward a rider's single-active-task assumption elsewhere in the codebase (e.g. `activeJobs` counts in `partner-operations.service.ts` staff view, rider shift/availability logic)? Every place that assumes "one active order per rider" needs an audit pass once trips exist.

## How to verify locally (once implemented)

1. Seed 2-3 orders in the same pickup area/window.
2. From admin/dispatch, batch-assign them to one rider as a trip.
3. In rider-mobile, confirm the rider sees a sequenced stop list, can complete stops in order, and each stop's existing QR/status/earnings flow behaves exactly as a normal single-order pickup would.
4. Confirm a rider with a normal (non-batched) single-order assignment sees no change in behavior.

## Out of scope / follow-ups

- Route/stop-order optimization (AI-assisted or otherwise) — audited separately, has "nothing to optimize until multi-stop exists," revisit after this ships.
- Mixed pickup+delivery trips.
- Rider capacity/vehicle-size constraints on how many stops can be batched.
