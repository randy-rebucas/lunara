# Rider Operations Playbook

End-to-end guide for riders using the Lunara rider-mobile app — from application to daily pickups/deliveries to getting paid. For the deep mechanics of wallet netting, ledger entries, and payout math, see [`rider-settlement.md`](./rider-settlement.md) — this playbook is the step-by-step workflow guide.

---

## 1. Becoming a rider

### Apply
Submit `POST /rider-applications` with:
- Personal info: name, email, phone, gender, civil status
- Address, emergency contact
- Vehicle: type, make/model, color, plate number, year
- Driver's license number + expiration
- Required document uploads: **driver's license, OR/CR, NBI clearance, selfie** (each uploaded privately to Cloudinary)
- Explicit acceptance of the applicant declaration

The application starts as `PENDING`. Admin reviews and approves/rejects it (see [`ADMIN_OPERATIONS_PLAYBOOK.md`](./ADMIN_OPERATIONS_PLAYBOOK.md#7-rider-management)).

### First login & compliance
Once an account exists, log in to rider-mobile via email/password or phone OTP. Logging in doesn't mean you can start working yet — the app runs a separate **compliance check** (`isRiderCompliant()`) requiring:
- Complete profile: first/last name, phone, home address (line1/city/province/postal code), vehicle type, plate number, OR/CR number
- All 4 documents (license, OR/CR, NBI clearance, selfie) uploaded **and** marked `approved`

Until both are true, verification status shows `incomplete` or `pending_review`, a compliance banner appears on the home screen, and **"Go Online" stays disabled** with the hint: *"Complete profile and document verification on the Profile tab before going online."* Upload/manage documents from the **Documents** tab.

---

## 2. Going online

Tap the Online/Offline pill (or the shift panel) on the home screen.

- The app requests **foreground location permission** — if denied, you'll see a "Location required" banner and can't go online.
- Going online re-checks compliance server-side; if you've since lost compliance (e.g. a document expired), it's rejected with the specific gaps listed.
- While online, your GPS location streams to the server on a fixed interval so dispatch and the customer tracking map stay current.
- **Breaks**: Start Break (must be online first) pauses you (`shiftStatus: 'break'`, goes offline for assignment purposes) without a full logout; End Break flips you back online.

---

## 3. Getting assigned a job

Jobs reach you one of three ways:
1. **Branch default rider** — if a shop has you set as their default rider and you're online, pickups/deliveries route straight to you, no broadcast.
2. **Broadcast offer** — otherwise, an open offer is pushed to every online rider as a card on your home screen (`Pickup offer` / `Delivery offer`) with **Accept**/**Decline**. First to accept gets it.
3. **Admin direct/suggested assignment** — dispatch can assign you directly, or suggest you from a ranked shortlist (by proximity, current load, recent completion history) which an admin then confirms.

**Pickup acceptance rules**: you must be online; the order must already be shop-assigned/confirmed and dispatched with the partner having accepted. You can decline right up until you've marked arrival or collected the laundry — after that, declining is blocked ("Cannot reject after pickup has started").

**Delivery assignment** works differently — delivery riders are pre-targeted by ops, so "accepting" is acknowledging an assignment already pointed at you, not claiming from an open pool.

---

## 4. Pickup flow

Open the active pickup from your home screen. Steps run in order, each gated on the previous:

1. **Mark arrived** — at the customer's location.
2. **Verify customer** — either a phone-based verification code (last 4 digits shown as a hint) or scan the customer's QR code.
3. **Collect cash** *(cash orders only)* — must happen after customer verification. The app shows exactly how much to collect.
4. **Collect laundry** — capture actual weight and any notes; the order moves to Picked Up. (Cash must already be collected if applicable.)
5. **Assign laundry tag** *(optional)* — scan a physical tag to link it to the order for shop tracking.
6. **Capture photo** — proof of the collected laundry.
7. **Generate pickup receipt** — produces a receipt code (`PU-XXXXXX-XXXX`).
8. **Drop at shop** — hands the laundry to the partner (optionally QR-verified); this is the step where **your pickup-leg earning is credited**.

---

## 5. Delivery flow

1. **Pick up from shop** — once the partner has finished processing and the order is ready.
2. **Out for delivery** — status updates so the customer sees live progress.
3. **Mark customer received** — in person or via QR scan, with the same phone-hint verification pattern as pickup.
4. **Collect cash** *(cash orders only)* — after customer-received is confirmed.
5. **Capture photo** — proof of delivery.
6. **Customer confirms** — the customer signs off in their app; delivery cannot complete without a signature, a photo, **and** (for cash orders) cash collected.
7. **Complete delivery** — generates a delivery receipt (`DL-XXXXXX-XXXX`), marks the order Delivered → Completed, frees up the laundry tag, and **credits your delivery-leg earning**.

---

## 6. Cash you collect

Every peso you collect on a cash order is automatically netted against what Lunara owes you for that leg the moment you collect it:

```
Earning offset  = your configured pickup or delivery fee (₱0 for employee-type riders — they remit 100% of cash)
Net remittance  = max(0, cash collected − earning offset)
```

You don't need to do this math — the app shows the breakdown on the cash-payment screen and books it automatically.

**Submitting remittance**: from your cash summary, submit with a proof image/transaction reference and a mode:
- **Net of fee** (default) — you've already kept your fee out of the cash; remit the rest.
- **Full amount** — remit everything you collected; your fee gets credited back to your wallet separately instead of being netted against cash.

Admin verifies your submitted remittance and marks it received. See your running cash summary any time under **Cash Summary**.

---

## 7. Earnings & getting paid

- **Per-leg fees**: ₱35 for a completed pickup leg, ₱35 for a completed delivery leg (platform default, admin-adjustable) — credited automatically at the "drop at shop" and "complete delivery" steps respectively.
- **Earnings tab** — full history, plus today/week/month/lifetime totals on the home screen.
- **Wallet tab** — current balance. Your withdrawable amount is your wallet balance minus anything on hold and minus pending withdrawal requests already submitted.
- **Withdrawing**: set a payout method first (GCash, Maya, or bank — Payout settings), then request a withdrawal of at least **₱100**, up to your withdrawable balance. Admin approves or rejects each request; approved withdrawals are paid out manually (GCash/bank transfer) outside the app.

---

## 8. Safety — SOS

If something goes wrong while you're actively on a pickup or delivery, trigger SOS from the app. This:
- Alerts admin dispatchers immediately (dashboard alert + push notification to all admins)
- Lets you start continuous live-location sharing so dispatch can see exactly where you are in real time
- Stays open until an admin resolves the incident

SOS only works while you have an active assignment — it's tied to the order you're on, not a general panic button.

---

## Quick reference

| Question | Answer |
|---|---|
| Why can't I go online? | Check the compliance banner — usually a missing profile field or an unapproved document. |
| Can I decline a pickup after I've started? | No — once you've marked arrival/collected laundry, decline is blocked. |
| Do I owe Lunara my full fare in cash? | No — your fee is automatically netted out unless you're on the employee arrangement, or you chose "full amount" remittance mode. |
| What's the minimum withdrawal? | ₱100, and you need a payout method configured first. |
| When do I get paid for a leg? | Pickup fee credits when you drop off at the shop; delivery fee credits when the customer confirms delivery. |

---

## Related docs

- [`rider-settlement.md`](./rider-settlement.md) — full wallet/netting/ledger mechanics, endpoint reference, flow diagram
