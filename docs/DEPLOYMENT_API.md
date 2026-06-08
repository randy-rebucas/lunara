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

**Note:** The Dockerfile uses a multi-stage build:
- **deps stage:** Copies all workspace dependencies and installs them (so npm ci resolves the full monorepo workspace graph)
- **builder stage:** Copies only the API source code and runs `npm run build --workspace=@lunara/api` (Turbo automatically builds dependencies in order: types → utils → validation → api)
- **runner stage:** Copies only the built API dist and production node_modules

This approach ensures dependencies are properly installed, but avoids unnecessary builds of other apps (web frontends, mobile) that aren't needed in the API Docker image.

### Option B — Native Node

| Setting | Value |
|---------|-------|
| **Environment** | Node |
| **Root directory** | *(repo root — leave blank)* |
| **Install command** | `npm ci --include=dev` |
| **Build command** | `npm run build` |
| **Start command** | `node apps/api/dist/main.js` |
| **Health check path** | `/api/v1/health` |

**Critical:** The install command **must include** `--include=dev` to install devDependencies (rimraf, turbo, nest-cli, etc.) that the build scripts require. Without this flag, build scripts fail with "command not found" errors.

**Build command:** To ensure Turbo properly orchestrates the build order (dependencies first, then API):

```bash
npm run build --workspace=@lunara/api
```

This tells Turbo to build only the API but respects the `dependsOn: ["^build"]` configuration, ensuring workspace packages are built first automatically.

**Why this matters:** The root `npm run build` runs Turbo globally on ALL workspaces. In some cases (especially in limited environments), this can cause race conditions or ordering issues. Using `--workspace=@lunara/api` explicitly tells Turbo to build the API and its dependencies, which is more reliable.

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
| Build fails: "Cannot find module '@lunara/types'" (TS2307) or similar for other workspace packages | Turbo not properly orchestrating build order. Workspace packages haven't been compiled yet when API tries to compile. | Change build command to: `npm run build --workspace=@lunara/api`. This ensures Turbo builds dependencies first, then the API. |
| Build fails: `rimraf: not found` or `nest: not found` | devDependencies not installed | Render's Native Node install command missing `--include=dev` flag. Set **Install command** to `npm ci --include=dev` (not just `npm ci`). |
| Build fails with `exit code: 2` | TypeScript or NestJS compilation errors | Check Render logs for detailed error; likely type annotation or import issues. Check `packages/validation/src/` for TypeScript errors. |
| Build fails with `exit code: 127` | Source files missing in Docker build | Ensure builder stage copies: `apps/api`, `packages`, `tsconfig.base.json`, `turbo.json`, and root `package.json`. Build command must be `npm run build --workspace=@lunara/api` (not full monorepo build). |
| Build fails: Cannot find `/app/package.json` | Root package.json not copied to builder | Ensure builder stage includes: `COPY --from=deps /app/package.json /app/package-lock.json* ./` |
| Build fails: "Cannot find module '@lunara/types'" | Workspace dependencies not installed | Ensure deps stage copies entire directories: `COPY packages/ ./packages/` and `COPY apps/api/ ./apps/api/` (not just glob patterns like `packages/*/package.json`). |
| Build fails: "Workspace not found" | Workspace not installed | Verify `npm ci --include-workspace-root` completes successfully in deps stage. Check `package.json` has `"workspaces": ["apps/*", "packages/*"]`. |
| API crashes on start | Missing `JWT_SECRET` / `JWT_REFRESH_SECRET` | Set both in Render environment variables. API refuses to start in production without these. |
| Health check `503`, `mongo: error` | Atlas network block or bad URI | Allow Render outbound IPs on MongoDB Atlas. Verify `MONGODB_URI` connection string is correct. |
| Health check `503`, `redis: error` | Redis unreachable | Verify `REDIS_URL` is correct. Use internal Render URL for Render Key Value. Test connectivity from Render instance. |
| Uploads 404 after redeploy | Ephemeral disk | Attach Render persistent disk mounted at `/app/uploads` (minimum 1 GB). Without it, uploads are lost on each redeploy. |
| WebSocket fails to connect | API URL protocol mismatch | Ensure `NEXT_PUBLIC_API_URL` and `EXPO_PUBLIC_API_URL` use `https://` (not `http://`). WebSocket requires TLS in production. |

---

## Related docs

- [Main deployment guide](./DEPLOYMENT.md)
- [Architecture](./ARCHITECTURE.md)
- [API endpoints](./API_ENDPOINTS.md)
