# API Deployment Guide

Deploy the NestJS API (`apps/api`) to **Render** with MongoDB Atlas and Redis.

---

## Prerequisites

- Node.js **20+**
- MongoDB Atlas cluster (M10+ recommended for production)
- Redis instance (Render Key Value, Upstash, or Redis Cloud)
- GitHub (or GitLab) repo connected to Render
- Strong JWT secrets

---

## Architecture

```
┌─────────────────────────────────┐
│  Render Web Service (NestJS)    │
├─────────────────────────────────┤
│ - REST API: /api/v1/*           │
│ - WebSockets: /tracking         │
│ - Health: /api/v1/health        │
│ - Persistent disk: /app/uploads │
└────────┬──────────────┬──────────┘
         │              │
         ▼              ▼
   ┌─────────┐   ┌──────────┐
   │ MongoDB │   │  Redis   │
   │ Atlas   │   │ (Render) │
   └─────────┘   └──────────┘
```

---

## 1. MongoDB Atlas Setup

1. Create a cluster and database user with read/write access.
2. Network access: allow Render outbound IPs, or `0.0.0.0/0` during initial setup (tighten later).
3. Copy the connection string:

```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/lunara?retryWrites=true&w=majority
```

---

## 2. Redis Setup

The API uses Redis for caching, sessions, and Socket.IO scaling. Set:

```bash
REDIS_URL=redis://default:<password>@<host>:6379
```

**Render Key Value:** create a Redis instance in the same region as the API and paste the internal URL into `REDIS_URL`.

**Upstash:** use the `rediss://` URL if TLS is enabled; `ioredis` supports both.

---

## 3. Render Deployment

Deploy `apps/api` as a **Web Service**.

### Option A — Docker (recommended)

| Setting | Value |
|---------|-------|
| **Environment** | Docker |
| **Root directory** | *(repo root — leave blank)* |
| **Dockerfile path** | `docker/api.Dockerfile` |
| **Health check path** | `/api/v1/health` |

Render sets `PORT` automatically; the API reads `process.env.PORT ?? 3001`.

**Note:** The Dockerfile uses multi-stage build to properly install all workspace dependencies before building the API. Ensure all `packages/*/package.json` files are included in the deps stage.

### Option B — Native Node

| Setting | Value |
|---------|-------|
| **Environment** | Node |
| **Root directory** | *(repo root)* |
| **Build command** | See below |
| **Start command** | `node apps/api/dist/main.js` |
| **Health check path** | `/api/v1/health` |

**Build command:**

```bash
npm ci && npm run build --workspace=@lunara/api
```

This uses Turbo to automatically build all dependencies (`@lunara/types`, `@lunara/utils`, `@lunara/validation`) in the correct order via `turbo.json`'s `dependsOn` configuration.

**If Turbo is unavailable, use:**

```bash
npm ci \
  && npm run build --workspace=@lunara/types \
  && npm run build --workspace=@lunara/utils \
  && npm run build --workspace=@lunara/validation \
  && npm run build --workspace=@lunara/api
```

---

## 4. Environment Variables

Set these in **Render → Settings → Environment Variables**.

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `MONGODB_URI` | Atlas connection string | `mongodb+srv://...` |
| `REDIS_URL` | Redis connection URL | `redis://...` |
| `JWT_SECRET` | Token secret (≥ 32 chars) | *(generate random)* |
| `JWT_REFRESH_SECRET` | Refresh secret (≥ 32 chars) | *(generate random)* |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh expiry | `30d` |

### Recommended

| Variable | Description | Example |
|----------|-------------|---------|
| `API_URL` | Public API URL | `https://api.lunara.example.com` |
| `CUSTOMER_WEB_URL` | Customer site URL (for emails/links) | `https://lunara.example.com` |

### Optional (integrations)

| Variable | When needed |
|----------|-------------|
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Push notifications (FCM) |
| `GOOGLE_MAPS_API_KEY` | Distance / routing |
| `STRIPE_SECRET_KEY`, `GCASH_MERCHANT_ID`, `MAYA_PUBLIC_KEY` | Live payments |
| `TWILIO_*`, `SENDGRID_API_KEY` | SMS / email |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_*` | OAuth login |

See [`.env.example`](../.env.example) for the full list.

---

## 5. File Uploads (Important)

The API stores uploads locally under `uploads/` (avatars, rider KYC documents, task photos).

**Production options:**

1. **Render persistent disk (simplest)** — Attach a disk mounted at `/app/uploads` (Docker). Minimum 1 GB; scale as needed.
2. **Object storage (future)** — `.env.example` includes AWS S3 / Cloudinary placeholders.

Until object storage is implemented, use a **single API instance** plus persistent disk, or accept that uploads reset on deploy.

---

## 6. WebSockets

No extra configuration required. Frontends connect to:

```
wss://<your-api-host>/tracking
```

Ensure `NEXT_PUBLIC_API_URL` (web) and `EXPO_PUBLIC_API_URL` (mobile) point at the same API host.

---

## 7. Custom Domain

1. Render → Web Service → **Settings → Custom Domains**
2. Add e.g. `api.lunara.example.com`
3. Create the CNAME record Render provides
4. Update `API_URL` environment variable to the new domain

---

## 8. Post-Deploy

### Verify API is running

```bash
curl https://<api-host>/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "checks": {
    "mongo": "ok",
    "redis": "ok"
  }
}
```

### Seed initial data (first deploy only)

From your machine with network access to Atlas:

```bash
MONGODB_URI="mongodb+srv://..." \
JWT_SECRET="..." \
JWT_REFRESH_SECRET="..." \
NODE_ENV=production \
npm run seed --workspace=@lunara/api
```

This creates default accounts. **Rotate or disable passwords** before going live.

---

## 9. Operations

### Logs

Render → Service → **Logs** (stdout/stderr)

### Redeploy

Push to the connected branch, or **Manual Deploy** on Render.

### Scaling

Start with Render Standard instance; scale instance type under load. For multiple instances, you'll need shared upload storage (S3) and Redis-backed Socket.IO adapter.

### Backups

- **MongoDB Atlas:** enable continuous backup / snapshots
- **Uploads:** back up Render persistent disk or migrate to S3

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Build fails: "Cannot find module '@lunara/types'" | Workspace dependencies not built | Ensure `npm ci` completes before `npm run build`. Use `npm run build --workspace=@lunara/api` (not individual workspace commands); npm/Turbo handles dependency order. |
| Build fails: "Workspace not found" | Workspace not installed | Check `npm ci` installed all workspaces; verify `package.json` root has `"workspaces": ["apps/*", "packages/*"]` |
| API crashes on start | Missing `JWT_SECRET` / `JWT_REFRESH_SECRET` | Set both in Render environment |
| Health check `503`, `mongo: error` | Atlas network block or bad URI | Allow Render IPs; verify `MONGODB_URI` |
| Health check `503`, `redis: error` | Redis unreachable | Check `REDIS_URL` and connectivity |
| Uploads 404 after redeploy | Ephemeral disk | Attach Render persistent disk |
| WebSocket fails | API URL mismatch | Use `https://` in public URLs |

---

## Related docs

- [Main deployment guide](./DEPLOYMENT.md)
- [Architecture](./ARCHITECTURE.md)
- [API endpoints](./API_ENDPOINTS.md)
