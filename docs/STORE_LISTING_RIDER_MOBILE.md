# Lunara Rider App — Store Listings

Copy-paste metadata and screenshot plan for **App Store Connect** and **Google Play Console**.

App: `apps/rider-mobile` · Bundle ID `com.lunara.rider` · Version `1.0.0`

> **Audience:** This is a **workforce app** for Lunara pickup and delivery riders onboarded by operations. It is not a consumer laundry booking app (see [Customer mobile listing](./STORE_LISTING_CUSTOMER_MOBILE.md) for `com.lunara.customer`).

---

## App identity

| Field | Value |
|-------|--------|
| **App name (store)** | Lunara Rider |
| **Subtitle (iOS, 30 chars max)** | Pickup & delivery ops |
| **Bundle ID (iOS)** | `com.lunara.rider` |
| **Package name (Android)** | `com.lunara.rider` |
| **Primary category** | Business (or Productivity) |
| **Secondary category (iOS)** | Navigation |
| **Content rating** | Everyone / 3+ (workforce tool; no mature content) |
| **Support URL** | `https://lunara.app` or mailto:`support@lunara.app` |
| **Privacy policy URL** | `https://lunara.app/privacy` |
| **Terms URL** | `https://lunara.app/terms` |
| **Marketing website** | `https://lunara.app` |

---

## Screenshots — what to capture

Use a **production or staging build** with a seeded rider account (`rider@lunara.dev` / `password123` or OTP on `+639172222222`). Show realistic tasks, earnings, and shift status. Capture on a physical device or simulator with a clean status bar.

### Recommended 6–8 frames (same story on both stores)

| # | Screen | Route / how to open | Highlight |
|---|--------|---------------------|-----------|
| 1 | **Home / shift** | Sign in → `(tabs)` Home | Today’s earnings, go online, active assignment |
| 2 | **Tasks** | `(tabs)` Tasks → filter **Assigned** | Pickup and delivery offers from dispatch |
| 3 | **Pickup task** | Open pickup → `/pickup/[id]` | Customer address, navigate, proof-of-pickup steps |
| 4 | **Delivery task** | Open delivery → `/delivery/[id]` | Handoff flow, proof-of-delivery |
| 5 | **QR scan** | Task or `/scan` | Fast order verification at handoff |
| 6 | **Earnings** | Home → **View earnings** → `/earnings` | Daily / weekly payout summary |
| 7 | **Wallet** | Profile → Wallet → `/wallet` | Balance, GCash payout, withdrawals |
| 8 | **Profile** | `(tabs)` Profile | Documents, compliance, help & support |

Optional caption overlays (short text on brand purple `#4F46E5` or white):

1. Start your shift in one tap  
2. Pickup & delivery tasks from dispatch  
3. Navigate with proof at every stop  
4. Scan QR for fast handoff  
5. Track earnings and wallet payouts  

---

## Screenshot sizes

Rider mobile does not yet ship a `store-assets` generator. Capture manually or adapt the customer script under `apps/customer-mobile/store-assets/`.

### Apple App Store Connect

Required for iPhone (portrait only — `supportsTablet: false`):

| Display | Size (px) | Notes |
|---------|-----------|--------|
| **6.7"** (iPhone 15 Pro Max, etc.) | **1290 × 2796** | Primary set — upload first |
| 6.5" | 1284 × 2778 | Often auto-generated from 6.7" |
| 5.5" | 1242 × 2208 | Legacy |

**Capture (iOS Simulator):**

```bash
xcrun simctl io booted screenshot rider-home.png
```

**App Preview (optional):** 15–30 s, same resolution; show shift on → accept task → complete pickup.

### Google Play Console

| Asset | Size | Required |
|-------|------|----------|
| **Phone screenshots** | Min **2**, max 8 · **9:16** (e.g. 1080 × 1920) | Yes |
| **Feature graphic** | **1024 × 500** JPG/PNG | Yes |
| **Hi-res icon** | **512 × 512** PNG | Yes |
| Tablet screenshots | Only if tablets supported | No |

**Feature graphic idea:** Lunara icon + **Lunara Rider** + “Pickup & delivery operations” on `#4F46E5` or white; avoid fine print.

---

## Store copy (ready to paste)

### Short description (Google Play — 80 chars max)

```
Lunara rider app: assigned pickups & deliveries, earnings, wallet, and dispatch tools.
```

### Subtitle (App Store — 30 chars max)

```
Pickup & delivery ops
```

### Promotional text (App Store — 170 chars, editable without review)

```
Run your Lunara shift from your phone. Accept dispatch tasks, navigate pickups and deliveries, capture proof photos, and track earnings and wallet payouts.
```

### Full description (both stores — ~4000 chars max)

Use the same body on iOS **Description** and Android **Full description**:

```
Lunara Rider is the official operations app for Lunara pickup and delivery partners. It is built for riders who fulfill laundry orders between customers and partner shops — not for booking laundry as a customer.

RUN YOUR SHIFT
Go online when you start work and offline when you finish. See today’s earnings at a glance and manage break status during your route.

DISPATCHED TASKS
Receive pickup and delivery assignments from Lunara operations. View task details, customer contact, and shop handoff information in one place.

NAVIGATE & COMPLETE STOPS
Open maps for each stop. Follow step-by-step pickup and delivery workflows with photo proof and status updates so customers and dispatch stay in sync.

QR HANDOFF
Scan customer or order QR codes for fast verification at pickup and delivery.

EARNINGS & WALLET
Track daily, weekly, and monthly earnings. View wallet balance, request withdrawals, and manage GCash payout details.

STAY COMPLIANT
Upload and track KYC documents. See compliance status before you go online.

NOTIFICATIONS & OFFLINE
Get alerts for new assignments and order changes. Core task actions queue when connectivity is limited and sync when you are back online.

HELP & SAFETY
Contact support by email. Emergency SOS notifies dispatch with your location when you need assistance on a route.

WHO CAN USE THIS APP
Only riders with an active Lunara partner account can sign in. New riders are onboarded by Lunara operations — this app is not open public registration.

Account questions: support@lunara.app
Privacy: lunara.app/privacy
```

### Keywords (App Store only — 100 chars, comma-separated)

```
rider,delivery,courier,pickup,laundry,dispatch,earnings,wallet,Philippines,fleet
```

### What’s New (version 1.0.0)

```
Welcome to Lunara Rider!

• Go online and manage your shift from Home
• Accept pickup and delivery tasks from dispatch
• Navigate stops with proof-of-pickup and proof-of-delivery
• Scan QR codes for fast handoff verification
• Track earnings, wallet balance, and payout requests
• Upload compliance documents and get dispatch notifications
• Offline-friendly task updates with sync when back online

Built for Lunara delivery partners.
```

---

## App Store Connect — checklist

Create app → **Apps → + → New App**:

| Field | Value |
|-------|--------|
| Platform | iOS |
| Name | Lunara Rider |
| Primary language | English (U.S.) |
| Bundle ID | `com.lunara.rider` |
| SKU | `lunara-rider-ios` (any unique string) |
| User access | Full access |

**App Information**

- Category: **Business**  
- Content rights: you own or licensed all content  
- Age rating: complete questionnaire (location, no unrestricted web, etc.)  
- **App Privacy:** link privacy policy; declare data collected (see below)

**Pricing and availability**

- Price: **Free** (riders are paid via Lunara, not via IAP)  
- Availability: **Philippines** first (expand with operations)

**Distribution note**

Consider **Unlisted** on the App Store if riders are invited by link only. Public listing is fine if you state the app requires a Lunara rider account.

**App Review Information**

- Sign-in required: **Yes**  
- Demo account:

  ```
  Email: rider@lunara.dev
  Password: password123

  Or phone OTP: +639172222222 (Twilio SMS on API — provide staging credentials if reviewers cannot receive SMS)

  Notes: Workforce app for registered Lunara riders only. Customer booking is a separate app (Lunara / com.lunara.customer).
  ```

- Notes for reviewer:

  ```
  Lunara Rider is for delivery partners, not customers. Sign in with the demo rider account,
  tap Go Online on Home, open Tasks to see assigned pickup/delivery work, and open a task to
  view the step flow. Location is used while on shift and during active tasks. Camera is used
  for QR scan and proof photos. Push notifications are optional for dispatch alerts.
  ```

**Version 1.0.0**

- Upload build from EAS / TestFlight  
- Screenshots (6.7")  
- Description, keywords, support URL  
- Select uploaded IPA build  

---

## Google Play Console — checklist

Create app → **All apps → Create app**:

| Field | Value |
|-------|--------|
| App name | Lunara Rider |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Free |

**Store presence → Main store listing**

- Short description (80 chars) — see above  
- Full description — see above  
- App icon, feature graphic, phone screenshots  
- App category: **Business** or **Maps & Navigation**  

**Policy → App content**

| Item | Guidance |
|------|----------|
| **Privacy policy** | `https://lunara.app/privacy` |
| **Ads** | No |
| **Content rating** | IARC questionnaire → likely Everyone |
| **Target audience** | **18+** (workforce / contractor app) |
| **Data safety** | See table below |
| **News app** | No |

**Data safety form (typical for Lunara rider app)**

Adjust if production differs:

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Name | Yes | No | Rider profile, dispatch |
| Email | Yes | No | Account login |
| Phone number | Yes | No | OTP login, customer handoff |
| Precise location | Yes (while on shift / active tasks) | No | Dispatch, navigation, SOS |
| Photos / videos | Yes | No | Proof of pickup/delivery, KYC documents |
| Financial info (earnings, payout details) | Yes | No | Wallet and withdrawals |
| App activity (tasks, shift status) | Yes | No | Core functionality |
| Device IDs | Yes (push token) | No | Dispatch notifications |
| Government ID (KYC) | Yes | No | Rider verification (if enabled) |

Data encrypted in transit: **Yes** (HTTPS). Users can request account help / deletion via **support@lunara.app**.

**Release → Production**

- Upload AAB from EAS (`eas build --platform android --profile production`)  
- Complete store listing, content rating, and data safety  
- **Internal testing** first, then production  

**Organization distribution (optional)**

For a closed rider fleet, use **Internal testing** or **Managed Google Play** (enterprise) instead of a wide public rollout.

---

## Permissions (declare in review notes)

Aligned with `apps/rider-mobile/app.json`:

| Permission | Why |
|------------|-----|
| **Location (when in use / always on shift)** | Live dispatch tracking and navigation during tasks |
| **Camera** | QR scan and proof-of-pickup/delivery photos |
| **Photo library** | Attach proof images when selected by rider |
| **Notifications** | New assignments and dispatch alerts |

---

## Brand assets on disk

| Asset | Path |
|-------|------|
| App icon (source) | `packages/brand/assets/icon.png` |
| In-app brand color | `#4F46E5` (primary) |
| EAS project ID | `app.config.js` → `extra.eas.projectId` |

Export **512×512** PNG for Play hi-res icon if Console does not auto-fill from the AAB.

---

## Before you submit

- [ ] Production API reachable from `EXPO_PUBLIC_API_URL` (EAS env)  
- [ ] Twilio OTP configured on API for rider phone login  
- [ ] Privacy and terms live at `lunara.app/privacy` and `/terms`  
- [ ] Screenshots from production build (no dev credential hints on screen)  
- [ ] TestFlight / internal track tested on a physical device with real GPS  
- [ ] Demo rider account works for App Review (`rider@lunara.dev`)  
- [ ] Support email `support@lunara.app` monitored  
- [ ] Rider KYC / document upload tested against production API  

---

## Related docs

- [Rider mobile deployment](./DEPLOYMENT_RIDER_MOBILE.md)
- [Customer mobile store listing](./STORE_LISTING_CUSTOMER_MOBILE.md)
- [API deployment](./DEPLOYMENT_API.md)
- [API endpoints](./API_ENDPOINTS.md)
