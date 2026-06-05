# Partner Web Deployment Guide

Deploy the partner Next.js app (`apps/partner-web`) to **Vercel**.

---

## Prerequisites

- GitHub (or GitLab) repo connected to Vercel
- A deployed API at a publicly accessible URL (see [API deployment](./DEPLOYMENT_API.md))
- Node.js **20+** (for local development)
- Partner account with appropriate permissions

---

## Architecture

```
┌──────────────────────────┐
│  Vercel                  │
├──────────────────────────┤
│ partner-web              │
│ (Next.js, React)         │
│ https://partner.lunara.example.com
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
4. Set **Root Directory** to `apps/partner-web`
5. Framework preset: **Next.js** (auto-detected)

### Build settings

| Setting | Value |
|---------|-------|
| **Install command** | `cd ../.. && npm ci` |
| **Build command** | `cd ../.. && npm run build --workspace=@lunara/partner-web` |

This uses `npm` workspaces to automatically build all dependencies in the correct order via `package.json`'s `workspaces` configuration and `turbo.json`'s `dependsOn` rules.

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
2. Add e.g. `partner.lunara.example.com`
3. Create the DNS records (CNAME or A records) that Vercel displays
4. Wait for DNS propagation

---

## 4. Authentication & Access Control

The partner-web app enforces partner-specific role-based access at the API level. Ensure:

1. API has partner role validation (see [API docs](./API_ENDPOINTS.md))
2. Partner users exist in MongoDB (created via API or partner signup flow)
3. JWT tokens include partner role and organization information

---

## 5. CORS

The API enables CORS with `origin: true` and `credentials: true`, so both production and preview Vercel domains work without an allowlist.

---

## 6. Preview Deployments

Preview deployments (for PRs) can use:

- **Staging API:** Set `NEXT_PUBLIC_API_URL` to a staging Render instance
- **Production API:** Shared with production (not recommended for testing)

Configure in **Settings → Environment Variables** with environment set to **Preview**.

---

## 7. Post-Deploy

### Verify the app

1. Open your Vercel URL (partner domain)
2. Verify the partner login/signup page loads
3. Sign in with partner credentials (or create test account)
4. Confirm you can access partner features (bookings, payouts, analytics, etc.)
5. Verify API calls succeed in browser **Network** tab
6. Check for realtime updates (WebSocket connection in **Console**)

### Monitor partner platform

- **Vercel Dashboard:** Deployments, Function logs, Analytics
- **API logs:** Render → Service → Logs (watch for authorization errors)

---

## 8. Security Considerations

- **Rate limiting:** The API implements rate limiting on auth endpoints
- **Session management:** Configured via JWT; tokens expire per API settings
- **Sensitive data:** Don't expose secrets in `NEXT_PUBLIC_*` vars
- **HTTPS enforcement:** Vercel handles this automatically
- **Partner isolation:** API enforces organization boundaries for multi-tenant safety

---

## 9. Operations

### Redeploy

Push to the connected branch; Vercel auto-deploys. Turbo cache speeds rebuilds.

### Logs

Vercel → Project → **Deployments → Function Logs**

### Rollback

Vercel → **Deployments** → select a previous deployment → **Promote to Production**

### Partner account management

Partner accounts are typically created through the signup flow. For direct management:

```bash
# Use API partner endpoints
curl -X POST https://api.lunara.example.com/api/v1/partners \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"partner@company.com","organizationName":"Company Name"}'
```

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "API error" when signing in | Wrong `NEXT_PUBLIC_API_URL` | Set to public API URL and **redeploy** |
| "Unauthorized" on load | API not returning partner role | Verify partner account has correct role in MongoDB |
| CORS error in console | API not reachable | Verify API is live at `NEXT_PUBLIC_API_URL` |
| WebSocket never connects | API URL protocol mismatch | Use `https://` URL (not `http://`) |
| 404 on partner pages | Build failed silently | Check Vercel build logs for errors |
| Blank page after deploy | `next.config.ts` error | Check `turbo.json` and build filters |
| Partner features not visible | Organization/role mismatch | Verify partner role and organization ID in JWT payload |

---

## Related docs

- [Main deployment guide](./DEPLOYMENT.md)
- [API deployment](./DEPLOYMENT_API.md)
- [Customer Web deployment](./DEPLOYMENT_CUSTOMER_WEB.md)
- [Admin Web deployment](./DEPLOYMENT_ADMIN_WEB.md)
- [API endpoints](./API_ENDPOINTS.md)
