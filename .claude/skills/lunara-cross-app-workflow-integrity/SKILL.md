---
description: |
  Enforce cross-application workflow integrity in the Lunara Turborepo
  monorepo. Use whenever a feature, API contract, domain state, order
  lifecycle, assignment, payment, notification, realtime event,
  permission, or operational workflow changes. Trace the business event
  across customer, partner, rider, admin/staff, backend, shared
  packages, realtime, notifications, offline behavior, observability,
  and tests.
name: lunara-cross-app-workflow-integrity
---

# Lunara Cross-App Workflow Integrity

## Mission

Treat Lunara as **one distributed application with multiple
purpose-built interfaces**, not as disconnected apps.

A feature is not complete when one screen or app works. It is complete
when the underlying business event produces the correct state,
permissions, realtime updates, notifications, projections, recovery
behavior, and tests across every affected consumer.

Lunara currently includes:

-   `apps/api` --- NestJS backend
-   `apps/customer-web`
-   `apps/admin-web`
-   `apps/partner-web`
-   `apps/customer-mobile`
-   `apps/partner-mobile`
-   `apps/rider-mobile`
-   `apps/ai-agents`
-   shared `@lunara/*` packages

The project uses a Turborepo/npm-workspaces architecture with shared
types, UI, validation, hooks, utilities, and branding.

## Non-negotiable rule

Whenever modifying one app, ask:

> **Who else cares that this happened?**

Then determine:

1.  What business capability changed?
2.  What domain entity changed?
3.  What state changed?
4.  Who caused the change?
5.  What command caused it?
6.  What domain event represents the result?
7.  Which applications consume the event?
8.  What does each consumer see?
9.  What action does each consumer need to take?
10. Which notification channels are required?
11. Which realtime channels are required?
12. Which shared contracts/packages change?
13. Which permissions are affected?
14. What happens offline?
15. What happens if the event/request is duplicated?
16. What happens if delivery fails?
17. What must be audited?
18. What cross-app tests prove the workflow?

If these cannot be answered, do not treat the feature as complete.

------------------------------------------------------------------------

# 1. Workflow-first development

Do not start with the screen.

Start with:

``` text
PRODUCT REQUIREMENT
        ↓
ACTOR
        ↓
USER ACTION / COMMAND
        ↓
DOMAIN ENTITY
        ↓
STATE TRANSITION
        ↓
DOMAIN EVENT
        ↓
EVENT CONSUMERS
        ↓
REALTIME / PUSH / EMAIL / SMS
        ↓
CACHE / PROJECTION UPDATES
        ↓
AUDIT / OBSERVABILITY
        ↓
FAILURE + RECOVERY
        ↓
CROSS-APP E2E TEST
```

The API endpoint is transport. The domain event expresses business
meaning.

Bad:

``` text
POST /rider/orders/:id/status
```

Better:

``` text
Rider
  ↓
CONFIRM_PICKUP
  ↓
API validates transition
  ↓
Order state changes
  ↓
ORDER_PICKED_UP
  ├── Customer
  ├── Partner
  ├── Admin
  ├── Notifications
  ├── Realtime
  └── Audit
```

------------------------------------------------------------------------

# 2. Domain state is authoritative

The backend is the source of truth.

Clients must not independently invent business state.

Never rely on:

``` ts
if (status === "picked_up") {
  setStatus("processing");
}
```

Prefer:

``` text
Client command
  ↓
API authorization
  ↓
API state-machine validation
  ↓
Persist state
  ↓
Emit domain event
  ↓
Consumers reconcile state
```

Frontend state is a projection of server/domain state.

------------------------------------------------------------------------

# 3. Commands versus events

Use this distinction consistently.

**Command:**

> What does an actor want the system to do?

Examples:

``` text
CONFIRM_PICKUP
MARK_ORDER_READY
CANCEL_ORDER
ASSIGN_RIDER
CONFIRM_DELIVERY
PROCESS_PAYMENT
```

**Event:**

> What happened in the system?

Examples:

``` text
ORDER_CREATED
PICKUP_ASSIGNED
ORDER_PICKED_UP
ORDER_PROCESSING_STARTED
ORDER_READY
DELIVERY_ASSIGNED
ORDER_DELIVERED
ORDER_CANCELLED
PAYMENT_CONFIRMED
PAYMENT_FAILED
PROOF_OF_PICKUP_CAPTURED
PROOF_OF_DELIVERY_CAPTURED
```

Never make one client call another client to synchronize business state.

Use:

``` text
Client A
  ↓
API/domain
  ↓
Event
  ├── Client B
  ├── Client C
  └── Client D
```

------------------------------------------------------------------------

# 4. Build an impact map before coding

For every workflow-changing feature, produce an impact map.

Use this structure:

``` text
Feature:
Actor:
Command:
Domain entity:
Previous state:
New state:
Domain event:
Event version:

Consumers:
- Customer Mobile
- Customer Web
- Partner Mobile
- Partner Web
- Rider Mobile
- Admin Web
- Staff/Operations
- Realtime
- Push
- Email/SMS
- Audit

Shared packages:
- @lunara/types
- @lunara/validation
- @lunara/hooks
- @lunara/ui
- @lunara/utils
- @lunara/brand

Failure cases:
- Unauthorized
- Invalid transition
- Duplicate request
- Duplicate event
- Offline
- Timeout
- Stale version
- Missing proof
- External integration failure
```

Do this before making implementation changes.

------------------------------------------------------------------------

# 5. Cross-app change matrix

For meaningful domain events, maintain or derive a matrix like:

  ---------------------------------------------------------------------------------------------
  Event               Customer   Partner    Rider      Admin      Staff      Push
  ------------------- ---------- ---------- ---------- ---------- ---------- ------------------
  ORDER_CREATED       View       Receive    ---        Monitor    Monitor    Partner

  PICKUP_ASSIGNED     Track      View       Action     Monitor    ---        Customer/Rider

  ORDER_PICKED_UP     Update     Update     Complete   Update     Monitor    Customer

  ORDER_PROCESSING    Update     Action     ---        Monitor    ---        Customer

  ORDER_READY         Update     Action     Delivery   Monitor    ---        Customer/Partner
                                            task                             

  DELIVERY_ASSIGNED   Track      View       Action     Monitor    ---        Customer/Rider

  ORDER_DELIVERED     Complete   Complete   Complete   Update     Monitor    Customer

  ORDER_DELAYED       Notify     Action     Action     Escalate   Escalate   Affected actors

  PAYMENT_FAILED      Action     View       ---        Monitor    Support    Customer
  ---------------------------------------------------------------------------------------------

Do not assume every event affects every application. Explicitly
determine the affected consumers.

------------------------------------------------------------------------

# 6. Shared contracts

Use the existing shared package architecture rather than redefining
domain contracts inside individual apps.

For example:

``` ts
export type OrderStatus =
  | "pending"
  | "scheduled"
  | "assigned"
  | "picked_up"
  | "processing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
```

Events should have shared contracts where appropriate:

``` ts
export interface OrderPickedUpEvent {
  type: "ORDER_PICKED_UP";
  version: number;
  orderId: string;
  customerId: string;
  partnerId: string;
  riderId: string;
  occurredAt: string;
  correlationId: string;
}
```

Do not create separate incompatible interpretations in:

``` text
customer-mobile
partner-mobile
rider-mobile
admin-web
```

When a shared type changes, search all consumers before modifying
behavior.

Search for:

``` text
OrderStatus
order.status
status ===
status:
event type
event handlers
notification mappings
socket handlers
```

------------------------------------------------------------------------

# 7. Event envelope and traceability

Prefer a standard event envelope:

``` ts
export interface DomainEvent<TType, TPayload> {
  id: string;
  type: TType;
  version: number;

  aggregateType: string;
  aggregateId: string;

  occurredAt: string;

  actor: {
    type: "customer" | "partner" | "rider" | "staff" | "admin" | "system";
    id: string;
  };

  correlationId: string;
  causationId?: string;

  payload: TPayload;
}
```

Important concepts:

-   `id` --- unique event ID for idempotency
-   `version` --- contract evolution
-   `aggregateId` --- commonly the order ID
-   `actor` --- who caused the event
-   `correlationId` --- traces the entire business workflow
-   `causationId` --- identifies the event/command that caused the
    current event

Do not add fields blindly if the repository already has an established
event contract. Inspect the codebase first and extend existing
conventions.

------------------------------------------------------------------------

# 8. State machines

Treat important workflows as explicit state machines.

For an order, inspect the repository's authoritative statuses before
introducing or changing states.

Conceptually:

``` text
PENDING
  ↓
SCHEDULED
  ↓
ASSIGNED
  ↓
PICKED_UP
  ↓
RECEIVED
  ↓
PROCESSING
  ├── WASHING
  ├── DRYING
  └── FOLDING
        ↓
      READY
        ↓
OUT_FOR_DELIVERY
        ↓
DELIVERED
```

For each transition define:

``` text
allowed actors
required data
authorization rules
previous-state constraints
side effects
domain event
notifications
realtime updates
audit requirements
recovery behavior
```

Do not duplicate transition rules across clients.

------------------------------------------------------------------------

# 9. Realtime synchronization

Lunara uses Socket.io for realtime behavior.

Treat realtime as a projection mechanism, not as the source of truth.

Preferred flow:

``` text
API/domain
   ↓
persist authoritative state
   ↓
emit domain event
   ↓
publish realtime projection
   ↓
active clients reconcile
```

A client should be able to recover by refetching authoritative state.

Never make the application permanently dependent on receiving one socket
message.

------------------------------------------------------------------------

# 10. Push notifications

Push and realtime are separate concerns.

Use:

``` text
Domain Event
  ├── Realtime projection
  ├── Push notification
  ├── Email/SMS where required
  └── Audit
```

Realtime is primarily for active sessions.

Push is for background/inactive sessions.

Notification content must derive from authoritative domain state. Do not
let individual clients invent notification semantics.

------------------------------------------------------------------------

# 11. Idempotency

Assume requests and events can be duplicated.

For example:

``` text
ORDER_PICKED_UP
ORDER_PICKED_UP
```

must not cause:

``` text
two state transitions
two notifications
two assignments
two audit records
```

Use the repository's existing idempotency infrastructure where
available.

At minimum, event consumers must recognize processed event IDs or
equivalent durable deduplication keys.

Webhook-driven payment/reconciliation flows require the same discipline.

------------------------------------------------------------------------

# 12. Event ordering and stale state

Events can arrive late or out of order.

Do not blindly apply:

``` text
ORDER_DELIVERED
ORDER_PICKED_UP
```

after delivery has already been established.

Use the repository's aggregate/version/sequence strategy if one exists.

When none exists, flag the gap explicitly rather than inventing an
incompatible infrastructure layer.

------------------------------------------------------------------------

# 13. Offline rider behavior

Rider mobile is designed to tolerate poor connectivity.

Any rider mutation that can occur offline must define:

``` text
LOCAL_PENDING
SYNCING
SYNCED
FAILED
CONFLICT
```

Never display a server-confirmed state when only a local command has
been recorded.

Preferred model:

``` text
Rider action
  ↓
Persist local intent
  ↓
UI: Pending sync
  ↓
Network restored
  ↓
Send command
  ↓
Server validates
  ↓
Server persists
  ↓
Event emitted
  ↓
All consumers reconcile
```

Do not silently discard offline mutations.

------------------------------------------------------------------------

# 14. Physical handoff integrity

Treat these as high-integrity operations:

``` text
PICKUP_CONFIRMED
PARTNER_RECEIVED
TRANSFER_CONFIRMED
DELIVERY_CONFIRMED
```

Where applicable, preserve:

``` text
actor
timestamp
order
proof
location
previous state
new state
correlation ID
```

Proof-of-pickup and proof-of-delivery are not cosmetic UI features. They
are part of the platform's accountability model.

------------------------------------------------------------------------

# 15. Permissions

Authorization belongs to the backend.

The UI may hide unavailable actions, but the API must enforce
authorization.

For each command verify:

``` text
Who is the actor?
Are they authenticated?
Are they authorized?
Are they assigned to this order?
Are they in the correct partner/territory scope?
Is the order in a valid state?
Is required proof/data present?
```

Never trust client-provided ownership or role information.

------------------------------------------------------------------------

# 16. Cache and query invalidation

For every mutation, identify affected cached projections.

Example:

``` text
ORDER_READY
```

may affect:

``` text
customer.activeOrder
customer.orders

partner.orderQueue
partner.orderDetails

rider.availableTasks

admin.liveOrders
admin.metrics
```

Use the repository's established query-key/cache conventions.

Do not create ad-hoc invalidation logic in every app.

------------------------------------------------------------------------

# 17. Observability

Important workflow operations should be traceable with:

``` text
correlationId
eventId
orderId
actorId
actorType
previousState
newState
eventType
timestamp
application
```

The desired diagnostic story is:

``` text
correlationId=ord_abc123

rider-mobile
  ↓ CONFIRM_PICKUP

api
  ↓ ORDER_PICKED_UP

customer-mobile ✓
partner-mobile ✓
admin-web ✓
push ✓
socket ✓
audit ✓
```

When something fails, operations should be able to determine where
propagation stopped.

------------------------------------------------------------------------

# 18. Failure and recovery

Do not unnecessarily couple business state to secondary side effects.

Example:

``` text
Order state = PICKED_UP ✓
Push notification = FAILED
```

The order should remain picked up if that is the authoritative
successful transition.

Retry the failed side effect according to existing infrastructure.

Distinguish:

``` text
business failure
```

from:

``` text
side-effect delivery failure
```

------------------------------------------------------------------------

# 19. Cross-app implementation order

For workflow-changing features, prefer:

``` text
1. Discover existing architecture
2. Identify authoritative domain model
3. Define/confirm state transition
4. Define/confirm command
5. Define/confirm domain event
6. Update shared contracts
7. Implement backend mutation
8. Implement event/realtime propagation
9. Implement notification policy
10. Implement each affected client
11. Implement offline/recovery behavior
12. Update observability/audit
13. Add cross-app tests
14. Run affected-package checks
15. Verify the complete golden path
```

Do not begin by patching a single client and discovering downstream
requirements afterward.

------------------------------------------------------------------------

# 20. Golden-path testing

The canonical end-to-end workflow is:

``` text
CUSTOMER
  ↓ Book
ORDER CREATED
  ↓
PARTNER
  ↓ Accept
RIDER ASSIGNED
  ↓
RIDER
  ↓ Pickup
ORDER PICKED UP
  ↓
PARTNER
  ↓ Process
Washing → Drying → Folding
  ↓
ORDER READY
  ↓
RIDER
  ↓ Delivery
ORDER DELIVERED
  ↓
CUSTOMER
  ↓ Complete
```

At every transition verify:

``` text
state
event
authorization
consumer updates
realtime
notifications
cache
audit
failure behavior
```

------------------------------------------------------------------------

# 21. Required acceptance criteria

For a rider pickup feature, for example:

``` text
GIVEN a rider has an assigned pickup

WHEN the rider confirms pickup with valid proof

THEN the API validates the transition

AND the order becomes PICKED_UP

AND the customer mobile app reflects PICKED_UP

AND customer web reflects PICKED_UP

AND partner mobile reflects the new state

AND partner web reflects the new state

AND admin reflects the new state

AND the rider sees the task as completed

AND the appropriate customer notification is generated

AND active realtime clients reconcile

AND refresh/re-login preserves the state

AND duplicate confirmation is safely handled

AND audit information is recorded
```

Negative cases must include, where applicable:

``` text
unauthorized actor
wrong rider
wrong partner
invalid transition
cancelled order
missing proof
invalid proof
duplicate request
duplicate event
offline
timeout
stale version
external integration failure
```

------------------------------------------------------------------------

# 22. Technical dependency graph versus business workflow graph

Turborepo dependency analysis answers:

> What imports what?

Business workflow analysis answers:

> Who depends on this event happening?

You need both.

Technical:

``` text
customer-mobile
  ↓
@lunara/types
@lunara/ui
@lunara/hooks
  ↓
api
```

Business:

``` text
Customer
  ↓
Order
  ↓
Partner
  ↓
Rider
  ↓
Partner
  ↓
Customer

       ↘ Admin
       ↘ Staff
       ↘ Notifications
```

Never assume a technical dependency graph captures business impact.

------------------------------------------------------------------------

# 23. Monorepo change protocol

When a task changes:

``` text
apps/rider-mobile
```

inspect:

``` text
apps/api
apps/customer-mobile
apps/customer-web
apps/partner-mobile
apps/partner-web
apps/admin-web
packages/types
packages/validation
packages/hooks
packages/ui
packages/utils
```

Not every task will require changes in every location.

The goal is not to modify every app.

The goal is to **prove which apps are affected and which are not**.

Use repository search and package dependency information to discover
consumers.

------------------------------------------------------------------------

# 24. PR checklist

Every workflow-changing PR should document:

``` md
## Business capability

## Actor

## Command

## Domain entity

## State transition

## Domain event

## Event version

## Affected applications
- [ ] Customer Mobile
- [ ] Customer Web
- [ ] Partner Mobile
- [ ] Partner Web
- [ ] Rider Mobile
- [ ] Admin Web
- [ ] Staff / Operations

## Shared packages
- [ ] types
- [ ] validation
- [ ] hooks
- [ ] UI
- [ ] utils
- [ ] brand

## Side effects
- [ ] Realtime
- [ ] Push
- [ ] Email/SMS
- [ ] Audit
- [ ] Analytics/metrics where applicable

## Reliability
- [ ] Idempotency
- [ ] Ordering/version handling
- [ ] Offline behavior
- [ ] Retry/recovery

## Tests
- [ ] Backend
- [ ] Contract
- [ ] Client consumer
- [ ] Realtime
- [ ] Notification
- [ ] Cross-app E2E
- [ ] Failure paths
```

------------------------------------------------------------------------

# 25. Definition of done

A workflow-changing feature is complete only when:

``` text
Business requirement
      ↓
Domain model
      ↓
State transition
      ↓
Backend command
      ↓
Domain event
      ↓
Customer projection
      ↓
Partner projection
      ↓
Rider projection
      ↓
Admin/staff projection
      ↓
Realtime
      ↓
Notifications
      ↓
Offline/recovery
      ↓
Audit/observability
      ↓
Cross-app E2E tests
```

Do not mark a feature complete merely because:

-   a button works
-   one API endpoint returns 200
-   one mobile screen renders
-   TypeScript compiles
-   one app's unit tests pass

The acceptance unit is the **business workflow**.

------------------------------------------------------------------------

# 26. Working example

If the request is:

> "Update rider mobile so riders can confirm pickup."

Immediately reason:

``` text
Actor:
Rider

Command:
CONFIRM_PICKUP

Entity:
Order + Pickup + Proof

Transition:
ASSIGNED → PICKED_UP

Event:
ORDER_PICKED_UP

Consumers:
Customer
Partner
Admin
Rider

Side effects:
Customer push
Realtime updates
Audit
Cache invalidation

Reliability:
Duplicate-safe
Offline-aware
Server-confirmed

Tests:
Rider → API → Customer
Rider → API → Partner
Rider → API → Admin
Notification
Realtime
Duplicate
Offline
Refresh/re-login
```

Then inspect the repository for the existing implementation and
conventions before creating new abstractions.

------------------------------------------------------------------------

# 27. Final rule

**Never ship an app feature. Ship a business workflow.**

The engineering unit is:

``` text
BUSINESS WORKFLOW
      │
      ├── Domain State
      ├── Commands
      ├── Domain Events
      ├── Permissions
      ├── Consumers
      │    ├── Customer
      │    ├── Partner
      │    ├── Rider
      │    └── Admin/Staff
      ├── Realtime
      ├── Notifications
      ├── Offline behavior
      ├── Audit
      ├── Recovery
      └── Tests
```

The success criterion is:

> **Every affected actor sees the correct reality of the same business
> event, regardless of which Lunara application caused it.**
