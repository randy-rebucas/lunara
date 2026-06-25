---
name: run-customer-web
description: run, start, build, screenshot, test the lunara customer-web Next.js app; navigate to booking orders laundry checkout
---

# Lunara Customer Web

Next.js 15 customer-facing app. Runs on port 3000. White-label aware — reads `PartnerBrandConfig` from the API on each request via the `host` header. Driven with `chromium-cli`. Requires the API running on port 3001.

## Ports

| Service | Port |
|---|---|
| customer-web | 3000 |
| api | 3001 (required) |

## Prerequisites

- Node.js 18+
- API server on port 3001 (see `apps/api/.claude/skills/run-api/SKILL.md`)
- `NEXT_PUBLIC_API_URL=http://localhost:3001` in root `.env`

## Run (agent path — chromium-cli)

```powershell
# From repo root
npm run dev --workspace=@lunara/customer-web
```

Wait for `✓ Ready in`. Then:

```bash
chromium-cli navigate http://localhost:3000
chromium-cli screenshot /tmp/customer-home.png
# Authenticated routes — login via API first
chromium-cli navigate http://localhost:3000/login
chromium-cli screenshot /tmp/customer-login.png
```

Key routes:

| Route | Description |
|---|---|
| `/` | Home / landing |
| `/login` | Customer login (customer@lunara.dev / password123) |
| `/(authenticated)/orders` | Order history |
| `/(authenticated)/booking` | New booking flow |

## Run (human path)

```powershell
npm run dev --workspace=@lunara/customer-web
```

Opens at http://localhost:3000.

## Test

```powershell
npm run test --workspace=@lunara/customer-web
npm run typecheck --workspace=@lunara/customer-web
```

## Gotchas

- **White-label brand resolution** — `layout.tsx` fetches brand config from the API using the `host` request header. On `localhost` no partner brand is matched; the app falls back to the default Lunara brand. To test a white-label brand, set `Host: <partner-domain>` or use the partner's configured domain.
- **Authenticated routes** live under `(authenticated)/` group. The auth guard likely uses a session cookie or localStorage token — check `src/app/providers.tsx` for the auth context provider.
- **`prebuild` script** builds shared packages on `npm run build` but not on `npm run dev` if already built. If you see type errors on shared packages, run the workspace builds manually from repo root.

## Troubleshooting

**`Cannot reach API`** — start `apps/api` first.

**Port 3000 already in use** — port is hardcoded in `package.json`. Kill the process using port 3000.
