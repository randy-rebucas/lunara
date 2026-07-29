# How Pricing Works for Partners

A plain-language guide to how the price a customer pays is calculated, what part of that price your shop controls, and how much you're actually paid out per order. For the settlement/commission mechanics in full technical detail, see [`platform-commission.md`](./platform-commission.md) — this guide focuses on the pricing formula itself.

---

## The short version

Every shop picks one **pricing mode** for its base wash/dry/fold service — set in your partner dashboard under Services:

| Mode | What the customer pays for the base service |
|---|---|
| **Flat bag** (default) | Lunara's standard bag-size price (₱249–₱549) — same across every shop. |
| **Per kilo** | Your price per kg × the weight confirmed when your shop receives and weighs the laundry. |
| **Per load** | Your price per machine load × the load count confirmed at weigh-in. |
| **Per piece** | Your price per item × the piece count confirmed when your shop receives the order. Useful for shoes, curtains, comforters, or other item-based services. |

```
What the customer pays = Base service (see table above)
                        + Add-ons (your price × 1.30 markup)
                        + Delivery fee (distance-tiered, platform-wide — see below)
                        − Promo discount (if any)

What you get paid       = Customer payment − Lunara's commission
```

Two things surprise most partners the first time, so we lead with them:

1. **The pricing mode is a per-shop setting, not automatic.** New shops default to flat bag pricing. If you actually charge per kilo, per load, or per piece, switch your mode in the dashboard — otherwise your rates are ignored at checkout.
2. **Per-kilo, per-load, and per-piece prices are estimates until your shop confirms the order.** The customer sees an estimated price at booking time; the real charge is calculated from the actual weight/load/piece count you enter when you receive the laundry, using the rate you had set at booking time (not any rate change you make afterward).

Details below.

---

## 1. Setting your prices

In your partner dashboard's Services page, you set:

| What you set | Where it shows up |
|---|---|
| **Pricing mode** — flat bag, per kilo, per load, or per piece | Determines how the base service is billed. Switching to a non-flat mode requires a rate set for every service you offer. |
| **Price per kg**, per service type (wash & fold, dry clean, etc.) | Used to bill the base service when your shop is in per-kilo mode; also shown to customers comparing shops. |
| **Price per load**, per service type | Used to bill the base service when your shop is in per-load mode. |
| **Price per piece**, per service type | Used to bill the base service when your shop is in per-piece mode. |
| **Add-on prices** (fabric softener, stain treatment, eco wash, express delivery, or your own custom add-ons) | Marked up 30% and charged to the customer exactly as your add-on line item, in every pricing mode. |

If you don't set a custom price for a service or add-on, your shop uses Lunara's standard catalog price for it instead — you're never left with a blank price. Custom services (your own service types beyond the standard catalog) currently require per-kilo mode.

You can also hide specific services or add-ons you don't offer, and add your own custom services/add-ons at whatever price you choose.

---

## 2. What the customer actually pays

### Base service — depends on your pricing mode

**Flat bag** (default): the customer picks a **bag size**, not a weight:

| Bag size | Capacity (reference only) | Customer price |
|---|---|---|
| Small | up to 5 kg | ₱249 |
| Medium | up to 8 kg | ₱349 |
| Large | up to 12 kg | ₱449 |
| XL | up to 15 kg | ₱549 |

These four prices are the same everywhere on the network and aren't something an individual shop sets — they're Lunara's standard pricing tiers.

**Per kilo**: the customer enters an estimated weight and sees an estimated price (`your ₱/kg rate × estimated weight`). When your shop receives and weighs the laundry, you enter the actual weight and the price is finalized against that same rate.

**Per load**: the customer enters an estimated weight or load count and sees an estimated price (`your ₱/load rate × estimated loads`). You confirm the actual load count at weigh-in and the price is finalized the same way.

**Per piece**: the customer enters an estimated piece count and sees an estimated price (`your ₱/piece rate × estimated pieces`). You confirm the actual piece count when you receive the order and the price is finalized the same way.

In per-kilo, per-load, and per-piece mode, the rate used for the final price is always the one your shop had configured at booking time, even if you change your rates afterward — so a mid-order rate change never retroactively affects an order already in progress.

### Add-ons — your price, marked up 30%

Unlike the base service, add-ons are priced directly off what you enter:

```
Customer add-on price = your base add-on price × 1.30
```

Example: if you set fabric softener at ₱30, the customer is charged ₱39 for it.

### Delivery fee

A pickup + delivery fee is added to every order, network-wide — ₱70 for the first 3 km between the customer and the assigned shop, +₱8/km beyond that. This isn't shop-specific and isn't part of your payout calculation — it funds rider pickup/delivery, not your shop's cut. Full formula and admin-tunable values: [`delivery-pricing-and-approval.md`](./delivery-pricing-and-approval.md).

### Minimum order

An order's laundry subtotal (bag price + add-ons, before delivery fee) must be at least ₱150, or checkout is blocked. In practice this only matters if a customer removes add-ons down to just a Small bag with nothing else — Small alone (₱249) already clears the minimum.

### Promo codes

Promo codes reduce what the customer pays (either a flat amount or a percentage off the subtotal + delivery fee) — they do not reduce your payout. Lunara absorbs the cost of promotions.

### Express return cutoff

If a customer wants same-day express return as an add-on, it's only offered when their pickup is scheduled before 3:00 PM (Manila time) — otherwise there isn't enough time in the day to turn the order around.

---

## 3. Putting it together — a worked example

**Flat bag mode** — customer books a **Medium bag** (₱349) with **fabric softener** (your price ₱30 → customer pays ₱39):

| Line item | Amount |
|---|---|
| Bag price (Medium) | ₱349 |
| Fabric softener (₱30 × 1.30) | ₱39 |
| **Laundry subtotal** | **₱388** |
| Delivery fee | ₱70 |
| **Total charged to customer** | **₱458** |

If the customer had a ₱50-off promo code, the total would be ₱408 instead — your payout calculation is unaffected by the promo.

**Per-kilo mode example** — your rate is ₱80/kg, customer estimates 5 kg at booking (estimated laundry subtotal ₱400), and your shop weighs it in at 5.5 kg on receiving: the order is finalized at ₱440 for the base service, recalculated with add-ons/delivery the same way as above.

---

## 4. What you get paid

Lunara's only revenue is a commission on the **laundry subtotal** (base service + add-ons) — never on the delivery fee, which passes straight through to fund riders. This is the same commission formula in every pricing mode:

```
Your payout = Order total − Lunara's fee
```

For per-kilo/per-load orders, your payout is calculated the same way against the **finalized** laundry subtotal (after weigh-in), not the booking-time estimate — so your payout always reflects the real weight/load count, same as the customer's final charge.

Your commission rate defaults to **20%** and is set per branch by Lunara admin — you can see your current rate and full per-order breakdown any time in your partner dashboard under **Revenue** and **Settlements**. Using the flat-bag example above:

| | Amount |
|---|---|
| Order total | ₱458 |
| Lunara fee (commission on the ₱388 laundry subtotal) | ~₱78 |
| **Your payout** | **~₱380** |

Settlements are batched and paid out periodically (e.g. monthly), with a full itemized breakdown per order. See [`platform-commission.md`](./platform-commission.md#settlement-lifecycle) for exactly how and when settlements are created, and [`partner-cash-reconciliation.md`](./partner-cash-reconciliation.md) if you accept cash payments.

---

## Quick reference

| Question | Answer |
|---|---|
| Can I set my own base wash price? | Only if your shop is in per-kilo or per-load mode. Flat-bag shops (the default) charge Lunara's standard bag-size price (₱249–₱549), same across all shops. |
| How do I switch pricing modes? | Partner dashboard → Services → Pricing mode. Switching to per-kilo/per-load requires a rate set for every service you offer. |
| When is the per-kilo/per-load price final? | It's an estimate at booking time; it's finalized once your shop weighs the laundry and enters the actual weight/load count during receiving. |
| Can I set my own add-on prices? | Yes — customers are charged your price + 30% markup, in every pricing mode. |
| Do I control the delivery fee? | No — it's a platform-wide fee, ₱70 base + ₱8/km beyond 3 km. |
| Do promo codes cost me money? | No — Lunara absorbs promo discounts. |
| What's my commission rate? | 20% by default; check your dashboard for your exact rate, since it can be set per branch. |
| Where do I see my actual payouts? | Partner dashboard → Revenue (per-order) and Settlements (batched, paid). |

---

## Related docs

- [`PARTNER_OPERATIONS_PLAYBOOK.md`](./PARTNER_OPERATIONS_PLAYBOOK.md) — full day-to-day partner workflow (this guide is the pricing formula only)
- [`platform-commission.md`](./platform-commission.md) — full commission/settlement mechanics, ledger accounting, API reference
- [`partner-cash-reconciliation.md`](./partner-cash-reconciliation.md) — cash order handling
- [`features/laundry-services-catalog.md`](./features/laundry-services-catalog.md) — managing your service catalog
- [`features/laundry-addons-catalog.md`](./features/laundry-addons-catalog.md) — managing your add-ons
