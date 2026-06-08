# API Deployment (Render)

Deploy **only** the NestJS API (`apps/api`) to Render. Web apps go to Vercel; mobile apps go to EAS — neither belongs on Render.

---

## Quick setup (Render dashboard)

### Docker — recommended

| Setting | Value |
|---------|--------|
| **Service type** | Web Service |
| **Environment** | Docker |
| **Root directory** | *(leave blank — repo root)* |
| **Dockerfile path** | `docker/api.Dockerfile` |
| **Build command** | *(leave blank)* |
| **Start command** | *(leave blank — set in Dockerfile)* |
| **Health check path** | `/api/v1/health` |

The Dockerfile builds **only** `@lunara/api` and its workspace packages (`types`, `utils`, `validation`). It does not build web or mobile apps.

**Or use the blueprint:** connect the repo via [Render Blueprints](https://render.com/docs/blueprint-spec) using the included [`render.yaml`](../render.yaml).

### Native Node — alternative

| Setting | Value |
|---------|--------|
| **Environment** | Node |
| **Root directory** | *(leave blank)* |
| **Install command** | `npm ci --workspace=@lunara/api --include-workspace-root --include=dev` |
| **Build command** | `npm run build:api` |
| **Start command** | `node apps/api/dist/main.js` |
| **Health check path** | `/api/v1/health` |

> **Never set Build command to `npm run build`.** That runs Turbo across every app with a `build` script (admin-web, customer-web, partner-web, etc.) and will fail on Render.

---

## Architecture

```
┌─────────────────────────────────┐
│  Render Web Service (NestJS)    │
├─────────────────────────────────┤
│  REST:       /api/v1/*          │
│  WebSocket:  /tracking          │
│  Health:     /api/v1/health     │
│  Uploads:    /app/uploads       │
└────────┬──────────────┬─────────┘
         │              │
         ▼              ▼
   MongoDB Atlas    Redis
```

---

## Prerequisites

- MongoDB Atlas cluster
- Redis (Render Key Value, Upstash, or Redis Cloud)
- Git repo connected to Render
- Strong JWT secrets

---

## 1. MongoDB Atlas

```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/lunara?retryWrites=true&w=majority
```

Allow Render outbound IPs in Atlas network access (or `0.0.0.0/0` temporarily while testing).

---

## 2. Redis

```bash
REDIS_URL=redis://default:<password>@<host>:6379
```

Use Render’s **internal** Redis URL when API and Redis are on the same Render account/region.

---

## 3. Environment variables

Set in **Render → Settings → Environment**.

### Required

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string |
| `REDIS_URL` | Redis URL |
| `JWT_SECRET` | Random string (≥ 32 chars) |
| `JWT_REFRESH_SECRET` | Different random string |
| `JWT_EXPIRES_IN` | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |

### Recommended

| Variable | Example |
|----------|---------|
| `API_URL` | `https://lunara-api.onrender.com` |
| `CUSTOMER_WEB_URL` | Your customer site URL |

### Optional

Firebase (`FIREBASE_*`), payments, maps, OAuth, SMS/email — see [`.env.example`](../.env.example).

Render sets `PORT` automatically; the API uses `process.env.PORT ?? 3001`.

---

## 4. File uploads

Uploads are stored on disk at `/app/uploads`. Attach a **Render persistent disk**:

| Setting | Value |
|---------|--------|
| Mount path | `/app/uploads` |
| Size | 1 GB minimum |

Without a disk, uploads are lost on every redeploy.

---

## 5. Post-deploy

### Health check

```bash
curl https://<api-host>/api/v1/health
```

Expected: `"status":"ok"` with `"mongo":"ok"` and `"redis":"ok"`.

### Seed (first deploy only)

```bash
MONGODB_URI="mongodb+srv://..." \
JWT_SECRET="..." \
JWT_REFRESH_SECRET="..." \
NODE_ENV=production \
npm run seed --workspace=@lunara/api
```

Change default seed passwords before going live.

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `eas: not found` / `@lunara/rider-mobile#build` | Build command is `npm run build` — change to Docker or `npm run build:api` |
| `Cannot find module '@lunara/types'` at runtime | Use the current `docker/api.Dockerfile` (copies built workspace packages into the image) |
| `rimraf: not found` / `nest: not found` | Native Node: add `--include=dev` to install command |
| API crashes on start | Set `JWT_SECRET` and `JWT_REFRESH_SECRET` |
| Health `503`, `mongo: error` | Fix Atlas IP allowlist and `MONGODB_URI` |
| Health `503`, `redis: error` | Fix `REDIS_URL`; use internal URL on Render |
| Uploads missing after redeploy | Add persistent disk at `/app/uploads` |

---

## Related docs

- [Full platform deployment](./DEPLOYMENT.md)
- [Architecture](./ARCHITECTURE.md)
- [API endpoints](./API_ENDPOINTS.md)
