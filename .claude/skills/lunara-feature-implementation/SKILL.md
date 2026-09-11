---
name: lunara-feature-implementation
description: Implement Lunara features end-to-end across backend, shared contracts, partner/admin/customer/rider apps, with special attention to cross-app wiring, permissions, state consistency, tests, and operational readiness. Use this skill whenever adding or changing a product capability, especially workflows that span employees, laundry attendants, riders, orders, partner operations, or dashboards.
---

# Lunara Feature Implementation Skill

## Mission

Implement product features as **vertical slices across the whole Lunara system**, not as isolated UI or API changes.

Lunara is a Turborepo + npm-workspaces monorepo with a NestJS/MongoDB API, Next.js web apps, Expo/React Native mobile apps, and shared `@lunara/*` packages. The platform is intentionally one coordinated system: the same operational event must be represented consistently for the people who create it, perform it, observe it, and administer it.

A feature is **not complete** when one screen works. It is complete when:

- the domain model and business rules are correct;
- the API is implemented and protected;
- shared types/validation/contracts are updated;
- every affected persona can perform or observe the workflow;
- partner/admin dashboards are wired where operational visibility is required;
- realtime/cache/state behavior is correct;
- loading, empty, error, offline, and permission states are handled;
- tests cover the business-critical paths;
- existing behavior remains compatible;
- documentation is updated when the feature changes an operational contract.

## Core Principle

> **Trace the feature through the system before writing code.**

Use this sequence:

```text
Requirement
  ↓
Business rules
  ↓
Actors / permissions
  ↓
Domain model
  ↓
API / persistence
  ↓
Shared types + validation
  ↓
Queries / mutations / realtime events
  ↓
Web + mobile consumers
  ↓
Partner/Admin operational visibility
  ↓
Tests
  ↓
Verification
```

Do not start by creating a page or component.

---

# 1. Start With Repository Reconnaissance

Before changing code, inspect the repository.

Identify:

```text
apps/
  api
  customer-web
  admin-web
  partner-web
  ai-agents
  customer-mobile
  partner-mobile
  rider-mobile

packages/
  brand
  config
  hooks
  types
  ui
  utils
  validation
```

Confirm the actual current structure from the repository rather than assuming paths.

For the feature, find:

1. Existing domain models/entities/schemas.
2. Existing controllers/routes.
3. Existing services/use cases.
4. Existing auth/role/permission guards.
5. Existing shared types.
6. Existing validation schemas.
7. Existing API client/query hooks.
8. Existing dashboard pages and navigation.
9. Existing realtime/socket patterns.
10. Existing tests for adjacent functionality.

Prefer extending existing patterns over creating parallel architecture.

## Search Strategy

Search by:

- domain nouns;
- existing enum values;
- API route names;
- related UI labels;
- Mongo/Mongoose model names;
- shared types;
- permission constants;
- dashboard metrics;
- existing tests.

For example, for employee attendance search for:

```text
employee
attendant
rider
staff
shift
attendance
clock
check-in
check-out
partner
dashboard
```

Also inspect related order/assignment workflows because attendance can affect operational availability.

---

# 2. Convert the Request Into a Feature Contract

Before implementation, write down the feature contract.

Use:

```text
Feature:
Why:
Actors:
Primary actor:
Secondary observers:
Preconditions:
State transitions:
Business rules:
Permissions:
Persistence:
API:
Realtime effects:
Dashboard effects:
Mobile effects:
Web effects:
Failure states:
Audit requirements:
Tests:
```

If any item is unknown, investigate the codebase before inventing a new convention.

## Example: Employee Attendance

Potential actors:

```text
Partner Owner/Admin
  → manages employee attendance policy and views records

Laundry Attendant
  → clocks in/out

Rider
  → clocks in/out

Platform Admin
  → may need network-level visibility depending on existing authorization rules
```

Do not assume that "employee" means one universal workflow. Determine whether attendants and riders already have distinct user/role/domain models.

---

# 3. Model the Domain Before the UI

Determine whether the feature belongs to an existing aggregate or requires a new domain model.

For attendance, explicitly answer:

- Is attendance attached to a user, employee profile, partner, or employment record?
- Can one user work for multiple partners?
- Can riders belong to a partner?
- Is attendance per day, per shift, or per work session?
- Can a user have multiple sessions in one day?
- What timezone defines the workday?
- What happens if the user forgets to clock out?
- Can an owner/admin edit attendance?
- Are edits audited?
- What happens while offline?
- Is location required or optional?
- Is device information stored?
- Can attendance overlap?
- What is the source of truth for "currently working"?

Do not create fields merely because they are convenient for the UI.

Prefer explicit domain states where they matter.

Example conceptual model:

```text
AttendanceRecord
  employeeId
  partnerId
  role
  workDate
  clockInAt
  clockOutAt
  status
  source
  notes
  createdAt
  updatedAt
```

The exact schema must follow existing Lunara conventions.

---

# 4. Establish Invariants

Every feature should have explicit invariants.

For attendance, examples:

```text
- Only an eligible employee can clock in.
- A user cannot have two active attendance sessions.
- Clock-out cannot occur before clock-in.
- A completed record cannot silently be reopened.
- Partner users can only access employees belonging to their partner.
- Role permissions are enforced server-side.
- Duplicate requests must not create duplicate sessions.
- Dates/times must have a defined timezone policy.
```

Treat invariants as backend business rules, not frontend assumptions.

If an invariant is important enough to describe, it should normally have a test.

---

# 5. Implement Backend First

For a backend feature, follow the existing NestJS architecture.

Typical flow:

```text
Controller
  ↓
Auth / Role / Permission guard
  ↓
DTO / Validation
  ↓
Service / Use Case
  ↓
Repository / Mongoose Model
  ↓
Domain result
  ↓
Realtime event / side effect
```

Do not put business rules into controllers.

Do not rely on frontend validation for authorization or invariants.

## API Checklist

For every endpoint determine:

- HTTP method;
- route;
- authenticated roles;
- partner/territory scope;
- request DTO;
- validation;
- response shape;
- error semantics;
- idempotency requirements;
- pagination/filtering;
- sorting;
- realtime events;
- audit logging;
- tests.

Prefer existing API conventions and response wrappers.

---

# 6. Update Shared Contracts

If the feature introduces or changes a domain concept, inspect:

```text
packages/types
packages/validation
packages/hooks
packages/utils
```

Do not duplicate domain types independently in each app.

Example:

```text
API DTO / domain result
        ↓
shared type
        ↓
web hooks + mobile hooks
        ↓
UI
```

If an enum or status exists in the backend and is consumed by clients, determine the existing source-of-truth strategy before adding another copy.

Validation should be reusable where practical.

---

# 7. Wire Every Affected Persona

Ask:

> Who performs the action, who needs to observe it, and who needs to manage it?

For every feature create an impact matrix.

Example:

| Surface | Performs | Observes | Manages |
|---|---:|---:|---:|
| Partner Mobile | Yes | Yes | Maybe |
| Partner Web | No | Yes | Yes |
| Rider Mobile | Yes | Yes | No |
| Admin Web | No | Yes | Yes |
| Customer | Usually no | Only if relevant | No |

Never assume a backend feature is complete because the originating app works.

## Mandatory Cross-App Check

For each new feature, explicitly inspect:

```text
apps/api
apps/partner-web
apps/partner-mobile
apps/rider-mobile
apps/admin-web
apps/customer-web
apps/customer-mobile
packages/types
packages/validation
packages/hooks
packages/ui
```

Not every feature needs changes in every location, but each should be consciously classified as:

```text
CHANGED
UNCHANGED — verified not affected
NOT APPLICABLE — documented reason
```

---

# 8. Partner Dashboard Is a First-Class Integration Point

For operational features, always ask:

> "What does the partner need to see or do from the dashboard?"

This is especially important for employee, rider, attendance, order, staffing, inventory, and financial features.

For example, attendance may require:

```text
Partner Dashboard
  ├── Employee / Team
  │     ├── Current status
  │     ├── Clocked in
  │     ├── Clocked out
  │     └── Attendance history
  │
  ├── Operations overview
  │     ├── Attendants working
  │     ├── Riders working
  │     └── Staffing exceptions
  │
  └── Attendance management
        ├── Filters
        ├── Date range
        ├── Employee
        ├── Role
        └── Corrections / audit
```

Do not automatically add dashboard widgets just because data exists. Add operational surfaces that support an actual partner job.

---

# 9. Realtime and State Synchronization

Lunara uses realtime updates and multiple clients.

For state-changing features, determine:

```text
Mutation
  ↓
Persistence
  ↓
Realtime event
  ↓
Affected clients
  ↓
Cache/state invalidation
  ↓
UI update
```

Avoid creating a situation where:

```text
Partner mobile says "clocked in"
Partner web says "clocked out"
Admin says "unknown"
```

If realtime is not necessary, explicitly decide why polling/refetching is sufficient.

For optimistic updates, define rollback behavior.

For offline-capable rider workflows, define:

```text
offline action
  ↓
local pending state
  ↓
retry
  ↓
idempotent server mutation
  ↓
reconciliation
```

Never make an offline-capable workflow depend on an unrepeatable mutation.

---

# 10. Design States Before Screens

Every feature must account for:

```text
Initial
Loading
Loaded
Empty
Submitting
Success
Validation error
Authorization error
Conflict
Network error
Offline
Retry
Stale data
Unexpected server error
```

For attendance specifically:

```text
Not clocked in
Clocked in
Clocking in
Clocking out
Clocked out
Already active elsewhere
Offline pending
Sync failed
Unauthorized
```

The UI should derive presentation from domain state rather than inventing independent status logic.

---

# 11. Design for Idempotency

Any action that can be retried must be safe to retry.

Examples:

```text
POST /attendance/clock-in
POST /attendance/clock-out
```

If the mobile app retries because the network is unstable, the server must not create duplicate attendance sessions.

Use the repository's existing idempotency conventions if available.

If none exist, document the chosen strategy before implementing a high-value workflow.

---

# 12. Authorization Is Multi-Dimensional

Do not check only:

```text
role === "partner_admin"
```

Also verify data ownership/scope.

For partner operations:

```text
authenticated user
  ↓
authorized role
  ↓
authorized partner
  ↓
authorized employee/resource
```

A partner user must never be able to access another partner's attendance records merely by changing an ID in the URL.

Test authorization failures explicitly.

---

# 13. Dashboard and Reporting APIs Must Be Operationally Correct

Do not make dashboards reconstruct complex business state from raw records in the browser if the backend already owns that logic.

Prefer purpose-built query/read models when needed:

```text
GET /partners/me/employees/attendance
GET /partners/me/attendance/summary
```

rather than forcing the UI to:

```text
fetch all employees
fetch all attendance records
join everything
calculate status
calculate totals
```

Keep authorization and business calculations server-side where appropriate.

Use pagination and filtering for potentially large datasets.

---

# 14. Tests Must Follow the Vertical Slice

At minimum, add tests at the layers that protect the feature's invariants.

## Backend

Test:

```text
happy path
validation
authorization
partner isolation
duplicate request
invalid state transition
not found
conflict
```

## Frontend

Test:

```text
correct data rendering
loading
empty
error
permission-sensitive actions
successful mutation
failed mutation
state refresh
```

## Integration / E2E

For high-value operational workflows, verify the actual journey:

```text
employee clocks in
  ↓
API persists attendance
  ↓
partner dashboard reflects active status
  ↓
employee clocks out
  ↓
dashboard reflects completed session
```

If realtime is part of the feature, test the realtime update path too.

---

# 15. Do Not Break Existing Workflows

Before implementation identify adjacent flows.

For attendance, inspect:

```text
employee management
partner team management
rider assignment
rider availability
order dispatch
partner dashboard metrics
user roles
partner permissions
notifications
```

A new attendance status may affect rider availability or staffing logic.

Do not silently change semantics such as:

```text
online
available
active
clocked in
assigned
on duty
```

These are not automatically interchangeable.

If the existing system has an availability concept, determine whether attendance should feed it or remain independent.

---

# 16. UI Implementation Rules

Use the existing shared design system.

Prefer:

```tsx
<AttendanceStatus status={status} />
<AttendanceSummary summary={summary} />
<EmployeeAttendanceRow employee={employee} />
```

over duplicated styling and domain logic in screens.

Follow existing:

```text
@lunara/ui
@lunara/brand
@lunara/types
@lunara/validation
```

White-label considerations must remain intact.

Do not hard-code partner branding into feature components.

---

# 17. Feature Completion Checklist

Before declaring a feature complete, verify:

### Discovery
- [ ] Existing related models found.
- [ ] Existing related APIs found.
- [ ] Existing role/permission model understood.
- [ ] Existing UI patterns found.
- [ ] Existing realtime/state patterns found.

### Domain
- [ ] Actors defined.
- [ ] Business rules defined.
- [ ] State transitions defined.
- [ ] Invariants defined.
- [ ] Ownership/scope defined.
- [ ] Timezone semantics defined where relevant.

### Backend
- [ ] Model/schema updated.
- [ ] DTO/validation implemented.
- [ ] Service/use case implemented.
- [ ] Authorization implemented.
- [ ] Partner isolation enforced.
- [ ] Idempotency considered.
- [ ] Errors handled consistently.
- [ ] Realtime event added if required.
- [ ] Audit requirements handled.

### Shared
- [ ] Shared types updated.
- [ ] Shared validation updated.
- [ ] Shared hooks/API clients updated where applicable.
- [ ] No duplicated domain contracts introduced.

### Apps
- [ ] Performing persona can use the feature.
- [ ] Partner dashboard is wired if operationally relevant.
- [ ] Admin surface is wired if operationally relevant.
- [ ] Rider surface is wired if relevant.
- [ ] Customer surface is wired if relevant.
- [ ] Mobile states handled.
- [ ] Web states handled.
- [ ] Offline behavior handled where required.

### UX
- [ ] Loading state.
- [ ] Empty state.
- [ ] Error state.
- [ ] Permission state.
- [ ] Conflict state.
- [ ] Success feedback.
- [ ] Retry behavior.
- [ ] Accessibility considered.

### Verification
- [ ] Unit tests.
- [ ] Service/API tests.
- [ ] Authorization tests.
- [ ] UI tests where appropriate.
- [ ] Integration/E2E path where appropriate.
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Relevant builds pass.
- [ ] No unrelated regressions.

---

# 18. Required Implementation Output

When using this skill, report implementation progress in this format:

```text
## Feature
<name>

## Impact
<short description>

## Architecture
- Backend:
- Shared contracts:
- Partner:
- Rider:
- Admin:
- Customer:
- Realtime:
- Persistence:

## Business Rules
1.
2.
3.

## Files Changed
- path — reason
- path — reason

## Cross-App Wiring
- Partner web: ...
- Partner mobile: ...
- Rider mobile: ...
- Admin web: ...
- Customer web/mobile: ...

## Tests
- ...

## Verification
- Typecheck: PASS/FAIL
- Lint: PASS/FAIL
- Tests: PASS/FAIL
- Build: PASS/FAIL

## Remaining Risks
- ...
```

Never report a feature as complete if an affected surface has not been verified.

---

# 19. Example: Attendance for Laundry Attendants and Riders

Treat this as an example of the workflow, not as a fixed schema.

## Requirement

"Implement attendance for employees, including laundry attendants and riders, and wire it into the partner dashboard."

First decompose it:

```text
Attendance
├── Identity
│   ├── employee
│   ├── partner
│   └── role
│
├── Actions
│   ├── clock in
│   └── clock out
│
├── Records
│   ├── current session
│   └── historical sessions
│
├── Partner operations
│   ├── active employees
│   ├── attendance history
│   └── corrections
│
└── Visibility
    ├── partner mobile
    ├── partner web
    ├── rider mobile
    └── admin if required
```

Then inspect whether "rider" already has a separate user lifecycle.

Do not assume a rider is equivalent to a laundry attendant merely because both are employees.

## Suggested vertical slice

```text
1. Define attendance domain
2. Add persistence
3. Add clock-in/out API
4. Add authorization
5. Add shared types
6. Add mobile mutation/query hooks
7. Add employee-facing UI
8. Add partner dashboard attendance query
9. Add partner dashboard UI
10. Add realtime synchronization
11. Add tests
12. Verify end-to-end
```

## Critical cross-system question

Determine whether:

```text
clocked in
```

should imply:

```text
available for rider assignment
```

or:

```text
available for laundry operations
```

Do not make that coupling unless the product/domain rules explicitly require it.

Attendance answers:

> "Is this employee working?"

Availability answers:

> "Can this employee receive work right now?"

They may be related, but they are not inherently the same state.

---

# 20. Definition of Done

A Lunara feature is done when the **system behavior**, not merely the implementation, is complete.

The final question is:

> Can the intended user perform the workflow, can the responsible operator see/manage it, does every affected app remain consistent, and are the business invariants protected by the backend and tests?

If the answer is no, keep tracing the feature.

## Non-Negotiable Rule

**Never implement a feature in only the app where the request first appears.**

For Lunara, always trace:

```text
Domain
→ API
→ Shared contracts
→ Originating app
→ Partner operational surface
→ Other affected personas
→ Realtime/state
→ Tests
```

That is the standard for production-ready feature implementation.
