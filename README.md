# Lunara

Production-ready laundry management platform — customers, riders, partners, staff, and admins in one TurboRepo monorepo.

## Apps

| App | Port | Description |
|-----|------|-------------|
| `customer-web` | 3000 | Customer website |
| `api` | 3001 | NestJS backend |
| `admin-web` | 3002 | Admin dashboard |
| `partner-web` | 3003 | Laundry shop portal |
| `customer-mobile` | 8081 | Expo customer app |
| `rider-mobile` | 8082 | Expo rider app |

## Packages

- `@lunara/brand` — Shared app icon (`packages/brand/assets/icon.png`, sourced from repo root `icon.png`)
- `@lunara/types` — Shared TypeScript types & enums
- `@lunara/validation` — Zod schemas
- `@lunara/utils` — Business logic helpers (RBAC, order flow)
- `@lunara/config` — Theme & app config
- `@lunara/ui` — Shared React components
- `@lunara/hooks` — Shared React hooks & API client

## Quick Start

```bash
# Install dependencies
npm install

# Start infrastructure
docker compose up -d

# Copy environment
cp .env.example .env

# Seed dev users (partner, rider, admin — password: password123)
npm run seed --workspace=@lunara/api

# Build shared packages & run API
npm run build --workspace=@lunara/types
npm run build --workspace=@lunara/utils
npm run build --workspace=@lunara/validation
npm run build --workspace=@lunara/hooks
npm run dev --workspace=@lunara/api

# Run web apps (separate terminals)
npm run dev --workspace=@lunara/customer-web
npm run dev --workspace=@lunara/admin-web
npm run dev --workspace=@lunara/partner-web

# Run mobile apps (separate terminals — see Mobile Apps below)
npm run dev --workspace=@lunara/customer-mobile
npm run dev --workspace=@lunara/rider-mobile
```

## Mobile Apps

Both mobile apps are **Expo 54** projects using **Expo Router** and share packages from the monorepo (`@lunara/types`, `@lunara/utils`, `@lunara/hooks`, `@lunara/config`).

### Prerequisites

- Node 20+ (same as the rest of the monorepo)
- [Expo Go](https://expo.dev/go) on a physical device, **or** Android Studio / Xcode for emulators
- API running (`npm run dev --workspace=@lunara/api`) and Docker services up
- Phone and dev machine on the **same Wi‑Fi** when testing on a physical device

### Environment

Mobile apps read the monorepo root `.env` via `app.config.js`. Set:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3001
```

On a physical device, `localhost` points at the phone — not your PC. Both apps automatically rewrite `localhost` / `127.0.0.1` in `EXPO_PUBLIC_API_URL` to your dev machine’s LAN IP (derived from the Expo dev-server host). No manual IP editing is required when using Expo Go on the same network.

**Note:** Remote push notifications (FCM) do **not** work in Expo Go (SDK 53+). In-app notifications, Socket.IO realtime updates, and **on-device banners** (via `expo-notifications` local alerts) still work while the app is open. For background FCM push, use an [EAS development build](#push-notifications-firebase--eas) on a physical device.

### Run locally

| App | Command | Metro port | Dev login |
|-----|---------|------------|-----------|
| Customer | `npm run dev --workspace=@lunara/customer-mobile` | 8081 | Phone OTP → `123456`, or `customer@lunara.dev` / `password123` |
| Rider | `npm run dev --workspace=@lunara/rider-mobile` | 8082 | `rider@lunara.dev` / `password123` |

Platform shortcuts (from each app directory or via `--workspace`):

```bash
npm run android --workspace=@lunara/customer-mobile
npm run ios --workspace=@lunara/rider-mobile
```

Scan the QR code in the terminal with Expo Go (Android) or the Camera app (iOS).

### Customer mobile (`apps/customer-mobile`)

Expo slug: `lunara-customer` · scheme: `lunara`

| Screen | Route | Description |
|--------|-------|-------------|
| Splash | `/` | Welcome → Get Started / Sign in |
| Sign up | `/(auth)/signup` | Phone OTP → onboarding |
| Login | `/(auth)/login` | Phone OTP or email/password |
| Onboarding | `/onboarding/profile`, `/onboarding/address` | First-time profile & address setup |
| Home | `/(tabs)` | Book laundry, deals, notifications preview |
| Orders | `/(tabs)/orders` | Order list |
| Wallet | `/(tabs)/wallet` | Balance & top-up |
| Profile | `/(tabs)/profile` | Account, addresses, support & refunds links |
| Book | `/book` | Full booking flow (service → address → schedule → weight → add-ons → payment) |
| Checkout | `/checkout/[orderId]` | Retry payment for unpaid orders |
| Track order | `/orders/[id]` | Timeline, live WebSocket, delivery verify/sign, review/refund/lost-item |
| Notifications | `/notifications` | In-app alerts with mark-read and deep links |
| Review | `/review/[id]` | Star rating after completed orders |
| Refunds | `/refunds`, `/refunds/[id]`, `/orders/[id]/refund` | List, detail, and submit refund requests |
| Support | `/support`, `/support/[id]`, `/orders/[id]/lost-item` | Tickets and lost-item complaints |

Features mirror customer-web: managed-network booking (no shop picker), onboarding after signup, PayMongo / cash / wallet payment, order tracking with rider GPS when en route, delivery verification (last 4 digits of phone + signature), refunds, support tickets, and **dispatch notifications** (Socket.IO + in-app inbox + local banners; FCM when using an EAS build).

### Rider mobile (`apps/rider-mobile`)

Expo slug: `lunara-rider` · scheme: `lunara-rider` · requires **location** and **camera** permissions for field ops

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/login` | Email/password |
| Home | `/(tabs)/` | Shift on/off, earnings summary, route guide |
| Tasks | `/(tabs)/tasks` | Pickup offers, delivery queue, active tasks |
| Profile | `/(tabs)/profile` | Verification summary, edit profile, documents, earnings, notifications |
| Edit profile | `/profile/edit` | Name, phone, home address, vehicle type, plate/OR-CR number |
| Documents | `/documents` | Upload driver's license, OR/CR, NBI clearance, selfie for admin review |
| Pickup task | `/pickup/[id]` | Arrive → verify customer → collect → photo → receipt → drop at shop |
| Delivery task | `/delivery/[id]` | Pick up from shop → out for delivery → customer handoff → photo → complete |
| Earnings | `/earnings` | Today & total earnings |
| Task history | `/history` | Completed pickups and deliveries |
| Notifications | `/notifications` | Dispatch alerts with mark-read and tap-to-open task |
| SOS | Pickup/delivery task screens | Emergency button — notify dispatch + share live location during active tasks |

Real-time task offers and location updates use Socket.IO (`/tracking` namespace). **Dispatch notifications** cover pickup/delivery offers, assignments, order updates, and platform alerts (Socket.IO + in-app inbox + local banners; FCM when using an EAS build). **Riders must complete profile and get all KYC documents approved** before going online (`POST /riders/online` returns 403 until verified). Admins review documents at admin-web **Riders → rider detail**. Task photos upload to the API (`/riders/*/photo-upload`). See [Dispatch notifications](#dispatch-notifications-realtime), [Push notifications setup](#push-notifications-firebase--eas), and [Test dispatch notifications](#test-dispatch-notifications) for the full walkthrough.

### Troubleshooting (Metro / Expo)

If you see **`Unable to deserialize cloned data`** or **`Error while reading cache, falling back to a full crawl`**, Metro’s file-map cache is stale (common after a Node or Expo upgrade). It is usually harmless once Metro finishes the full crawl, but you can clear it:

```bash
npm run dev:clear --workspace=@lunara/customer-mobile
# or rider-mobile
npm run dev:clear --workspace=@lunara/rider-mobile
```

That runs `expo start --clear`. You can also delete `apps/<mobile-app>/.expo` and restart.

### Push notifications (Firebase + EAS)

Mobile apps register native device tokens with `POST /api/v1/users/me/push-token`. The API sends FCM messages via `firebase-admin` when in-app notifications are created (customer **order/dispatch updates**, rider assignments, refunds, review requests) and when pickup/delivery offers are dispatched to online riders.

**One-time setup:**

1. Create a [Firebase project](https://console.firebase.google.com/) and enable Cloud Messaging.
2. Add Android apps (`com.lunara.rider`, `com.lunara.customer`) and an iOS app for each bundle ID.
3. Download a Firebase **service account** JSON and set in the API `.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (escape newlines as `\n`)
4. Upload FCM and APNs credentials to EAS for each app:
   ```bash
   cd apps/rider-mobile && eas credentials
   cd apps/customer-mobile && eas credentials
   ```
5. Build dev clients and test on a **physical device** (simulators do not receive FCM):
   ```bash
   npm run build --workspace=@lunara/rider-mobile -- --profile development
   ```

Push is skipped when Firebase env vars are missing (local dev without credentials still works for in-app + socket alerts).

### Dispatch notifications (realtime)

Both mobile apps stay connected to the API Socket.IO namespace **`/tracking`** while signed in. Dispatch and order-pipeline events trigger three layers:

| Layer | Customer mobile | Rider mobile |
|-------|-----------------|--------------|
| **Socket** | `joinCustomer` + `joinOrder` on active orders | `joinRider`, `joinRiders` when online, `joinOrder` on tasks |
| **In-app inbox** | `GET /notifications/me` (bell on Home) | `GET /riders/notifications` (bell on Home) |
| **Local banner** | Immediate `expo-notifications` alert while app is open | Same for offers, assignments, dispatch alerts |
| **FCM push** | When Firebase is configured + EAS build | Same |

**Customer events** (examples): `awaitingDispatch`, `shopAssigned`, `findingRider`, `riderAssigned`, `pickedUp`, `outForDelivery`, `delivered`, etc. Copy lives in `@lunara/utils` (`ORDER_EVENT_MESSAGES`). The API persists each event via `CustomerOrderNotificationService` when `TrackingGateway.emitOrderEvent` runs.

**Rider events** (examples): `pickupOffer`, `deliveryOffer`, `pickupAssignment`, `deliveryAssignment`, `riderNotification`, plus `orderStatusUpdate` / `orderEvent` on joined orders.

**Key files**

| Area | Path |
|------|------|
| API gateway | `apps/api/src/modules/realtime/tracking.gateway.ts` |
| Customer push + inbox | `apps/api/src/modules/push/customer-order-notification.service.ts` |
| Rider notifications | `apps/api/src/modules/riders/rider-notification.service.ts` |
| Customer socket UI | `apps/customer-mobile/src/components/customer-tracking-sync.tsx` |
| Rider socket UI | `apps/rider-mobile/src/hooks/use-rider-dispatch-socket.ts` |

### Test dispatch notifications

Prerequisites: API running, seed completed, customer + rider mobile dev servers, same Wi‑Fi if using a physical device.

#### Customer mobile (port 8081)

1. Sign in as `customer@lunara.dev` / `password123` (or complete OTP signup).
2. Book and **pay** an order (wallet or mock PayMongo) so status becomes `pending_dispatch`.
3. Keep the customer app **open** on Home or Orders — you should see a local banner: *Order received* / *pending dispatch*.
4. In **admin-web** (3002) → **Dispatch** → assign a shop to the order.
5. Customer app should banner *Shop assigned*; open **Notifications** (bell on Home) — new row with deep link to the order.
6. Assign a **pickup rider** from admin → customer sees *Rider assigned* (socket + inbox).
7. Complete pickup/delivery in rider + partner portals — each major step emits `orderEvent` and updates the customer timeline and notifications.

**Verify socket only:** With customer app on order track (`/orders/[id]`), timeline and status should update live without manual refresh.

#### Rider mobile (port 8082)

1. Sign in as `rider@lunara.dev` / `password123`.
2. Complete **profile + all KYC documents** (admin approves at admin-web → Riders → rider detail) if not already verified.
3. Tap **Go online** on Home (joins `riders:online` room).
4. From admin, **assign pickup** to this rider (or broadcast pickup request and accept in app).
5. Rider should get a **local banner** (*New pickup offer* or *New assignment*) and Tasks list refreshes.
6. Accept task → complete pickup workflow → after partner marks **ready for delivery**, assign delivery rider.
7. Rider gets delivery assignment notification; **Notifications** screen shows unread count on the Home bell.
8. Tap a notification → navigates to `/pickup/[id]` or `/delivery/[id]`.

**Offers vs assignments:** Pickup/delivery **offers** broadcast to all online riders (`joinRiders`). **Assignments** go to the assigned rider’s room (`joinRider`). Rider must be online to receive offers.

#### Background push (optional)

1. Configure [Firebase + EAS](#push-notifications-firebase--eas).
2. Install a **development build** on a physical device.
3. Sign in, grant notification permission, background the app.
4. Trigger dispatch from admin — FCM should deliver; tapping opens the relevant order/task screen.

### Monorepo notes

- `metro.config.js` in each app pins a single `react` / `react-native` instance from the repo root to avoid invalid hook errors.
- Shared business logic lives in `@lunara/utils`; API calls use `@lunara/hooks` with the mobile-specific base URL from `src/api-config.ts`.
- Production builds: use [EAS Build](https://docs.expo.dev/build/introduction/) (`npm run build` prints a placeholder message).

## End-to-End Test Flow

### Customer sign-up (OTP)

Works on **customer-web** (http://localhost:3000) or **customer-mobile** (Expo, port 8081) — same API and dev OTP.

1. **Sign up** at http://localhost:3000/signup — enter mobile → OTP `123456` (dev)
2. **Complete profile** and **add address** (onboarding screens)
3. **Dashboard** at http://localhost:3000/dashboard

### Book laundry

1. Or **register with email/password** at http://localhost:3000/register (skips OTP; still needs address if none)
2. **Book laundry** at http://localhost:3000/book — service → address → schedule → weight → add-ons → estimate → confirm
3. **Pay order** at http://localhost:3000/checkout/{orderId} — PayMongo (GCash/Maya/Card), cash on pickup/delivery, or wallet
4. **Top up wallet** at http://localhost:3000/wallet (₱500) if paying by wallet
5. Payment success → receipt code → track order (rider dispatches after paid or cash booking confirmed)
6. Track order — **waiting for rider** after payment
7. **Rider pickup** (rider app port 8082) — go online → accept offer → arrive → verify customer (last 4 of phone) → collect → photo → receipt → picked up
8. **Partner processing** (http://localhost:3003) — `partner@lunara.dev` / `password123` → Orders → step through receive → weigh → tag → sort → wash → dry → fold → iron (optional) → QC → pack → ready for delivery
9. **Delivery** — auto-notify riders when ready → rider accepts → delivers → customer verifies (last 4 of phone) & signs on order track → rider completes → delivered → completed
10. **Track order** — http://localhost:3000/orders → select order → full timeline (booking → delivered) + live WebSocket notifications and rider GPS when en route. Same updates appear in **customer-mobile** (notifications bell + `/orders/[id]`) — see [Dispatch notifications](#dispatch-notifications-realtime)
11. **Submit review** — when order is completed, notification on dashboard + track page → http://localhost:3000/orders/{id}/review → 1–5 stars, comment, submit → review published

### Rider daily operations (mobile port 8082)

See [Mobile Apps](#mobile-apps) for setup (Expo Go, Wi‑Fi, env). Then:

1. Open rider app → **Login** (`rider@lunara.dev` / `password123`)
2. **Go online** on the Operations screen
3. **Accept pickup** → navigate → verify → collect → photo → **drop at laundry shop** → complete (₱80)
4. After partner processing, **accept delivery** → navigate → arrive → customer verifies/signs → complete (₱120)
5. **Earnings** update on home and Earnings screen
6. Watch **Notifications** (bell) and local banners as admin assigns shops/riders — see [Test dispatch notifications](#test-dispatch-notifications)

### Partner laundry shop — daily operations (partner portal port 3003)

1. Run seed if needed: `npm run seed --workspace=@lunara/api` (includes `partner@lunara.dev`, `staff@lunara.dev`)
2. **Login** at http://localhost:3003/login — `partner@lunara.dev` / `password123`
3. **Dashboard** — incoming count, processing, revenue today/week, low-stock alerts
4. **Incoming orders** → open order → **Assign staff** (or use Staff page to view workload)
5. **Monitor progress** — track in-shop pipeline and ready-for-delivery orders
6. **Inventory** — adjust detergent, bags, tags; low stock surfaces on dashboard
7. **Reports** — 7/14/30-day operational summary (orders by status, revenue)
8. **Revenue** — today, month-to-date, 7-day chart

### Laundry staff processing (same portal, staff role)

1. **Login** — `staff@lunara.dev` / `password123` (redirects to processing queue)
2. **View queue** → accept a job (or process if partner already assigned you)
3. Complete each stage (weight, tag, wash, dry, etc.) with optional progress photo URL
4. Finish through **Ready for delivery** → admin dispatcher assigns delivery rider

### User roles

| Role | Portal | Can | Cannot |
|------|--------|-----|--------|
| **Customer** | customer-web (3000), customer-mobile (8081) | Book service; choose service type, schedule, address, payment | Choose laundry shop |
| **Admin dispatcher** | admin-web (3002) — Control tower, Dispatch, Orders | Review orders; assign shop & rider; monitor SLA & progress; resolve conflicts | Process laundry; accept rider jobs |
| **Laundry partner** | partner-web (3003) | Accept assigned orders; process laundry; request pickup/delivery | Browse or compete for unassigned orders |
| **Shop staff** | partner-web | Processing queue; advance steps; photos | Accept franchise orders (partner only) |
| **Rider** | rider-mobile (8082) | Accept offered tasks; pickup; deliver to shop/customer; proof photos | Pick orders outside offers/assignment |

Role constants live in `@lunara/utils` (`PLATFORM_USER_ROLES`).

### Managed laundry network (customer → admin dispatch → partner → rider)

Flow: **Customer** → **Lunara platform** (book + pay) → **Admin dispatcher** assigns branch → **Partner laundry shop** processes → **Rider** pickup & delivery.

1. Customer **books** at http://localhost:3000/book — no branch is assigned at booking time
2. Customer **pays** — order status becomes `pending_dispatch` (Pending Dispatch); riders are **not** notified yet
3. Admin **New orders queue** — evaluates location, capacity, performance, availability, turnaround → assigns shop → `shop_assigned`
4. Admin **New orders** — http://localhost:3002/dispatch shows `pending_dispatch` orders with shop evaluation matrix
5. On assign — order gets `branchId`, `partnerId`, status `shop_assigned`, estimated turnaround (pickup does **not** start automatically)
6. **Partner** accepts the order, then **Request pickup** (optional marketplace broadcast)
7. **Admin assigns pickup rider** — manual assign or **auto-suggest → admin confirm** → status `rider_assigned_pickup` + rider notification
8. **Rider pickup workflow** — accept → navigate → pickup (`picked_up`) → photo → receipt → deliver to shop (`in_transit_to_shop`)
9. **Shop receiving** (partner portal) — receive laundry → verify weight → confirm items → `received_at_shop`
10. **Laundry processing** — received → sorting → washing → … → `ready_for_delivery`
11. **Delivery assignment** — admin assigns → `rider_assigned_delivery`
12. **Customer delivery** — pickup from shop → `out_for_delivery` → customer receives → photo proof → signature → `delivered` → `completed`
8. **Admin control tower** — http://localhost:3002/control-tower (SLA watchlist, conflicts, order ops at `/orders/{id}`)

**Customer booking statuses:** `pending` → … → `ready_for_delivery` → `rider_assigned_delivery` → `out_for_delivery` → `delivered` → `completed`

**Rider delivery API:** `POST .../delivery-tasks/:id/pickup-from-shop` · `out-for-delivery` · `customer-received` · `photo` · `complete`

**Admin delivery API:** `GET .../suggest-delivery-rider` · `POST .../confirm-delivery-rider` · `POST .../assign-rider` with `type: "delivery"`

**Partner receiving API:** `POST .../receiving/receive` · `verify-weight` · `confirm-items`

**Rider pickup API:** `POST .../pickup-tasks/:id/arrive` · `collect` · `photo` · `generate-receipt` · `drop-at-shop`

**Admin rider assignment:** `GET /admin/operations/orders/:id/suggest-pickup-rider` · `POST .../confirm-pickup-rider` · `POST .../assign-rider`

Admin **Monitor shops** (http://localhost:3002/shops) lists branches with live capacity. Branches seed on first dispatch/branch API call (requires `partner@lunara.dev` from seed).

### Refund request (customer + admin)

1. Pay for an order (wallet, PayMongo mock, or cash flow with paid status)
2. **Submit refund request** — http://localhost:3000/orders/{orderId}/refund
3. **Admin review** — http://localhost:3002/refunds → open request → Start review
4. **Verify order** — confirm payment and order details
5. **Approve / reject** — set approved amount or rejection reason
6. **Process refund** — credits customer wallet, marks payment & order refunded
7. **Notify customer** — in-app notification + order WebSocket event

Track status: http://localhost:3000/refunds/{refundId}

### Lost item complaint (customer + admin)

1. Complete an order (delivered/completed) on customer-web
2. **Customer complaint** — http://localhost:3000/orders/{orderId}/lost-item — describe missing items
3. **Support ticket created** — redirects to `/support/{ticketId}` with flow progress
4. **Admin investigation** — http://localhost:3002/support → open lost-item ticket
5. **Review photos** — pickup, delivery, and processing stage photos from the order
6. **Review laundry logs** — processing steps and status history
7. **Determine outcome** — found / compensated / no action / denied
8. **Compensation** — credit customer wallet (e.g. ₱200)
9. **Close ticket** — ticket closed; customer sees final status on `/support/{ticketId}`

### Admin platform management (admin dashboard port 3002)

1. **Login** at http://localhost:3002/login — `admin@lunara.dev` / `password123`
2. **Overview dashboard** — active orders, riders online, shops, open tickets, MTD revenue
3. **Monitor orders** — filter by status, platform-wide list
4. **Monitor riders** — online status, verification status, earnings, active tasks; review KYC documents
5. **Monitor shops** — partner accounts, order volume, revenue
6. **Monitor revenue** — today, month, 7-day chart, revenue by service
7. **Support tickets** — view, update status/priority, add admin notes
8. **Reports** — 7/14/30-day platform analytics
9. **Promotions** — create codes, toggle active/inactive

Dev logins (after seed): `partner@lunara.dev`, `staff@lunara.dev`, `rider@lunara.dev`, `admin@lunara.dev` / `password123`

OTP login (dev): any phone → OTP is always `123456`

## Documentation

See [`docs/`](./docs/) for architecture, database schemas, API reference, and development roadmap. Mobile app setup, dispatch notifications, and screen reference are in [Mobile Apps](#mobile-apps) above.

**Production deployment:** [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — backend on Render, web apps on Vercel, MongoDB Atlas, Redis, and EAS for mobile.

## Theme

- Primary: `#4F46E5`
- Secondary: `#06B6D4`
- Accent: `#22C55E`
