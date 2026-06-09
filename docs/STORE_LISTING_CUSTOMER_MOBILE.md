# Lunara Customer App — Store Listings

Copy-paste metadata and screenshot plan for **App Store Connect** and **Google Play Console**.

App: `apps/customer-mobile` · Bundle ID `com.lunara.customer` · Version `1.0.0`

---

## App identity

| Field | Value |
|-------|--------|
| **App name (store)** | Lunara |
| **Subtitle (iOS, 30 chars max)** | Laundry pickup & delivery |
| **Bundle ID (iOS)** | `com.lunara.customer` |
| **Package name (Android)** | `com.lunara.customer` |
| **Primary category** | Lifestyle (or Productivity) |
| **Secondary category (iOS)** | Shopping |
| **Content rating** | Everyone / 3+ (no mature content) |
| **Support URL** | `https://lunara.app` or mailto:`support@lunara.app` |
| **Privacy policy URL** | `https://lunara.app/privacy` |
| **Terms URL** | `https://lunara.app/terms` |
| **Marketing website** | `https://lunara.app` |

---

## Screenshots — what to capture

Use a **production or staging build** with real-looking data (booked order, wallet balance, notifications). Capture on a physical device or simulator with status bar clean (full battery, good signal).

### Recommended 6–8 frames (same story on both stores)

| # | Screen | Route / how to open | Highlight |
|---|--------|---------------------|-----------|
| 1 | **Home** | Sign in → `(tabs)` Home | Book CTA, deals, active order card |
| 2 | **Book laundry** | Tap Book → `/book` | Service type, schedule, address |
| 3 | **Checkout / pay** | Unpaid order → `/checkout/[orderId]` | GCash, card, wallet, cash options |
| 4 | **Track order** | Orders → open order → `/orders/[id]` | Timeline, live status, rider en route |
| 5 | **Orders list** | `(tabs)` Orders | Order history and statuses |
| 6 | **Wallet** | `(tabs)` Wallet | Balance and top-up |
| 7 | **Notifications** | Bell on Home → `/notifications` | Order updates inbox |
| 8 | **Profile** | `(tabs)` Profile | Addresses, support, account |

Optional caption overlays (keep short, high contrast on brand purple `#4F46E5`):

1. Book laundry in minutes  
2. Door-to-door pickup & delivery  
3. Pay your way — GCash, card, wallet  
4. Track every step in real time  
5. All your orders in one place  

---

## Screenshot sizes

Pre-generated templates (correct dimensions, Lunara branding + captions) live in:

```
apps/customer-mobile/store-assets/
├── ios/          # 1290×2796 — 8 frames
├── android/      # 1080×1920 — 8 frames + feature-graphic-1024x500.png + hi-res-icon-512.png
└── README.md
```

Regenerate templates:

```bash
cd apps/customer-mobile
npm run store-assets
```

Replace placeholders with real app captures — save as `captures/01-home.png` … `captures/08-profile.png`, then:

```bash
npm run store-assets:captures
```

### Apple App Store Connect

Required for iPhone (portrait only — app is phone-only):

| Display | Size (px) | Notes |
|---------|-----------|--------|
| **6.7"** (iPhone 15 Pro Max, 14 Pro Max, etc.) | **1290 × 2796** | Primary set — upload this first |
| 6.5" | 1284 × 2778 | Optional if Apple accepts 6.7" scaling |
| 5.5" | 1242 × 2208 | Legacy; often auto-generated from 6.7" |

**How to capture (iOS Simulator):**

```bash
# Boot iPhone 15 Pro Max simulator, open app, then:
xcrun simctl io booted screenshot home.png
```

Or use **Cmd + S** in Simulator. Resize only if needed; do not stretch.

**App Preview (optional video):** 15–30 s, same resolution as screenshots, no pricing or “free” claims unless accurate.

### Google Play Console

| Asset | Size | Required |
|-------|------|----------|
| **Phone screenshots** | Min **2**, max 8 · **9:16** recommended (e.g. 1080 × 1920) | Yes |
| **Feature graphic** | **1024 × 500** JPG/PNG | Yes |
| **Hi-res icon** | **512 × 512** PNG | Yes (often pulled from app bundle) |
| 7" / 10" tablet | Only if you support tablets | No (`supportsTablet: false`) |

**Feature graphic idea:** Lunara logo + tagline “Laundry made simple” on `#4F46E5` or white background; no small text.

**Promo video (YouTube):** Optional link on Play Store listing.

---

## Store copy (ready to paste)

### Short description (Google Play — 80 chars max)

```
Book laundry pickup & delivery. Track orders, pay securely, get notified.
```

### Subtitle (App Store — 30 chars max)

```
Laundry pickup & delivery
```

### Promotional text (App Store — 170 chars, editable without review)

```
Book door-to-door laundry in minutes. Track pickup, washing, and delivery live. Pay with GCash, card, wallet, or cash.
```

### Full description (both stores — ~4000 chars max)

Use the same body on iOS **Description** and Android **Full description**:

```
Lunara makes laundry simple — book pickup and delivery from your phone, pay securely, and follow your order from door to door.

BOOK IN MINUTES
Choose your service, pick a time, add your address, and confirm. No need to find a shop — Lunara assigns a trusted laundry partner for you.

DOOR-TO-DOOR SERVICE
Schedule pickup and delivery at home or work. Pin your location for accurate rider routing.

TRACK IN REAL TIME
See every step: dispatch, shop processing, out for delivery, and delivered. Get notifications when your order status changes.

PAY YOUR WAY
Use GCash, card, Lunara wallet, or cash on pickup/delivery — whatever works for you.

STAY IN CONTROL
View order history, top up your wallet, request refunds, and contact support if something goes wrong.

ACCOUNT & PRIVACY
Manage your profile and saved addresses. Request account deletion from Profile. Read our Privacy Policy at lunara.app/privacy.

Lunara — laundry made simple.
```

### Keywords (App Store only — 100 chars, comma-separated, no spaces after commas)

```
laundry,pickup,delivery,wash,dry clean,booking,Philippines,GCash,door to door
```

### What’s New (version 1.0.0)

See [apps/customer-mobile/RELEASE_NOTES.md](../apps/customer-mobile/RELEASE_NOTES.md) for full copy. Short version:

```
Welcome to Lunara!

• Book laundry pickup and delivery from your phone
• Track every step — from dispatch to delivery
• Pay with GCash, card, wallet, or cash
• Real-time order updates and notifications
• Manage addresses, wallet, refunds, and support in one app

Laundry made simple.
```

---

## App Store Connect — checklist

Create app → **Apps → + → New App**:

| Field | Value |
|-------|--------|
| Platform | iOS |
| Name | Lunara |
| Primary language | English (U.S.) or English (UK) |
| Bundle ID | `com.lunara.customer` |
| SKU | `lunara-customer-ios` (any unique string) |
| User access | Full access |

**App Information**

- Category: Lifestyle  
- Content rights: you own or licensed all content  
- Age rating: complete questionnaire (no violence, gambling, etc.)  
- **App Privacy:** link privacy policy; declare data collected (see below)

**Pricing and availability**

- Price: Free  
- Availability: Philippines first (expand later if needed)

**App Review Information**

- Sign-in required: **Yes**  
- Demo account (if Apple requests):

  ```
  Phone: use a test number you control, OTP via your API/Twilio
  Or email: (seed account if enabled in staging)
  Notes: OTP login — contact support@lunara.app for review credentials if needed
  ```

- Notes for reviewer:

  ```
  Lunara is a laundry booking app. Sign in with phone OTP, book a service from Home,
  and track the order on the Orders tab. Location is used only when saving addresses.
  Push notifications are optional for order updates.
  ```

**Version 1.0.0**

- Upload build from EAS / TestFlight  
- Screenshots (6.7")  
- Description, keywords, support URL, marketing URL  
- Build → select uploaded IPA  

---

## Google Play Console — checklist

Create app → **All apps → Create app**:

| Field | Value |
|-------|--------|
| App name | Lunara |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Free |

**Store presence → Main store listing**

- Short description (80 chars) — see above  
- Full description — see above  
- App icon, feature graphic, phone screenshots  
- App category: **House & Home** or **Lifestyle**  

**Policy → App content**

| Item | Guidance |
|------|----------|
| **Privacy policy** | `https://lunara.app/privacy` |
| **Ads** | No (unless you add ads later) |
| **Content rating** | Complete IARC questionnaire → likely Everyone |
| **Target audience** | 18+ or general audience (no children’s app) |
| **Data safety** | See table below |
| **News app** | No |
| **COVID-19** | No |
| **Government apps** | No |

**Data safety form (typical for Lunara customer app)**

Declare what you collect; adjust if your production API differs:

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Name | Yes | No | Account, order fulfillment |
| Email | Optional | No | Account |
| Phone number | Yes | No | OTP login, rider handoff verification |
| Address | Yes | No | Pickup/delivery |
| Precise location | Optional | No | Pin address on map (when user grants) |
| Photos | Optional | No | Profile avatar |
| App activity (orders) | Yes | No | Core functionality |
| Device IDs | Yes (push token) | No | Push notifications |
| Payment info | Processed by provider | No | Payments (not stored as raw card in app) |

Data encrypted in transit: **Yes** (HTTPS API). Users can request deletion: **Yes** (Profile → Delete account / email support).

**Release → Production**

- Upload AAB from EAS (`eas submit` or manual)  
- Complete store listing + content rating + data safety  
- Roll out to **Internal testing** first, then **Production**

---

## Brand assets on disk

| Asset | Path |
|-------|------|
| App icon (1024×1024 source) | `packages/brand/assets/icon.png` |
| In-app brand color | `#4F46E5` (primary) |

Export **512×512** from icon for Play hi-res icon if Console does not auto-fill.

---

## Before you submit

- [ ] Privacy and terms pages live at `lunara.app/privacy` and `/terms`  
- [ ] Production API reachable from `EXPO_PUBLIC_API_URL`  
- [ ] Phone OTP works (Twilio on API) for real sign-up  
- [ ] Screenshots show production branding (no dev OTP hints)  
- [ ] TestFlight / internal track tested on real devices  
- [ ] Support email `support@lunara.app` monitored  

---

## Related docs

- [Customer mobile deployment](./DEPLOYMENT_CUSTOMER_MOBILE.md)
- [API deployment](./DEPLOYMENT_API.md)
