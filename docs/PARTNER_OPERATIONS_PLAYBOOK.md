# Partner Operations Playbook

End-to-end guide for shop partners running their laundry business on the Lunara platform — from getting an account to daily order fulfillment, catalog management, staff, and payouts. For the pricing formula in detail, see [`PARTNER_PRICING_GUIDE.md`](./PARTNER_PRICING_GUIDE.md); for settlement mechanics, see [`platform-commission.md`](./platform-commission.md).

---

## 1. Getting your account

There's no self-signup — a Lunara admin creates your account and your shop's **main branch** together in one step. You'll receive:
- Your login email and a temporary password (share these securely — there's no first-login checklist screen, you land straight on your dashboard)
- Your first branch, already set as your **main shop** automatically

Log in at your partner-web login page. From there, you'll want to visit **Settings** to configure your shop's hours, machines, and payout method, and **Services** to review/customize your pricing — nothing is force-walked, so don't skip these.

> **Multiple branches**: if you run more than one location, each additional branch is created by admin under your account (see admin's Branches page) and marked as a branch variant of your one main shop — not a separate "shop." Note: pages like Services and Staff require you to pick which branch you're managing from a dropdown each time; there's no persistent branch switcher, so double-check you're on the right branch before editing pricing or adding staff.

---

## 2. Daily order fulfillment — the Staff Board

Your order pipeline (**Orders → Board**) has four columns, in order:

| Stage | What it means | Your action |
|---|---|---|
| **1. Accept** | New orders Lunara has assigned to you | **Accept order** |
| **2. Receive & verify** | Laundry en route or arriving at your shop | **Receive at shop** (opens the receiving flow) |
| **3. Process** | Sorting, washing, drying, folding, ironing (optional), quality check | **Accept job**, then **Advance stage** through each step |
| **4. Request delivery** | Ready to go back to the customer | **Request delivery** |

Every card also has an **Open** link to the full order detail.

**If you have staff**, a processing job someone else has claimed shows "Assigned to {their email}" and your Advance-stage button is disabled unless you're that staff member (or you're the partner owner — owners can always act). This prevents two people accidentally working the same order.

**Receiving note**: if you've turned on **"Require weight verification on receive"** in Settings, the receiving step will require you to confirm the actual weight before moving the order forward.

The board updates live via websocket — you don't need to manually refresh to see new orders land.

---

## 3. Managing your pricing & catalog

Go to **Services** → pick the branch you're editing (only shown if you have more than one).

- **Base service prices** (per kg, per service type) and **add-on prices** — edit inline, saved on submit. Customers pay your price plus Lunara's markup on add-ons; by default the base wash service uses a flat platform-wide bag price regardless of your per-kg rate, but if your shop is switched to per-kilo or per-load mode you set your own base wash price — see [`PARTNER_PRICING_GUIDE.md`](./PARTNER_PRICING_GUIDE.md) for exactly how that works.
- **Hide a built-in service/add-on** you don't offer — toggle it off; it's hidden, not deleted, so you can bring it back later.
- **Add a custom service or add-on** — your own item at your own price, managed separately from the standard catalog (its own add/delete, not part of the bulk pricing save).

---

## 4. Inventory

If inventory tracking is enabled for your shop (Settings → Preferences → **Inventory tracking**), the **Inventory** page tracks supplies by category (detergent, supplies, maintenance, or your own categories). Each item shows a status:
- **Out** — zero quantity
- **Low** — below its threshold (or flagged low manually)
- **OK**

Edit quantity and low-stock threshold inline. Turn on **"Notify on low stock"** in Settings to get alerted automatically instead of checking manually.

---

## 5. Staff

**Staff** page → **Add staff**: email and a password (min 8 characters, confirmed twice) are required; phone (min 10 characters if provided) and display name are optional. If you have more than one branch, you must also pick which branch this staff member works at.

You can reassign a staff member to a different branch at any time from the same page. The stats bar shows how many staff are active, total active jobs across your team, and flags anyone currently juggling more than 3 active jobs as "busy" — useful for spotting when you need to redistribute work.

---

## 6. Refunds

Refunds are **admin-only** — you won't see a refunds page in partner-web, and there's no partner action to initiate or approve one. If a customer disputes an order, it's handled through Lunara support and admin tooling; you'll see the outcome reflected in your order history and revenue, not as something you action yourself.

---

## 7. Revenue & settlements

- **Revenue** page — your day-by-day earnings chart and a list of recent orders, filterable by All / Cash / Digital payment. Cash orders show whether cash has actually been collected yet. **Export** gives you a CSV. The copy is explicit: *amounts shown are your payout after Lunara's processing*, not the raw order total.
- **Settlements** page — your batched payouts. Each settlement row expands to show the individual orders it covers. You can also see your current **payable balance** (what's owed but not yet settled) and your configured payout method.
- **Payout cadence**: when auto-settlement is enabled, settlements are generated **weekly, every Sunday**, via whichever method you've configured. Admins can also generate settlements manually at other times.

For exactly how the commission/fee math works, see [`platform-commission.md`](./platform-commission.md).

---

## 8. Settings — the five tabs

**Settings** page is organized into: **Shop, Hours, Machines, Preferences, Payout**.

- **Shop** — your shop's basic info/branding.
- **Hours** — your weekly operating schedule. This directly determines which pickup time slots customers are offered once they've chosen your shop, and what checkout will actually accept — keep it accurate.
- **Machines** — add/edit/remove your washers, dryers, folders, presses (label, type, capacity in kg) and mark each active/maintenance/offline.
- **Preferences**:
  - **Accepting new orders** — turn off if you need to pause new dispatch without deactivating your shop entirely.
  - **Auto-accept incoming orders** (owner-only, not shown to staff) — skips the manual "Accept order" step.
  - Notification toggles: new orders, pickup arriving, ready-for-delivery, low stock.
  - **Staff can request delivery**, **Require weight verification on receive**, **Inventory tracking** — operational switches described in their respective sections above.
- **Payout** — choose GCash, Maya, bank transfer, or personal/counter pickup, with the method-specific details (account number, etc.) needed to actually pay you.

Staff logins see Preferences as read-only ("Only shop partners can change these settings") — only the owner account can change shop-wide policy.

---

## Quick reference

| Question | Answer |
|---|---|
| How do I get more branches added? | Ask Lunara admin — new branches are created for you, marked as variants of your one main shop. |
| Why can't my staff advance an order someone else claimed? | Jobs are claimed per staff member once accepted — only that person (or you, the owner) can advance it. |
| Can I issue a refund myself? | No — refunds are admin-only. |
| When do I get paid? | Weekly, every Sunday, when auto-settlement is on (admins can also settle manually), to your configured payout method. |
| Do promo codes cost me money? | No — see [`PARTNER_PRICING_GUIDE.md`](./PARTNER_PRICING_GUIDE.md). |
| Where do I turn off new orders temporarily? | Settings → Preferences → "Accepting new orders." |

---

## Related docs

- [`PARTNER_PRICING_GUIDE.md`](./PARTNER_PRICING_GUIDE.md) — how customer pricing and your payout are calculated
- [`platform-commission.md`](./platform-commission.md) — commission/settlement mechanics in full
- [`partner-cash-reconciliation.md`](./partner-cash-reconciliation.md) — cash order handling
- [`features/laundry-services-catalog.md`](./features/laundry-services-catalog.md), [`features/laundry-addons-catalog.md`](./features/laundry-addons-catalog.md)
