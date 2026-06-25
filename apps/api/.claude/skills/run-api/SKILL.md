---
name: run-api
description: run, start, build, test, smoke-test the lunara NestJS API server; curl endpoints; check health
---

# Lunara API

NestJS backend. Runs on port 3001. Driven with `curl` or PowerShell `Invoke-RestMethod`. The smoke script at `.claude/skills/run-api/smoke.ps1` exercises login + key admin endpoints.

## Ports

| Service | Port |
|---|---|
| API | 3001 |
| MongoDB | 27017 |
| Redis | 6379 |

## Prerequisites

MongoDB and Redis must be running locally. Node.js 18+.

## Build

```powershell
cd apps/api
npm run build   # rimraf dist && nest build
```

## Run (agent path)

Start the server:

```powershell
# From repo root
npm run dev --workspace=@lunara/api
# OR from apps/api
npm run dev
```

Server is ready when logs show `Nest application successfully started`.

Run the smoke script to verify:

```powershell
cd apps/api
node .claude/skills/run-api/smoke.mjs
```

Expected output:
```
health: ok
admin login: ok  token=eyJhbGci...
dashboard: ok
promotions: ok  count=4
addons: ok  count=4
setup/status: ok
branches/parents: ok  count=4
partner login: ok
```

## Run (human path)

```powershell
npm run dev --workspace=@lunara/api
```

Ctrl-C to stop.

## Seed

```powershell
# From repo root — seeds users, branches, catalog, promotions
npm run seed --workspace=@lunara/api

# Individual seed scripts
npm run seed:addons --workspace=@lunara/api
npm run seed:services --workspace=@lunara/api
npm run seed:promotions --workspace=@lunara/api
```

## Dev credentials (seeded)

| Role | Email | Password |
|---|---|---|
| admin | admin@lunara.dev | password123 |
| partner | partner@lunara.dev | password123 |
| rider | rider@lunara.dev | password123 |
| staff | staff@lunara.dev | password123 |
| customer | customer@lunara.dev | password123 |

## Key endpoints

```
GET  /api/v1/health                          — public
POST /api/v1/auth/login                      — { email, password }
GET  /api/v1/admin/dashboard                 — Bearer token required
GET  /api/v1/admin/promotions
GET  /api/v1/admin/addons
POST /api/v1/admin/addons/:id/image          — multipart/form-data, field=file
GET  /api/v1/admin/setup/status
GET  /api/v1/admin/branches/parents
```

## Test

```powershell
npm run test --workspace=@lunara/api
```

## Gotchas

- `npm run dev` uses nodemon; watches `src/**`. First start takes a few seconds for Nest DI to wire up.
- `/admin/*` routes require `role: admin` in JWT — use admin@lunara.dev token.
- `GET /admin/branches` excludes HQ (`branchType: { $ne: 'hq' }`). Use `/admin/branches/parents` to include HQ.
- Cloudinary upload (`POST /admin/addons/:id/image`) requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in `.env`.
- `POST /admin/setup/init` is idempotent — safe to call again if HQ already exists (throws if called twice — check `/admin/setup/status` first).

## Troubleshooting

**`connect ECONNREFUSED 127.0.0.1:27017`** — MongoDB not running. Start with `mongod` or Docker.

**`connect ECONNREFUSED 127.0.0.1:6379`** — Redis not running. Start with `redis-server` or Docker.

**`Cannot GET /api/v1/admin/setup/status`** — New routes require API restart after adding them.

**`401 Unauthorized`** — Token expired (7-day default). Re-login to get a fresh token.
