# Customer Web Deployment Guide

Deploy the customer Next.js app (`apps/customer-web`) to **Vercel**.

---

## Prerequisites

- GitHub (or GitLab) repo connected to Vercel
- A deployed API at a publicly accessible URL (see [API deployment](./DEPLOYMENT_API.md))
- Node.js **20+** (for local development)

---

## Architecture

```
┌──────────────────────────┐
│  Vercel                  │
├──────────────────────────┤
│ customer-web             │
│ (Next.js, React)         │
│ https://lunara.example.com
└────────┬─────────────────┘
         │ API calls
         ▼
    ┌─────────────────┐
    │ Render NestJS   │
    │ /api/v1/*       │
    └─────────────────┘
```

---

## 1. Vercel Setup

### Connect the repository

1. Go to [Vercel](https://vercel.com)
2. Click **Add New... → Project**
3. Import the GitHub/GitLab repository
4. Set **Root Directory** to `apps/customer-web`
5. Framework preset: **Next.js** (auto-detected)

### Build settings

| Setting | Value |
|---------|-------|
| **Install command** | `cd ../.. && npm ci` |
| **Build command** | `cd ../.. && npm run build --workspace=@lunara/customer-web` |

The `prebuild` script compiles shared packages (`@lunara/types`, `@lunara/utils`, `@lunara/hooks`, `@lunara/config`) before `next build`. Alternatively use `cd ../.. && npm run build:customer-web`.

---

## 2. Environment Variables

Set in **Settings → Environment Variables** and apply to **Production** (and Preview for staging).

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | `https://api.lunara.example.com` |

**Important:** Next.js bakes public env vars into the client bundle at **build time**. After changing `NEXT_PUBLIC_API_URL`, redeploy.

---

## 3. Custom Domain

1. Vercel → Project → **Settings → Domains**
2. Add e.g. `lunara.example.com` or `app.lunara.example.com`
3. Create the DNS records (CNAME or A records) that Vercel displays
4. Wait for DNS propagation

---

## 4. CORS

The API enables CORS with `origin: true` and `credentials: true`, so both production and preview Vercel domains work without an allowlist.

---

## 5. Preview Deployments

Preview deployments (for PRs) can use:

- **Staging API:** Set `NEXT_PUBLIC_API_URL` to a staging Render instance
- **Production API:** Shared with production (not recommended for write-heavy testing)

Configure in **Settings → Environment Variables** with environment set to **Preview**.

---

## 6. Post-Deploy

### Verify the app

1. Open your Vercel URL
2. Verify the login/onboarding page loads
3. Sign in with test credentials (create via API seed script)
4. Confirm API calls succeed in the browser **Network** tab
5. Check for realtime features (WebSocket connection in **Console**)

### Monitor

- **Vercel Dashboard:** Deployments, Function logs, Analytics
- **Check API connectivity:** Open browser DevTools → Network tab, confirm `/api/v1/*` requests succeed

---

## 7. Operations

### Redeploy

Push to the connected branch; Vercel auto-deploys. Turbo cache speeds rebuilds.

### Logs

Vercel → Project → **Deployments → Function Logs** (for API errors in middleware)

### Rollback

Vercel → **Deployments** → select a previous deployment → **Promote to Production**

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "API error" when signing in | Wrong `NEXT_PUBLIC_API_URL` | Set to public API URL and **redeploy** |
| CORS error in console | API not reachable | Verify API is live at `NEXT_PUBLIC_API_URL` |
| WebSocket never connects | API URL protocol mismatch | Use `https://` URL (not `http://`) |
| Blank page after deploy | Build failed silently | Check Vercel build logs for errors |
| `Can't resolve '@lunara/types'` or `@lunara/hooks` | Shared packages not compiled | Ensure install runs from repo root (`cd ../.. && npm ci`). The `prebuild` step must run before `next build` — use `npm run build --workspace=@lunara/customer-web`, not `next build` alone |
| 404 on static pages | `next.config.ts` error | Check `turbo.json` and build filters |

---

## Related docs

- [Main deployment guide](./DEPLOYMENT.md)
- [API deployment](./DEPLOYMENT_API.md)
- [Admin Web deployment](./DEPLOYMENT_ADMIN_WEB.md)
- [Partner Web deployment](./DEPLOYMENT_PARTNER_WEB.md)
