# Lunara — Project Overview

Lunara is a laundry-service platform connecting customers, laundry partners, and delivery riders. This doc orients new contributors; see the linked docs for depth on any one area.

## Monorepo layout

Turborepo + npm workspaces (`workspaces: ["apps/*", "packages/*"]`, npm 11, Node >=20).

### Apps (`apps/`)

| App | Stack | Purpose | Dev command | Port |
|---|---|---|---|---|
| `customer-web` | Next.js 15 / React 19 | Customer-facing website | `npm run dev --workspace=@lunara/customer-web` | 3000 |
| `api` | NestJS 11 + MongoDB (Mongoose) | Core backend API | `npm run dev --workspace=@lunara/api` | 3001 |
| `admin-web` | Next.js 15, Google Maps, socket.io-client | Internal admin dashboard | `npm run dev --workspace=@lunara/admin-web` | 3002 |
| `partner-web` | Next.js 15, dnd-kit, jsPDF/jsQR | Laundry partner/shop portal | `npm run dev --workspace=@lunara/partner-web` | 3003 |
| `ai-agents` | Next.js 15, `@anthropic-ai/sdk` | Internal "Lunara AI Team" chat app | `npm run dev --workspace=@lunara/ai-agents` | 3005 |
| `customer-mobile` | Expo 54 / React Native 0.81, Expo Router | Customer mobile app | `expo start` | 8081 |
| `partner-mobile` | Expo 54 / React Native 0.81, zustand | Partner mobile app | `expo start` | 8082 |
| `rider-mobile` | Expo 54 / React Native 0.81 | Delivery rider mobile app | `expo start` | 8083 |

Mobile apps support white-label partner brands via `LUNARA_PARTNER_SLUG` (see `partner-brands/`).

### Shared packages (`packages/`)

`@lunara/brand`, `@lunara/config`, `@lunara/hooks`, `@lunara/types`, `@lunara/ui`, `@lunara/utils`, `@lunara/validation`.

## Backend (apps/api)

- **Framework:** NestJS 11, MongoDB via Mongoose.
- **Auth:** JWT (access + refresh), bcrypt password login, Twilio Verify OTP over SMS, email verification, reCAPTCHA v3 on register/OTP to block spam signups. Full flow in [AUTH_FLOW.md](AUTH_FLOW.md).
- **Uploads:** Cloudinary (`src/common/storage/`) — see [[project_uploads_use_cloudinary]] memory for migration history.
- **Payments:** PayMongo. **Push:** Firebase. **Email:** SMTP.
- **Seeding/migrations:** `seed`, `seed:promotions`, `seed:services`, `seed:addons` npm scripts.

## Environment variables

Documented in root `.env.example`. Key groups: `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`/`JWT_REFRESH_SECRET`, `CLOUDINARY_*`, PayMongo keys, `GOOGLE_MAPS_API_KEY`, Firebase push, Twilio (`TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`/`VERIFY_SERVICE_SID`), `RECAPTCHA_SECRET_KEY`/`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` (ai-agents), `CORS_ORIGINS`, and per-app API URLs (`EXPO_PUBLIC_API_URL` for mobile, `NEXT_PUBLIC_API_URL` for web). Mobile-specific setup is in the root [README.md](../README.md).

## Where to look next

- Quick-start & per-app run instructions: root [README.md](../README.md)
- API routes: [API_ENDPOINTS.md](API_ENDPOINTS.md)
- Deployment: [DEPLOYMENT.md](DEPLOYMENT.md) + per-app `DEPLOYMENT_*.md`
- Partner architecture & pricing: [TERRITORIAL_PARTNER_ARCHITECTURE.md](TERRITORIAL_PARTNER_ARCHITECTURE.md), [PARTNER_PRICING_GUIDE.md](PARTNER_PRICING_GUIDE.md)
- Operations playbooks: [ADMIN_OPERATIONS_PLAYBOOK.md](ADMIN_OPERATIONS_PLAYBOOK.md), [PARTNER_OPERATIONS_PLAYBOOK.md](PARTNER_OPERATIONS_PLAYBOOK.md), [RIDER_OPERATIONS_PLAYBOOK.md](RIDER_OPERATIONS_PLAYBOOK.md)
- User flows & test cases: [USER_JOURNEYS.md](USER_JOURNEYS.md), [TEST_CASES.md](TEST_CASES.md)
