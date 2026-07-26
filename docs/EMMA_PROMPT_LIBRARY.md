# Emma Flores — AI Customer Support
## Intent Prompt Library v1.1 (API-Coverage Annotated)

This is the working prompt library for Emma Flores, Lunara's AI customer support agent. It expands the original v1.0 intent list with a coverage tag on every prompt, checked against what `apps/api` actually implements as of 2026-07-25.

**Legend**

| Tag | Meaning |
|---|---|
| ✅ | Covered — a real endpoint backs this exactly |
| ⚠️ | Partial — the data/flow exists, but with a caveat, workaround, or missing piece (noted inline) |
| ❌ | Gap — nothing to call yet |

Use this for: intent classification, prompt/response testing, API mapping, feature-gap tracking, and as the canonical dataset before scaling to the 1,000+ prompt NLP target.

---

## 👤 Account & Profile — ⚠️ Partial

Profile view/edit and the full address book work end to end. Everything about the account's *existence* — deleting it, changing the phone/email tied to it, unlocking it — has no endpoint.

- ✅ Show my profile — `GET /customers/me`
- ✅ View my account
- ✅ My account details
- ✅ Update my profile — `PATCH /customers/me`
- ✅ Edit my profile
- ✅ Change my name
- ❌ Update my phone number — no re-verification flow to change login identity
- ❌ Change my mobile number
- ❌ Change my email
- ⚠️ Verify my account — phone OTP only
- ⚠️ My account is not verified
- ❌ Resend verification email — no email-verification flow confirmed
- ⚠️ Change my password — depends on signup path (OTP vs. email+password), not symmetric
- ⚠️ I forgot my password
- ⚠️ Reset my password
- ❌ Delete my account — no self-service delete; admin-only deactivation
- ❌ Disable my account
- ❌ Reactivate my account
- ⚠️ Why is my account suspended? — `User.isActive` exists, no customer-facing reason field
- ⚠️ Log me out of all devices — session model is single-token-per-user already, so this is moot in practice, but there's no explicit device list/endpoint
- ✅ Update my address — `PATCH /addresses/:id`
- ✅ Add a new address — `POST /addresses`
- ✅ Remove my address — `DELETE /addresses/:id`
- ✅ Change default pickup address — `isDefault` flag
- ✅ Update delivery address

---

## 🔐 Login & Authentication — ⚠️ Partial

OTP is the strong path — request/resend/verify all real, with Twilio Verify owning expiry. Account lockout has no model at all.

- ⚠️ I can't log in — no diagnostic endpoint, generic troubleshooting only
- ⚠️ Login failed
- ⚠️ Invalid password
- ⚠️ Incorrect password
- ✅ Invalid OTP — Twilio Verify validates
- ✅ OTP expired
- ✅ Send another OTP — `POST /auth/otp/request` doubles as resend
- ✅ I didn't receive my OTP
- ✅ My verification code doesn't work
- ✅ Verify my phone number
- ❌ Verify my email — no confirmed email-verification endpoint
- ✅ Session expired — silent refresh-token exchange (since 1.2.0)
- ❌ My account is locked — no lockout-after-attempts mechanism exists
- ❌ Unlock my account
- ⚠️ Help me log in — conversational, not endpoint-backed

---

## 📍 Booking — ✅ Covered

The deepest part of the API. Creation, reorder, weekly/monthly recurrence, cancel, and reschedule are all real. The two narrow gaps: delivery date/time isn't independently changeable, and several prompts here are troubleshooting phrasing rather than missing features.

**Create booking**
- ✅ Book my laundry — `POST /booking/orders`
- ✅ Schedule a pickup
- ✅ Pickup my clothes
- ✅ Wash my clothes
- ✅ Book for today
- ✅ Book for tomorrow
- ✅ Pickup later
- ✅ Schedule next week
- ✅ I need laundry service
- ✅ Dry clean my clothes
- ✅ Express laundry — express-return add-on
- ✅ Book now
- ✅ Repeat my last booking — reorder prefill from order history
- ✅ Book again
- ✅ Weekly pickup — `POST /subscriptions` (7-day cadence)
- ✅ Monthly pickup — (30-day cadence)

**Booking management**
- ✅ Cancel my booking — `DELETE /orders/:id` (blocked once shop-assigned)
- ✅ Reschedule my booking — `PATCH /orders/:id/reschedule`
- ✅ Change pickup date
- ✅ Change pickup time
- ❌ Change delivery date — no independent delivery-reschedule endpoint
- ❌ Change delivery time
- ⚠️ Booking failed — troubleshooting phrasing, resolvable via order status lookup
- ⚠️ Booking error
- ⚠️ Booking disappeared — usually an unpaid `PENDING` order auto-cleaned up
- ⚠️ My booking isn't showing
- ⚠️ Booking not confirmed
- ⚠️ Booking rejected — no explicit rejection-reason field

---

## 📦 Booking Status — ✅ Covered

Order list, detail, and full status-history timeline all exist.

- ✅ Where is my order? — `GET /orders`, `GET /orders/:id`
- ✅ Track my booking
- ✅ Booking status
- ✅ Check my booking
- ✅ Show my booking
- ✅ Show latest booking
- ✅ My current booking
- ✅ Booking details
- ✅ Has my booking been accepted?
- ✅ Is pickup confirmed?
- ✅ Is my booking still pending?
- ⚠️ Why is my booking delayed? — inferable from `statusHistory` timestamps, no explicit "delay reason" field

---

## 🚚 Pickup — ⚠️ Partial

Location/ETA tracking is real-time and solid. Anything requiring direct rider contact, or changing the pickup address after booking, isn't there.

- ✅ Where is my rider? — realtime tracking gateway
- ✅ Track my rider
- ✅ Rider location
- ✅ Rider ETA
- ✅ Pickup ETA — `computePickupSla`
- ⚠️ Rider is late — inferred from SLA window vs. now, no explicit flag
- ⚠️ Rider never arrived
- ⚠️ Rider cancelled
- ❌ Change pickup address — reschedule only moves time, not address
- ⚠️ Pickup failed
- ❌ Rider can't find me — no contact channel
- ❌ Contact my rider
- ❌ Message my rider
- ❌ Call my rider
- ⚠️ I missed the pickup — needs reschedule/cancel, no dedicated flow
- ⚠️ Rider already left

---

## 🧺 Laundry Processing — ✅ Covered

Washing → drying → folding → packing → quality check is a real, granular state machine.

- ✅ Has my laundry been washed? — `laundryProcessing.currentStepId`
- ✅ Is my laundry being cleaned?
- ✅ Is it drying?
- ✅ Is it folded?
- ✅ Is it packed?
- ✅ Ready for delivery?
- ✅ Is quality check finished?
- ✅ Processing status
- ✅ Express service status
- ⚠️ Why is it taking so long? — no explicit delay-reason field, progress is visible though

---

## 🚛 Delivery — ⚠️ Partial

Same shape as Pickup — tracking is strong, but there's no way to change delivery timing/address or leave instructions.

- ✅ Delivery ETA
- ✅ Where is my delivery?
- ⚠️ Rider is late
- ❌ Deliver tomorrow — no delivery-reschedule endpoint
- ❌ Deliver later
- ❌ Deliver after 6 PM
- ❌ Change delivery address
- ❌ Change delivery time
- ⚠️ Delivery failed
- ⚠️ Nobody delivered
- ❌ Leave it at the reception — no delivery-instructions field (pickup has `notes`, delivery doesn't)
- ❌ Leave it with security
- ❌ Call before delivery

---

## 💳 Payments — ✅ Covered

GCash, Maya, card, cash, and wallet are all real payment methods with receipts and status tracking.

- ✅ Pay now — `POST /payments/intent`
- ✅ Payment failed
- ✅ Payment pending
- ⚠️ Payment not reflected
- ⚠️ I was charged twice — payment history can confirm/rule out, actual dispute resolution is a manual/ticket path
- ⚠️ Double payment
- ✅ Outstanding balance
- ✅ Show payment history
- ⚠️ Download my receipt — `receiptCode` exists, not confirmed as a downloadable PDF
- ❌ Email my receipt
- ✅ Cash payment
- ✅ GCash payment
- ✅ Maya payment
- ✅ Credit card payment
- ✅ Debit card payment
- ❌ Bank transfer — not a supported payment method
- ✅ Online payment

---

## 💰 Refunds — ⚠️ Partial

Requesting and tracking a refund works well, including the cash-ineligibility rule. The one thing to get right: refunds land in the Lunara wallet, not back on the original payment method.

- ✅ I want a refund — `/refunds` module
- ✅ Refund my payment
- ✅ Refund status
- ⚠️ Refund hasn't arrived
- ⚠️ Wrong amount charged
- ⚠️ I was overcharged
- ⚠️ Refund to GCash — credits wallet instead, not the original channel
- ⚠️ Refund to card
- ⚠️ Refund delayed
- ⚠️ Cancel payment

---

## 🏷 Pricing — ✅ Covered

Per-kg, per-bag, per-load, and per-piece pricing modes are all real and quoted live. Specialty items depend on branch catalog seeding.

- ✅ Laundry price — `POST /booking/quote`
- ✅ Price per kilo
- ✅ Delivery fee
- ⚠️ Pickup fee — usually bundled into delivery fee, not separately itemized
- ✅ Service fee
- ✅ Express service fee
- ✅ Dry cleaning price
- ⚠️ Blanket cleaning price — only if that branch's catalog has the add-on
- ⚠️ Comforter cleaning
- ⚠️ Shoe cleaning
- ⚠️ Jacket cleaning
- ⚠️ Curtain cleaning
- ✅ Calculate my bill
- ✅ Estimate my total

---

## 🎁 Promotions — ⚠️ Partial

Promo codes, referral bonuses, and points/loyalty are all real. Demographic discounts have no supporting field anywhere.

- ✅ Any promo today? — promotions module
- ✅ Promo code
- ✅ Coupon code
- ✅ Apply promo
- ⚠️ Promo not working
- ✅ Referral bonus — `GET /rewards/me/referral-code`
- ❌ Student discount — no demographic targeting, only a generic "new customers" audience type
- ❌ Senior discount
- ✅ First booking discount — new-customer audience type
- ❌ Birthday promo — no date-of-birth field/logic
- ✅ Loyalty rewards — `/rewards`
- ⚠️ Cashback — it's points-redeemable-for-discounts, not literal cash-back

---

## 🏪 Laundry Partner — ⚠️ Partial

Shop info, hours, and rating are all real and already used for shop selection during booking.

- ✅ Which laundry accepted my booking? — `branchName`/`branchCode` on order
- ✅ Show laundry information
- ✅ Laundry address
- ⚠️ Laundry phone number — not confirmed as customer-exposed
- ✅ Laundry operating hours
- ✅ Laundry rating
- ✅ Nearest laundry
- ✅ Best laundry shop
- ❌ Change laundry partner — no reassignment endpoint mid-order, only cancel-and-rebook

---

## ⭐ Ratings & Reviews — ⚠️ Partial

Submitting a review works. Changing your mind about one doesn't.

- ✅ Rate my booking — `POST /reviews`
- ✅ Leave feedback
- ⚠️ Review the rider — review ties to order/partner, not explicitly a rider record
- ✅ Review the laundry
- ✅ Give five stars
- ❌ Edit my review — create-only, no update route
- ❌ Delete my review — no delete route
- ⚠️ Report bad service — overlaps with support tickets, not review-based

---

## 📢 Notifications — ⚠️ Partial

Push is a real, on/off channel. SMS and email preferences don't exist as separate toggles.

- ✅ Enable notifications — `POST/DELETE .../push-token`
- ✅ Disable notifications
- ❌ SMS notifications — no channel-level preference field
- ❌ Email notifications
- ✅ Push notifications
- ❌ Turn off promotions — no marketing-specific opt-out distinct from push toggle
- ⚠️ Notification settings

---

## 🎯 Referral Program — ⚠️ Partial

Getting your code and earning the reward both work. A clean "who signed up" history doesn't exist as its own view.

- ✅ Invite friends
- ✅ Referral code — `GET /rewards/me/referral-code`
- ✅ Referral link
- ✅ Referral reward
- ⚠️ Referral history — mixed into general points-transaction list, not a dedicated view
- ⚠️ Referral status

---

## 📍 Service Availability — ⚠️ Partial

Branch hours and holiday schedules are real and per-branch. No standalone "is this barangay covered" lookup.

- ✅ Are you open? — branch `operatingHours` + `holidays`
- ✅ Open today?
- ✅ Open tomorrow?
- ✅ Holiday schedule
- ✅ Weekend schedule
- ✅ Available now?
- ⚠️ Do you serve Baybay? — answerable indirectly via address validation against nearby shops, no direct area-lookup endpoint
- ⚠️ Do you serve Ormoc?
- ⚠️ Service coverage
- ⚠️ Available in my barangay?
- ⚠️ Pickup in my area?

---

## ❗ Complaints — ⚠️ Partial

Every complaint here can be filed — the ticket system is real and eligibility-gated (post-delivery only). What's missing is structure: everything collapses into one free-text description with no damage taxonomy.

- ⚠️ My clothes are missing
- ⚠️ Wrong clothes delivered
- ⚠️ Clothes damaged
- ⚠️ Clothes torn
- ⚠️ Clothes shrunk
- ⚠️ Clothes faded
- ⚠️ Clothes smell bad
- ⚠️ Clothes are still dirty
- ⚠️ Missing socks
- ⚠️ Missing shirt
- ⚠️ Missing pants
- ⚠️ Wrong order
- ⚠️ Lost my laundry
- ⚠️ Rider was rude — no dedicated conduct-complaint field tying to a specific rider record
- ⚠️ Laundry staff was rude
- ✅ Delivery was late — checkable via timestamps
- ✅ Pickup never happened

---

## 🆘 Emergency — ❌ Gap

SOS exists in this codebase, but only on the rider's side (a rider in danger alerting dispatch). There is no customer-facing equivalent — everything here routes through the same general ticket queue as a routine complaint.

- ⚠️ Lost package — general ticket, no fraud/misdelivery-specific flow
- ⚠️ Someone received my laundry
- ❌ Rider had an accident — `sos` module is rider-initiated only
- ❌ Wrong delivery address — no urgent-correction path
- ❌ Emergency support — no customer SOS/urgent-escalation endpoint
- ❌ Urgent help
- ⚠️ *(Ticket priority field exists — low/medium/high — but only staff can set it, not the customer filing.)*

---

## 👨 Human Support — ⚠️ Partial

Filing something a human will read: yes. Live chat and callback requests: no such infrastructure exists.

- ⚠️ Talk to a person
- ⚠️ Human support
- ❌ Live agent — no live-chat infra; the only real-time chat in the codebase is partner-to-admin
- ⚠️ Customer service
- ⚠️ Connect me to support
- ✅ Escalate this issue — support tickets

---

## ❓ General Questions — ✅ Covered

Answerable by combining catalog, booking config, and branch data — needs conversational framing, not new endpoints.

- ✅ How does Lunara work?
- ✅ What services do you offer?
- ✅ How long does laundry take?
- ✅ What payment methods do you accept?
- ✅ How do I cancel a booking?
- ✅ How do I reschedule?
- ✅ How does pickup work?
- ✅ How does delivery work?
- ⚠️ Can you wash shoes? — catalog-dependent per branch
- ⚠️ Can you wash blankets?
- ⚠️ Can you wash comforters?
- ⚠️ Can you wash curtains?
- ✅ Do you offer dry cleaning?
- ✅ Do you have express service?
- ⚠️ What if nobody is home? — no documented policy/field
- ✅ How is pricing calculated?

---

## 🇵🇭 Filipino & Taglish — *not an API concern*

Every phrase below is a translation of an intent already scored above. The API doesn't need a Filipino-specific version of anything — this is entirely an NLU-layer question (does Emma's language model classify Taglish correctly before mapping to the same endpoint English already uses). Dot color = the underlying English intent's verdict.

- ✅ Nasaan na yung labada ko? *(Booking Status)*
- ✅ Nasaan na yung rider? *(Pickup)*
- ✅ Magkano ang laundry? *(Pricing)*
- ✅ Magkano per kilo? *(Pricing)*
- ✅ Pwede bang bukas na lang ang pickup? *(Reschedule)*
- ✅ Pwede bang ipa-cancel? *(Cancel)*
- ✅ Gusto kong magpa-refund. *(Refunds)*
- ✅ Nabayaran ko na. *(Payments)*
- ⚠️ Hindi pumasok yung payment. *(Payments — not reflected)*
- ⚠️ Hindi dumating yung rider. *(Pickup — rider never arrived)*
- ✅ Wala pa yung pickup. *(Booking Status)*
- ❌ Mali yung address. *(Change address — gap)*
- ✅ Pwede bang palitan ang schedule? *(Reschedule)*
- ✅ Anong oras delivery? *(Delivery ETA)*
- ✅ Pwede bang express? *(Booking)*
- ⚠️ Nawawala yung damit ko. *(Complaints)*
- ✅ May promo ba kayo? *(Promotions)*
- ✅ Available ba kayo ngayon? *(Service Availability)*
- ✅ Paano gamitin ang app? *(General Questions)*
- ⚠️ Gusto kong makausap ang customer service. *(Human Support)*

---

## Future Categories — mixed (re-scored against current API)

Three of these are further along than the original doc assumed and should move out of "future."

- ✅ **Subscription** — already live: create, view, pause/resume, cancel (`/subscriptions`)
- ✅ **Wallet** — already live: balance, transaction history, top-up (`/wallets/me`)
- ⚠️ **Membership** — loyalty tiers (Moon → Star → Comet → Galaxy) already exist under Rewards; reframe as tier perks, not a new system
- ⚠️ **Notifications** — already scored above; push only
- ⚠️ **Business Accounts** — a basic version exists (business-account flag + monthly spend summary), well short of true multi-user accounts
- ❌ **Family Accounts** — no backing data or logic
- ❌ **AI Recommendations** — net-new
- ❌ **Smart Recommendations** — net-new
- ❌ **Voice Commands** — net-new
- ❌ **Laundry Care Tips** — net-new (content, not endpoint)
- ❌ **Stain Removal Advice** — net-new (content, not endpoint)
- ❌ **Fabric Care** — net-new (content, not endpoint)

---

## Notes for whoever trains Emma next

1. **The "Partial" bucket is where the real work is.** Most gaps aren't missing data — they're one specific action (edit, delete, reschedule-delivery, change-address) not yet built on top of data that already exists. Prioritize accordingly.
2. **Two categories need a product decision before more prompts get added to them:** Emergency (does a customer-side SOS/priority-escalation path get built, or does this stay routed through general support?) and Human Support (is live chat ever coming, or should Emma's copy stop implying "talk to a person" is instant?).
3. **Filipino/Taglish scaling is free** — every new English intent added to this library should get its Taglish translation added at the same time, since it inherits the same coverage verdict automatically.
4. **Re-verify before the 1,000-prompt expansion.** This audit is a snapshot against `apps/api` as of 2026-07-25 — re-check verdicts before scaling the dataset if the API has changed since.
