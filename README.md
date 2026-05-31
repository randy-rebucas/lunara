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
| Splash | `/` | Welcome → Get Started |
| Login | `/(auth)/login` | Phone OTP or email/password |
| Home | `/(tabs)` | Book laundry, quick links |
| Orders | `/(tabs)/orders` | Order list |
| Wallet | `/(tabs)/wallet` | Balance & top-up |
| Profile | `/(tabs)/profile` | Account info |
| Book | `/book` | Full booking flow (service → address → schedule → weight → add-ons → payment) |
| Track order | `/orders/[id]` | Timeline, live WebSocket updates, delivery verify/sign |

Features mirror customer-web: managed-network booking (no shop picker), PayMongo / cash / wallet payment, order tracking with rider GPS when en route, and delivery verification (last 4 digits of phone + signature).

### Rider mobile (`apps/rider-mobile`)

Expo slug: `lunara-rider` · scheme: `lunara-rider` · requires **location** permission for GPS tracking

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/login` | Email/password |
| Operations | `/` | Go online/offline, pickup & delivery offers, active tasks, earnings summary |
| Pickup task | `/pickup/[id]` | Arrive → verify customer → collect → photo → receipt → drop at shop |
| Delivery task | `/delivery/[id]` | Pick up from shop → navigate → customer verify/sign → photo → complete |
| Earnings | `/earnings` | Today & total earnings |
| Notifications | `/notifications` | Rider alerts |

Real-time task offers and location updates use Socket.IO (`/tracking` namespace). See [End-to-End Test Flow → Rider daily operations](#rider-daily-operations-mobile-port-8082) for the full pickup/delivery walkthrough.

### Troubleshooting (Metro / Expo)

If you see **`Unable to deserialize cloned data`** or **`Error while reading cache, falling back to a full crawl`**, Metro’s file-map cache is stale (common after a Node or Expo upgrade). It is usually harmless once Metro finishes the full crawl, but you can clear it:

```bash
npm run dev:clear --workspace=@lunara/customer-mobile
# or rider-mobile
npm run dev:clear --workspace=@lunara/rider-mobile
```

That runs `expo start --clear`. You can also delete `apps/<mobile-app>/.expo` and restart.

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
10. **Track order** — http://localhost:3000/orders → select order → full timeline (booking → delivered) + live WebSocket notifications and rider GPS when en route
11. **Submit review** — when order is completed, notification on dashboard + track page → http://localhost:3000/orders/{id}/review → 1–5 stars, comment, submit → review published

### Rider daily operations (mobile port 8082)

See [Mobile Apps](#mobile-apps) for setup (Expo Go, Wi‑Fi, env). Then:

1. Open rider app → **Login** (`rider@lunara.dev` / `password123`)
2. **Go online** on the Operations screen
3. **Accept pickup** → navigate → verify → collect → photo → **drop at laundry shop** → complete (₱80)
4. After partner processing, **accept delivery** → navigate → arrive → customer verifies/signs → complete (₱120)
5. **Earnings** update on home and Earnings screen

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
4. **Monitor riders** — online status, earnings, active tasks
5. **Monitor shops** — partner accounts, order volume, revenue
6. **Monitor revenue** — today, month, 7-day chart, revenue by service
7. **Support tickets** — view, update status/priority, add admin notes
8. **Reports** — 7/14/30-day platform analytics
9. **Promotions** — create codes, toggle active/inactive

Dev logins (after seed): `partner@lunara.dev`, `staff@lunara.dev`, `rider@lunara.dev`, `admin@lunara.dev` / `password123`

OTP login (dev): any phone → OTP is always `123456`

## Documentation

See [`docs/`](./docs/) for architecture, database schemas, API reference, and development roadmap. Mobile app setup and screen reference are in [Mobile Apps](#mobile-apps) above.

## Theme

- Primary: `#4F46E5`
- Secondary: `#06B6D4`
- Accent: `#22C55E`
