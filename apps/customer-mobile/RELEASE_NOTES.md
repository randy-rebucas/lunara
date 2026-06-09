# Lunara Customer — Release Notes

## Version 1.0.0

**Release date:** June 2026  
**Platforms:** iOS · Android  
**Bundle:** `com.lunara.customer`

---

### App Store / Google Play — What’s New (short)

Paste into **What’s New** (iOS) or **Release notes** (Android):

```
Welcome to Lunara!

• Book laundry pickup and delivery from your phone
• Track every step — from dispatch to delivery
• Pay with GCash, card, wallet, or cash
• Real-time order updates and notifications
• Manage addresses, wallet, refunds, and support in one app

Laundry made simple.
```

**Character count:** ~280 (under typical 4000 / 500 limits)

---

### App Store — What’s New (minimal, 170 chars)

```
Book door-to-door laundry, track orders live, and pay your way. Manage your wallet, addresses, and support tickets — all in the Lunara app.
```

---

### Google Play — Release notes (bullet list)

```
Welcome to Lunara 1.0!

Book laundry pickup and delivery in minutes
Track orders from pickup through delivery
Pay with GCash, card, Lunara wallet, or cash
Get notifications when your order status changes
Save addresses with GPS for accurate routing
Top up wallet and view payment history
Request refunds and contact support in-app
Manage your profile and saved addresses
```

---

### Full changelog (1.0.0)

#### Booking & orders

- Sign up and sign in with **phone OTP** or email and password
- Guided **onboarding** — profile and first address
- **Book laundry** — service type, schedule, address, weight, add-ons, and estimate
- **Checkout** — PayMongo (GCash, Maya, card), cash on pickup/delivery, or Lunara wallet
- **Order list** with status filters and history
- **Live order tracking** — timeline, rider location when en route, delivery verification

#### Wallet & payments

- View balance and **top up wallet**
- Pay for orders from wallet at checkout
- Payment receipts and retry flow for unpaid orders

#### Notifications

- In-app **notification inbox** with mark-read and deep links to orders
- **Real-time updates** via Socket.IO while the app is open
- **Push notifications** when Firebase is configured (production builds)

#### Account & support

- **Profile** — name, avatar, phone, email
- **Saved addresses** — add, edit, default, GPS pin, open in Maps
- **Support tickets** — create and track complaints
- **Refund requests** — submit and follow status
- **Lost item** reports from completed orders
- **Reviews** after delivery
- Privacy policy, terms, and **account deletion request** from Profile

#### Technical

- Expo 54 · React Native · Expo Router
- Monorepo shared packages (`@lunara/types`, `@lunara/utils`, `@lunara/config`)
- Production API via `EXPO_PUBLIC_API_URL`

---

### Known limitations (1.0.0)

- Google / Facebook / Apple social login not yet in mobile (phone OTP and email supported)
- Account deletion is via support email (in-app API deletion planned)
- Push notifications require a production EAS build and Firebase setup (not Expo Go)

---

### For reviewers (internal)

```
Test flow: Sign in with phone OTP → complete onboarding → Book from Home →
pay at checkout → track order on Orders tab. Location used only when saving
addresses. Push optional for order updates.
```

---

## Template — future releases

### Version X.Y.Z

**What’s New (store):**

```
• [User-facing highlight 1]
• [User-facing highlight 2]
• Bug fixes and performance improvements
```

**Changelog:**

- Added: …
- Fixed: …
- Changed: …

---

## Related

- [Store listing](./../../docs/STORE_LISTING_CUSTOMER_MOBILE.md)
- [Deployment](./../../docs/DEPLOYMENT_CUSTOMER_MOBILE.md)
