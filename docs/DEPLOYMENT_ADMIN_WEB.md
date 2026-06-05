# Admin Web Deployment Guide

Deploy the admin Next.js app (`apps/admin-web`) to **Vercel**.

---

## Prerequisites

- GitHub (or GitLab) repo connected to Vercel
- A deployed API at a publicly accessible URL (see [API deployment](./DEPLOYMENT_API.md))
- Node.js **20+** (for local development)
- Admin account with appropriate permissions

---

## Architecture

```
┌──────────────────────────┐
│  Vercel                  │
├──────────────────────────┤
│ admin-web                │
│ (Next.js, React)         │
│ https://admin.lunara.example.com
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
4. Set **Root Directory** to `apps/admin-web`
5. Framework preset: **Next.js** (auto-detected)

### Build settings

| Setting | Value |
|---------|-------|
| **Install command** | `cd ../.. && npm ci` |
| **Build command** | `cd ../.. && npm run build --workspace=@lunara/admin-web` |

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
2. Add e.g. `admin.lunara.example.com`
3. Create the DNS records (CNAME or A records) that Vercel displays
4. Wait for DNS propagation

---

## 4. Authentication & Access Control

The admin-web app enforces role-based access at the API level. Ensure:

1. API has admin role validation (see [API docs](./API_ENDPOINTS.md))
2. Admin users exist in MongoDB (created via API seed script)
3. JWT tokens include role information

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

1. Open your Vercel URL (admin domain)
2. Verify the admin login page loads
3. Sign in with admin credentials (from API seed script)
4. Confirm you can access admin features (dashboard, control tower, etc.)
5. Verify API calls succeed in browser **Network** tab
6. Check for realtime updates (WebSocket connection in **Console**)

### Monitor admin activity

- **Vercel Dashboard:** Deployments, Function logs, Analytics
- **API logs:** Render → Service → Logs (watch for authorization errors)

---

## 8. Security Considerations

- **Rate limiting:** The API implements rate limiting on auth endpoints
- **Session management:** Configured via JWT; tokens expire per API settings
- **Sensitive data:** Don't expose secrets in `NEXT_PUBLIC_*` vars
- **HTTPS enforcement:** Vercel handles this automatically

---

## 9. Operations

### Redeploy

Push to the connected branch; Vercel auto-deploys. Turbo cache speeds rebuilds.

### Logs

Vercel → Project → **Deployments → Function Logs**

### Rollback

Vercel → **Deployments** → select a previous deployment → **Promote to Production**

### Admin user management

Admin users are managed through the API. To create/update admin accounts:

```bash
# Use API admin endpoints or direct MongoDB access (development only)
curl -X POST https://api.lunara.example.com/api/v1/admin/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"newadmin@example.com","role":"admin"}'
```

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "API error" when signing in | Wrong `NEXT_PUBLIC_API_URL` | Set to public API URL and **redeploy** |
| "Unauthorized" on load | API not returning admin role | Verify admin account has correct role in MongoDB |
| CORS error in console | API not reachable | Verify API is live at `NEXT_PUBLIC_API_URL` |
| WebSocket never connects | API URL protocol mismatch | Use `https://` URL (not `http://`) |
| 404 on admin pages | Build failed silently | Check Vercel build logs for errors |
| Blank page after deploy | `next.config.ts` error | Check `turbo.json` and build filters |

---

## Related docs

- [Main deployment guide](./DEPLOYMENT.md)
- [API deployment](./DEPLOYMENT_API.md)
- [Customer Web deployment](./DEPLOYMENT_CUSTOMER_WEB.md)
- [Partner Web deployment](./DEPLOYMENT_PARTNER_WEB.md)
- [API endpoints](./API_ENDPOINTS.md)
