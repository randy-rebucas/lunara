# Admin Operations Playbook

End-to-end guide for Lunara admin staff running the platform via admin-web — from first-time setup through daily dispatch, partner/rider management, refunds, settlements, and system configuration.

---

## 1. First-time platform setup — `/setup`

One-time gate before anything else works. Status comes from whether an HQ branch and at least one operational branch already exist.

1. **Initialize network** — set the HQ code/name (defaults `HQ-01` / "Lunara HQ") and its location. Creates the root branch every other branch attaches under.
2. **Add first operational branch** — code, name, type (partner_shop/franchise), service radius, capacity, location. This branch becomes the required "Parent branch" option when onboarding the first real partner.

Onboarding a partner (`/partners/new`) is blocked until step 2 is done — the page shows a "Requires 1+ operational branch" gate with a link back here.

---

## 2. Onboarding a partner — `/partners/new`

One form, three sections, one submit — creates the partner's login **and** their main shop branch together:

- **Account**: email, phone (optional), temporary password (min 8 chars — use "Generate" for a random one).
- **Branch**: code, name, type, parent branch (from the dropdown seeded in step 1), location. The form explicitly notes this becomes the partner's **main shop automatically** — additional branches (variants) are added later from the Branches page, not here.
- **Capacity & commission**: max active orders, max weight, commission rate % (default 20, editable 0–50 here).

Submit → "Create partner & branch". If branch creation fails for any reason, the partner account it just created is rolled back rather than left orphaned.

---

## 3. Branch/shop management — `/branches`

- **Add a branch to an existing partner**: "Show form" → code, name, type, parent branch, the partner's account (by email), location. This is how a partner gets their 2nd/3rd branch (variants of their one main shop).
- **Branch profile panel** (select a node in the tree): address, capacity tiles (order/weight capacity, daily quota, today's revenue), manager, staff list, assigned default rider, machines (read-only here — partners manage their own machines from partner-web Settings), 30-day performance.
- **Deactivate/reactivate** (non-HQ only) — confirms first, and the API will refuse if the branch still has orders in progress.
- **Assign default rider** — sets who pickups/deliveries route to automatically before falling back to broadcast.
- **Logo** — upload/remove.
- **Edit branch tab** — name, active flag, capacity limits, daily quotas, commission rate — all saved together. Blank numeric fields are skipped on save (not treated as zero), so you can't accidentally zero out someone's capacity by leaving a field empty.
- **Shop pricing tab** (partner_shop only) — per-branch overrides of the global service/add-on catalog.
- **Promote a branch to main shop** — `PATCH /admin/branches/:id/main-shop`. **No button exists for this in admin-web yet** — it's API-only for now. Use it if a partner's actual flagship location changes and you need to redesignate which branch is "main" (it will refuse to promote an inactive branch).

---

## 4. Order & dispatch management

- **`/control-tower`** — high-level monitoring dashboard (order pipeline health, capacity warnings). Not where you take action — it links out to Dispatch and Live Tracking.
- **`/dispatch`** — the actual manual assignment workspace. Pick an unassigned order, review ranked branch suggestions (recommended one flagged), and confirm assignment. You can still manually assign to a branch below the auto-dispatch quality bar if needed — the UI just flags it.
- **`/live-tracking`** — real-time fleet map of riders and in-progress orders.
- **Auto-dispatch policy** — `/automation-settings`, not `/dispatch`. Toggles (all off by default): auto-dispatch paid orders straight to the top-ranked branch, auto-assign pickup/delivery riders, auto-generate settlements, auto-approve refunds/withdrawals under a configurable ₱ threshold. Flip these on once you trust the ranking algorithm enough to stop manually confirming every assignment.

---

## 5. User & role management — `/users`

One page for all account types (customer/rider/partner/staff/admin), with a role filter and per-role counts. Beyond the basics (view, deactivate/reactivate):
- **Department** — free-text, editable inline (useful for internal staff/admin org structure).
- **Photo** — upload a profile photo per user.
- **CSV import/export** — export the current filtered list; import a CSV with a `department` column to bulk-create/update users.
- **Create partner** shortcut jumps to `/partners/new`.

---

## 6. Refunds — `/refunds` → `/refunds/[id]`

List view has status tabs: all / needs review / approved / processed / rejected / closed.

The approval flow on a refund's detail page, in order:
1. **Verify order** — confirm payment completed, amount matches, order is actually eligible. ("Mark order verified.")
2. **Start review** *(optional)* — only shown while still pending.
3. **Approve** (with an editable approved amount, defaults to what was requested) **or Reject** (with a required reason).
4. **Process refund** — enabled once approved; credits the customer's wallet.
5. **Notify customer** — tell them it's done.

Any admin with access to `/refunds` can approve — there's no separate maker/checker split visible in the UI, so treat refund approval as a trusted-role action.

---

## 7. Rider management — `/riders`, `/applications/rider/[id]`, `/riders/withdrawals`

- **Approve applications** at `/applications/rider/[id]` — approve or reject with a required reason on rejection.
- **Invite a rider directly** from `/riders` (bypasses the application flow) — email, phone, temp password, name, vehicle type. Copy reminds you the rider still needs to log in, upload KYC documents, and get approved via the applications flow before they're fully compliant to go online.
- **Send announcement** — broadcast a push notification to every rider (title + body).
- **Withdrawals** — `/riders/withdrawals` is where you approve/reject rider cash-out requests (auto-approval under a threshold is configurable in Automation Settings).

---

## 8. Promotions & catalog — `/promotions`, `/services`, `/addons`, `/categories`, `/laundry-tags`

- **Promotions** — create/manage promo codes (global, not per-branch).
- **Services** and **Addons** — the **global** catalog every branch falls back to when they haven't set their own price. A branch's own override lives on their Shop Pricing tab (see §3), not here.
- **Categories** — service categorization.
- **Laundry tags** — the physical tag inventory used during pickup/receiving, separate from pricing.

---

## 9. Settlements — `/partners/settlements`

1. Pick a partner (their branch count is shown, e.g. "3 shops").
2. **Create settlement** opens a picker of unsettled orders — each shows amount, subtotal, Lunara fee, partner payout, commission rate, payment method, and whether cash has actually been collected yet. Select all or individual orders; running totals update live.
3. Add an optional admin note, then confirm in a two-step wizard.

This can also run automatically if **auto-generate settlements** is enabled in Automation Settings, instead of you triggering it manually every period. Full fee/commission math: [`platform-commission.md`](./platform-commission.md).

---

## 10. Support & audit — `/support`, `/audit-log`

- **Support tickets** — staged workflow with a status dropdown (resolved/closed) and reply/action buttons; a ticket locks once closed.
- **Audit log** — every admin API mutation, with actor email/role, method, path, action, status code, request body, IP, and timestamp, plus quick stats (failed-request total, unique actors, top action). This is your read-only compliance trail — use it to answer "who changed what, when" questions, not to take action.

---

## 11. System settings — `/settings` and `/automation-settings`

- **`/settings`** (Operations tab): flat **delivery fee** (platform-wide, not per-shop), **rider fees** (pickup/delivery leg amounts), a quick inline **auto-dispatch** toggle, app version info, and a branches summary. Only changed sections are saved when you hit save.
- **`/automation-settings`**: the full set of auto-* policy toggles — auto-dispatch orders, auto-assign pickup/delivery riders, auto-generate settlements, auto-approve refunds (with a ₱ threshold), auto-approve withdrawals (with a ₱ threshold). Treat this page as "how much do we trust the algorithm to act without a human clicking confirm" — start conservative, loosen over time as you build confidence.

---

## Quick reference

| Question | Answer |
|---|---|
| Partner onboarding is grayed out — why? | You need at least one operational branch created via `/setup` first. |
| How do I add a 2nd branch for an existing partner? | `/branches` → "Show form" → pick their account by email. |
| How do I make a different branch a partner's "main shop"? | API-only right now: `PATCH /admin/branches/:id/main-shop` — no UI button yet. |
| Where do I turn on fully automatic dispatch? | `/automation-settings`, not `/dispatch`. |
| Who can approve refunds? | Any admin with `/refunds` access — no separate approval tier exists in the UI. |
| Where's the global catalog partners fall back to? | `/services` and `/addons` — branch-specific overrides live on each branch's Shop Pricing tab. |

---

## Related docs

- [`platform-commission.md`](./platform-commission.md) — commission/settlement math in full
- [`PARTNER_PRICING_GUIDE.md`](./PARTNER_PRICING_GUIDE.md) — customer-facing pricing formula
- [`PARTNER_OPERATIONS_PLAYBOOK.md`](./PARTNER_OPERATIONS_PLAYBOOK.md), [`RIDER_OPERATIONS_PLAYBOOK.md`](./RIDER_OPERATIONS_PLAYBOOK.md) — the other side of these same workflows
- [`rider-settlement.md`](./rider-settlement.md) — rider wallet/payout mechanics
