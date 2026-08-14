# Staff Training Guide

Onboarding and reference manual for **shop staff** (`UserRole.STAFF`) using
the Partner Web portal (`apps/partner-web`). Staff accounts are created and
managed by the shop's **partner/owner** — staff cannot self-register.

This guide is for two audiences:
- **Trainers** (partner/owner or shop manager) — use it as a script for
  onboarding a new staff member.
- **Staff** — use it as a day-to-day reference while working the floor.

---

## 1. What a staff account can and can't do

Staff accounts are scoped to a single **shop branch**. A staff member only
ever sees orders, inventory, and customers that belong to their branch —
never other branches or other partners.

| Capability | Staff | Partner/Owner |
|---|---|---|
| View/accept incoming orders for their branch | ✅ | ✅ |
| Receive laundry (weigh-in, confirm items) | ✅ | ✅ |
| Move orders through the processing pipeline | ✅ | ✅ |
| Assign shelf slots / look up bags on the shelf | ✅ | ✅ |
| Dispatch orders for delivery | ✅ | ✅ |
| View inventory & reports for their branch | ✅ | ✅ |
| **Add or manage other staff accounts** | ❌ | ✅ |
| View revenue / settlements / ledger balance | ❌ | ✅ |
| Change shop settings (hours, services, pricing) | ❌ | ✅ |

Role gating is enforced server-side (`@Roles(...)` decorators per endpoint
in `apps/api/src/modules/partner/partner.controller.ts` — staff-facing
endpoints allow PARTNER, STAFF, and ADMIN, while owner-only actions like
staff management restrict to PARTNER, and some reporting endpoints allow
PARTNER and ADMIN but not STAFF), so the UI hides actions staff shouldn't
see, and the API rejects them too.

---

## 2. Account setup (trainer walkthrough)

Only the partner/owner can create a staff account. This is done once per
new hire, before their first shift.

1. Owner signs in to Partner Web and opens **Staff team**
   (`/staff` in the portal nav).
2. Click **Add staff** and fill in:
   - **Email** — the staff member's login (required).
   - **Phone** — optional, at least 10 characters if provided.
   - **Password** — minimum 8 characters. Share this with the new hire
     through a private channel, not chat/email in the clear.
   - **Confirm password** — must match.
3. Submit. The account is created immediately and appears in the staff
   table with role `staff`, 0 active jobs, and a "member since" date.
4. Give the staff member the shop's Partner Web URL, their email, and the
   temporary password. They log in the same way the owner does — there is
   no separate staff-only URL.

There is currently no self-service "change my password" flow for staff in
this guide's scope — if a staff member forgets their password, the owner
must issue them a new account or reset it directly (see `Settings`).

**Staff team page also shows, at a glance:**
- Total team members
- Combined active jobs across all staff
- How many staff are carrying a "high workload" (more than 3 active jobs) —
  useful for the owner to rebalance assignments during a shift.

---

## 3. First login checklist

Walk a new staff member through this on their first shift:

1. **Log in** at the shop's Partner Web URL with the email/password the
   owner gave you.
2. **Orient yourself** in the left nav — as staff you'll mainly live in:
   - **Incoming orders** — new orders waiting to be accepted
   - **Processing queue** — orders currently being worked
   - **Find on shelf** — look up a bag by shelf slot or tag code
   - **Inventory** — supplies/stock for your branch
3. **Confirm your branch** — every order and lookup you see is already
   scoped to your branch. If something looks missing, it's not a filter
   you need to change; ask the owner to confirm your account's branch.
4. Do a **dry run**: open an existing order, look at its status, and walk
   the processing screen without submitting anything, just to see the
   layout before you're moving real orders.

---

## 4. Core daily workflow

This is the order-lifecycle path a staff member follows for a normal job,
end to end.

### Step 1 — Accept incoming orders
- Go to **Incoming orders** (`/orders/incoming`).
- These are orders the admin dispatcher has assigned to your shop
  (`SHOP_ASSIGNED`) that are awaiting pickup/acceptance.
- Accept the order to move it forward; you can also request pickup or
  request delivery from here when applicable.

### Step 2 — Receive the laundry
When the bag physically arrives at the shop:
1. Open the order's **Receiving** screen.
2. **Receive** — mark the bag as received at the shop.
3. **Verify weight** — enter/confirm the actual weight against what was
   booked. Flag discrepancies per shop policy before proceeding.
4. **Confirm items** — confirm the item list/count matches what's in the
   bag. This is your last checkpoint before processing starts — mismatches
   are much easier to resolve here than after washing.

### Step 3 — Assign a shelf slot
- On the order detail page, set a **shelf slot** (e.g. `A-12`) so the bag's
  physical location is tracked.
- This also stamps who assigned it and when — always do this yourself
  under your own login, don't do it on a coworker's behalf.

### Step 4 — Work the processing pipeline
Orders move through these in-shop stages (Kanban-style — staff can move an
order freely between any of the 8 stages, not strictly linearly, since
real shop floors don't always work step-by-step):

`Received → Sorting → Washing → Drying → Folding → Ironing → Quality check → Ready for delivery`

- Use **Advance** to push an order to the next expected stage, or **Move**
  to place it directly on a specific stage (e.g. sending it back to
  Washing after a quality-check failure).
- Some steps support a **photo upload** (e.g. proof of items before/after
  wash, damage documentation) and a **tag code** on the completed step —
  use tag codes consistently, since shelf lookup searches them too.

### Step 5 — Find a bag on the shelf
- Use **Find on shelf** (`/shelf-lookup`) any time — front counter, a
  customer inquiry, or a rider pickup — and search by shelf slot or tag
  code.
- As staff, results are scoped to your branch only (partner sees only
  their own orders across branches; admin sees everything).
- No match returns an empty result, not an error — double-check the code
  you're searching before assuming the bag is lost.

### Step 6 — Dispatch for delivery
- Once an order reaches **Ready for delivery**, dispatch it so the admin
  dispatcher can assign a delivery rider.

### Step 7 — Check order history
- Use **Order history** (`/orders/history`) to look up completed or
  cancelled orders for your branch if a customer calls back with a
  question.

---

## 5. Inventory

- Open **Inventory** to see supply levels for your branch (detergent,
  bags, tags, etc., depending on shop configuration).
- Staff can update inventory item quantities as they're used, so the owner
  has accurate stock visibility without doing manual counts themselves.
- If an item is critically low, flag it to the owner immediately — staff
  cannot reorder or change reorder thresholds, only report/update counts.

---

## 6. Customers & messaging

- **Customers** — staff can look up a customer's order history for their
  branch to answer questions at the counter or on the phone.
- **Messages / Notifications** — staff receive in-app notifications for
  events relevant to their branch (new orders, status changes, etc.) and
  can message through the portal's messaging module as needed. Mark
  notifications read individually or use **read all** to clear the badge
  at the start of a shift.

---

## 7. What to escalate to the owner

Staff should hand these off rather than attempt them:
- Creating/removing staff accounts, or password resets.
- Any change to shop **settings** (hours, services offered, pricing).
- Questions about **revenue, settlements, or ledger balance** — staff
  don't have visibility into these by design.
- Repeated weight/item mismatches from the same rider or customer —
  pattern issues are an owner/admin conversation, not a per-order fix.
- System errors on receiving/processing endpoints that block a whole
  batch of orders (as opposed to a single order needing a status fix).

---

## 8. Quick reference — portal pages for staff

| Page | Path | Use for |
|---|---|---|
| Incoming orders | `/orders/incoming` | Accept new assigned orders |
| Order detail | `/orders/[id]` | Receiving, shelf slot, processing, dispatch |
| Processing queue | `/orders` | Work the Kanban pipeline |
| Order history | `/orders/history` | Look up past orders |
| Find on shelf | `/shelf-lookup` | Locate a bag by slot or tag code |
| Inventory | `/inventory` | Check/update branch stock |
| Customers | `/customers` | Look up customer order history |
| Messages | `/messages` | Portal messaging |
| Notifications | `/notifications` | Branch-relevant alerts |
| Profile | `/profile` | Your own account details |

---

## 9. Security basics for staff

- Never share your login. Each staff member gets their own account so
  actions (shelf assignment, item confirmation, weight verification) are
  attributable to the person who actually did them.
- Log out on shared shop computers at the end of a shift.
- If you suspect your account or password is compromised, tell the owner
  immediately so they can issue a new account.

---

*Source references: `apps/partner-web/src/app/staff/page.tsx`,
`apps/api/src/modules/partner/partner.controller.ts`,
`apps/api/src/modules/partner/SHELF.md`,
`packages/types/src/enums.ts` (`UserRole`, `OrderStatus`).*
