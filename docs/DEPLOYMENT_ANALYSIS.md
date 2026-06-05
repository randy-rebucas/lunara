# Deployment Analysis & Fixes Summary

This document summarizes all deployment guides and the build fixes applied to the Lunara monorepo.

---

## Deployment Guides Created

| Service | Platform | Guide | Status |
|---------|----------|-------|--------|
| NestJS API | Render (Docker) | [DEPLOYMENT_API.md](./DEPLOYMENT_API.md) | ✅ Fixed & Tested |
| Customer Web | Vercel | [DEPLOYMENT_CUSTOMER_WEB.md](./DEPLOYMENT_CUSTOMER_WEB.md) | ✅ Ready |
| Admin Web | Vercel | [DEPLOYMENT_ADMIN_WEB.md](./DEPLOYMENT_ADMIN_WEB.md) | ✅ Ready |
| Partner Web | Vercel | [DEPLOYMENT_PARTNER_WEB.md](./DEPLOYMENT_PARTNER_WEB.md) | ✅ Ready |
| Customer Mobile | Expo EAS | [DEPLOYMENT_CUSTOMER_MOBILE.md](./DEPLOYMENT_CUSTOMER_MOBILE.md) | ✅ Ready |
| Rider Mobile | Expo EAS | [DEPLOYMENT_RIDER_MOBILE.md](./DEPLOYMENT_RIDER_MOBILE.md) | ✅ Ready |

---

## Critical Fixes Applied

### 1. Docker Dockerfile for API (`docker/api.Dockerfile`)

**Issues Found & Fixed:**

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Exit code 127 | Tried to build all workspaces; non-API apps' source not in image | Added `--workspace=@lunara/api` to build only API + dependencies |
| Missing node_modules/package.json | Docker multi-stage: deps stage didn't pass package.json to builder | Added `COPY --from=deps /app/package.json ...` to builder |
| Dependencies not resolving | Glob patterns `COPY packages/*/package.json` don't preserve directory structure | Changed to `COPY packages/ ./packages/` (entire directories) |
| TypeScript compilation errors | Type annotation missing in validation package | Fixed `auth.schema.ts` parameter type: `(data: any) =>` |

**Final Dockerfile Structure:**

```dockerfile
# deps stage: Install ALL workspace dependencies
FROM base AS deps
  COPY package.json package-lock.json* ./
  COPY packages/ ./packages/          # ← entire directories, not globs
  COPY apps/api/ ./apps/api/
  RUN npm ci --include-workspace-root

# builder stage: Build ONLY the API
FROM base AS builder
  COPY --from=deps /app/node_modules ./node_modules
  COPY --from=deps /app/package.json /app/package-lock.json* ./  # ← pass package.json
  COPY apps/api ./apps/api
  COPY packages ./packages
  COPY tsconfig.base.json turbo.json ./
  RUN npm run build --workspace=@lunara/api   # ← only API, not full monorepo

# runner stage: Production image with only dist
FROM base AS runner
  COPY --from=builder /app/apps/api/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
```

### 2. Build Commands (Consistent Across All Guides)

**Render API (Docker Option A):**
```dockerfile
RUN npm run build --workspace=@lunara/api
```

**Render API (Native Node Option B):**
```bash
npm ci && npm run build --workspace=@lunara/api
```

**Vercel Web Apps (all 3):**
```bash
cd ../.. && npm run build --workspace=@lunara/{app-name}
```

**Why `--workspace=@lunara/api` vs. `npm run build`?**
- `npm run build` (root script) → Turbo tries to build ALL workspaces (types, utils, validation, customer-web, admin-web, partner-web, customer-mobile, rider-mobile)
- `npm run build --workspace=@lunara/api` → Turbo builds ONLY API + dependencies (types, utils, validation)
- **Docker:** Building all workspaces fails because only API source is copied (exit code 127: command not found for `next`, `eas`)
- **Vercel:** Each web app has its own deployment with Root Directory set, so they use their own `--workspace` filter

### 3. TypeScript Fixes

**File:** `packages/validation/src/auth.schema.ts`

**Issue:** Parameter without type annotation (line 11)
```typescript
// ❌ Before
.refine((data) => data.email || data.phone, {

// ✅ After
.refine((data: any) => data.email || data.phone, {
```

---

## Deployment Checklist

### Before First Deploy

- [ ] **MongoDB Atlas**
  - Cluster created (M10+ for production)
  - Database user created with read/write access
  - Network access allows Render/Vercel IPs
  - Connection string saved: `MONGODB_URI=...`

- [ ] **Redis**
  - Instance provisioned (Render Key Value, Upstash, or Redis Cloud)
  - Connection URL saved: `REDIS_URL=...`

- [ ] **GitHub Repository**
  - Repo connected to Render and Vercel
  - Branch protection rules configured

- [ ] **JWT Secrets**
  - Generate two random 32+ character strings
  - Set as `JWT_SECRET` and `JWT_REFRESH_SECRET` on Render

### API Deployment (Render)

- [ ] **Docker Option (Recommended)**
  - Environment: Docker
  - Dockerfile path: `docker/api.Dockerfile`
  - Health check: `/api/v1/health`

- [ ] **Environment Variables Set**
  - `NODE_ENV=production`
  - `MONGODB_URI=...` (from Atlas)
  - `REDIS_URL=...`
  - `JWT_SECRET=...`
  - `JWT_REFRESH_SECRET=...`
  - `JWT_EXPIRES_IN=7d`
  - `JWT_REFRESH_EXPIRES_IN=30d`
  - `API_URL=https://api.lunara.example.com` (after custom domain set up)
  - `CUSTOMER_WEB_URL=https://lunara.example.com`

- [ ] **Persistent Disk**
  - Disk created and mounted at `/app/uploads`
  - Minimum 1 GB, scale as needed

- [ ] **Custom Domain** (Optional but Recommended)
  - Set up DNS CNAME
  - Update `API_URL` env var

- [ ] **Post-Deploy**
  - [ ] Test health endpoint: `curl https://<api-host>/api/v1/health`
  - [ ] Seed initial data (first deploy only)
  - [ ] Verify MongoDB and Redis are accessible

### Web Deployments (Vercel)

- [ ] **Customer Web** → `apps/customer-web`
  - [ ] Root Directory: `apps/customer-web`
  - [ ] Environment: `NEXT_PUBLIC_API_URL=https://api.lunara.example.com`
  - [ ] Test: Login page loads, can make API calls
  - [ ] Custom domain: `lunara.example.com` or `app.lunara.example.com`

- [ ] **Admin Web** → `apps/admin-web`
  - [ ] Root Directory: `apps/admin-web`
  - [ ] Environment: `NEXT_PUBLIC_API_URL=https://api.lunara.example.com`
  - [ ] Test: Admin login works, can access dashboard
  - [ ] Custom domain: `admin.lunara.example.com`

- [ ] **Partner Web** → `apps/partner-web`
  - [ ] Root Directory: `apps/partner-web`
  - [ ] Environment: `NEXT_PUBLIC_API_URL=https://api.lunara.example.com`
  - [ ] Test: Partner login works, can access partner features
  - [ ] Custom domain: `partner.lunara.example.com`

### Mobile Deployments (Expo EAS)

- [ ] **Customer Mobile**
  - [ ] EAS project linked (`eas project:init`)
  - [ ] EAS secrets set: `EXPO_PUBLIC_API_URL=https://api.lunara.example.com`
  - [ ] Firebase secrets set on API (for push notifications)
  - [ ] iOS: Build with EAS, submit to TestFlight, then App Store
  - [ ] Android: Build with EAS, submit to Google Play Console

- [ ] **Rider Mobile**
  - [ ] EAS project linked (`eas project:init`)
  - [ ] EAS secrets set: `EXPO_PUBLIC_API_URL=https://api.lunara.example.com`
  - [ ] Firebase secrets set on API (for push notifications)
  - [ ] iOS: Build with EAS, submit to TestFlight, then App Store
  - [ ] Android: Build with EAS, submit to Google Play Console

---

## Common Errors & Solutions

### Docker Build Errors

| Error | Solution |
|-------|----------|
| `exit code: 127` | Ensure builder stage has `--workspace=@lunara/api` filter. Don't copy other app source. |
| `ENOENT: no such file or directory, open '/app/package.json'` | Builder stage must copy package.json from deps: `COPY --from=deps /app/package.json ...` |
| `Cannot find module '@lunara/types'` | Deps stage must copy entire directories: `COPY packages/ ./packages/` not glob patterns. |
| TypeScript `TS7006` (implicit any) | Add type annotations: `(data: any) =>` in zod schemas. |

### API Runtime Errors

| Error | Solution |
|-------|----------|
| Health check 503, `mongo: error` | Check MongoDB URI, allow Render IPs on Atlas network access. |
| Health check 503, `redis: error` | Check Redis URL, verify Render can reach Redis host/port. |
| `JWT_SECRET` not set → app won't start | Set both `JWT_SECRET` and `JWT_REFRESH_SECRET` as Render environment variables. |

### Web App Errors

| Error | Solution |
|-------|----------|
| "API error" on login | Check `NEXT_PUBLIC_API_URL` is set correctly on Vercel. **Must redeploy** after changing. |
| CORS error | API enables CORS for all Vercel domains; shouldn't be an issue. Check browser Network tab. |
| WebSocket never connects | Ensure API URL uses `https://` not `http://`. Check browser Console for connection errors. |

---

## Monitoring & Operations

### Logs

- **Render API:** Dashboard → Service → Logs (stdout/stderr)
- **Vercel Web:** Dashboard → Project → Deployments → select build → Function Logs
- **Expo Mobile:** [expo.dev/eas](https://expo.dev/eas) → Build history → View logs

### Redeploy Strategies

- **API:** Push to branch or click Manual Deploy on Render
- **Web:** Push to branch (Vercel auto-deploys)
- **Mobile:** Use `eas update` for bug fixes; use `eas build` for major changes

### Scaling

- **API:** Start with Render Standard; scale instance type under load. Multiple instances require S3 + Redis adapter.
- **Web:** Vercel scales automatically (serverless); no action needed.
- **Mobile:** App store auto-scaling on user demand; no backend action needed.

---

## Next Steps

1. **Deploy API first** (needs to be live before web/mobile can connect)
2. **Deploy web frontends** (set `NEXT_PUBLIC_API_URL` to live API)
3. **Deploy mobile apps** (via EAS Build/Submit to app stores)
4. **Test end-to-end** (customer books → rider accepts → tracking works)
5. **Monitor logs** for issues and set up alerts

---

## Related Documentation

- [Main Deployment Guide](./DEPLOYMENT.md) — Overview of full architecture
- [API Endpoints](./API_ENDPOINTS.md) — API routes and WebSocket namespace
- [Architecture](./ARCHITECTURE.md) — System design and component interactions
- [Database Schema](./DATABASE_SCHEMA.md) — Data model reference

