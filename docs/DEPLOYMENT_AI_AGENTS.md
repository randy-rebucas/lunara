# AI Agents Deployment Guide

Deploy the AI Team chat app (`apps/ai-agents`) to **Vercel**.

---

## Prerequisites

- GitHub (or GitLab) repo connected to Vercel
- A deployed API at a publicly accessible URL, with `ANTHROPIC_API_KEY` set (see [API deployment](./DEPLOYMENT_API.md))
- Node.js **20+** (for local development)
- Staff, admin, or customer account for authenticated agents; no account needed for the guest Emma chat

---

## Architecture

```
┌──────────────────────────┐
│  Vercel                  │
├──────────────────────────┤
│ ai-agents                │
│ (Next.js, React)         │
│ https://ai.lunara.example.com
└────────┬─────────────────┘
         │ API calls (JWT for staff/admin/customer, none for /ai-agents/guest/*)
         ▼
    ┌─────────────────┐
    │ Render NestJS   │
    │ /api/v1/ai-agents/* │
    │ → Anthropic Claude  │
    └─────────────────┘
```

---

## 1. Vercel Setup

### Connect the repository

1. Go to [Vercel](https://vercel.com)
2. Click **Add New... → Project**
3. Import the GitHub/GitLab repository
4. Set **Root Directory** to `apps/ai-agents`
5. Framework preset: **Next.js** (auto-detected)

### Build settings

| Setting | Value |
|---------|-------|
| **Install command** | `cd ../.. && npm ci` |
| **Build command** | `cd ../.. && npx turbo run build --filter=@lunara/ai-agents` |

Turbo builds workspace dependencies (`@lunara/types`, `@lunara/utils`, `@lunara/config`, `@lunara/hooks`, `@lunara/brand`, `@lunara/ui`) automatically via `dependsOn: ["^build"]`.

**Alternative build command** (without Turbo filter):

```bash
cd ../.. \
  && npm run build --workspace=@lunara/types \
  && npm run build --workspace=@lunara/utils \
  && npm run build --workspace=@lunara/config \
  && npm run build --workspace=@lunara/hooks \
  && npm run build --workspace=@lunara/ai-agents
```

---

## 2. Environment Variables

Set in **Settings → Environment Variables** and apply to **Production** (and Preview for staging).

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | `https://api.lunara.example.com` |

**Important:** Next.js bakes public env vars into the client bundle at **build time**. After changing `NEXT_PUBLIC_API_URL`, redeploy.

### Required API-side variable (Render)

The API must have `ANTHROPIC_API_KEY` set or every chat call — authenticated and guest — fails with "AI agents are not configured." Set on the **API** service, not here:

| Variable | Set on | Notes |
|----------|--------|-------|
| `ANTHROPIC_API_KEY` | Render (API) | Claude API key |
| `ANTHROPIC_MODEL` | Render (API) | Optional model override; see `getAnthropicModel()` |

---

## 3. Custom Domain

1. Vercel → Project → **Settings → Domains**
2. Add e.g. `ai.lunara.example.com`
3. Create the DNS records (CNAME or A records) that Vercel displays
4. Wait for DNS propagation

---

## 4. Authentication & Guest Access

Most of this app requires sign-in (`AuthGuard` redirects to `/login`), and each persona is further scoped by role at the API (`staff`/`admin`/`customer`) — see [API docs](./API_ENDPOINTS.md#ai-agents).

One route is intentionally public: **`/guest/emma`**. It calls `POST /ai-agents/guest/emma/messages` and `GET /ai-agents/guest/emma/prompt-library`, which carry no `Authorization` header and are excluded from `JwtAuthGuard` server-side. Only Emma responds there, and only with a narrow, tool-limited "how it works" prompt set — no account/order data is reachable without signing in. No extra Vercel configuration is needed for this route; it's public by virtue of the API route itself being unauthenticated.

---

## 5. CORS

The API enables CORS with `origin: true` and `credentials: true`, so both production and preview Vercel domains work without an allowlist.

---

## 6. Rate Limiting

Every chat message is a billed Anthropic API call, throttled server-side per the global `ThrottlerGuard` (keyed by IP):

| Route | Limit |
|-------|-------|
| `POST /ai-agents/:agentId/messages` (authenticated) | 20/min |
| `POST /ai-agents/guest/:agentId/messages` (guest) | 8/min |

If you front the API with a CDN/proxy that changes the client IP the throttler sees (e.g. a shared load balancer), guest throttling may under- or over-count — verify `X-Forwarded-For` handling matches your Render/proxy setup.

---

## 7. Preview Deployments

Preview deployments (for PRs) can use:

- **Staging API:** Set `NEXT_PUBLIC_API_URL` to a staging Render instance
- **Production API:** Shared with production (not recommended — preview traffic will consume the same Anthropic billing/throttle budget)

Configure in **Settings → Environment Variables** with environment set to **Preview**.

---

## 8. Post-Deploy

### Verify the app

1. Open your Vercel URL → login page loads, with an **"Ask Emma without signing in"** button
2. Click it → `/guest/emma` loads, shows the Lunara logo + Emma's avatar, and answers a general question (e.g. "What areas do you serve?") without any login
3. Sign in with a staff/admin/customer account → confirm the full AI team roster loads and a persona responds
4. Verify API calls succeed in browser **Network** tab (`/api/v1/ai-agents/...`)

### Monitor usage

- **Vercel Dashboard:** Deployments, Function logs, Analytics
- **API logs:** Render → Service → Logs — watch for `AI request failed` (Anthropic errors) and 429s from the throttle guard
- **Anthropic Console:** token usage/spend, since every message (including guest) is a billed call

---

## 9. Security Considerations

- **Guest surface is deliberately narrow:** only Emma, only general prompts, zero tools beyond the public branch/service-area list (`list_service_areas`, `get_branch_detail`) — no account, order, payment, or ticket data is reachable pre-login. If you add tools, only mark them `guestSafe: true` in `apps/api/src/modules/ai-agents/tools/*.ts` when the underlying data is genuinely public.
- **No conversation persistence for guests:** guest chats are stateless (nothing written to MongoDB), so there's no guest data to retain or purge.
- **Rate limiting:** don't relax the guest throttle without considering Anthropic spend from anonymous traffic.
- **HTTPS enforcement:** Vercel handles this automatically.

---

## 10. Operations

### Redeploy

Push to the connected branch; Vercel auto-deploys. Turbo cache speeds rebuilds.

### Logs

Vercel → Project → **Deployments → Function Logs**

### Rollback

Vercel → **Deployments** → select a previous deployment → **Promote to Production**

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "API error" when signing in | Wrong `NEXT_PUBLIC_API_URL` | Set to public API URL and **redeploy** |
| "AI agents are not configured" | `ANTHROPIC_API_KEY` missing on the API | Set on Render, redeploy API |
| `/guest/emma` redirects to `/login` | `AuthGuard` public-route check doesn't match the path | Confirm it's exactly `/guest/emma` (or under `/guest/`) |
| Guest chat returns 429 quickly | Shared IP behind a proxy/CDN hitting the 8/min guest throttle | Check proxy `X-Forwarded-For` config, or accept the limit is working as intended |
| CORS error in console | API not reachable | Verify API is live at `NEXT_PUBLIC_API_URL` |
| 404 on chat pages | Build failed silently | Check Vercel build logs for errors |

---

## Related docs

- [Main deployment guide](./DEPLOYMENT.md)
- [API deployment](./DEPLOYMENT_API.md)
- [Admin Web deployment](./DEPLOYMENT_ADMIN_WEB.md)
- [API endpoints](./API_ENDPOINTS.md)
