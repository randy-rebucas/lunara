---
name: run-partner-web
description: run, start, build, screenshot, test the lunara partner-web Next.js portal; navigate to orders inventory revenue settlements staff
---

# Lunara Partner Web

Next.js 15 partner portal. Runs on port 3003. Partners log in here to manage their shop — orders, inventory, staff, settlements. Driven with `chromium-cli`. Requires the API on port 3001.

## Ports

| Service | Port |
|---|---|
| partner-web | 3003 |
| api | 3001 (required) |

## Prerequisites

- Node.js 18+
- API server on port 3001 (see `apps/api/.claude/skills/run-api/SKILL.md`)
- Seeded DB: partner user `partner@lunara.dev` must exist and have a branch assigned

## Run (agent path — chromium-cli)

```powershell
# From repo root
npm run dev --workspace=@lunara/partner-web
```

Wait for `✓ Ready in`. Then:

```bash
chromium-cli navigate http://localhost:3003
chromium-cli screenshot /tmp/partner-home.png
chromium-cli navigate http://localhost:3003/login
chromium-cli screenshot /tmp/partner-login.png
# Dev credentials pre-filled in development mode
chromium-cli evaluate "document.querySelector('form button[type=submit]').click()"
chromium-cli wait-for-navigation
chromium-cli screenshot /tmp/partner-dashboard.png
```

Key routes:

| Route | Description |
|---|---|
| `/login` | Partner login — dev: partner@lunara.dev / password123 (pre-filled in dev) |
| `/orders` | Active orders for partner's branch |
| `/inventory` | Shop inventory management |
| `/revenue` | Revenue summary |
| `/settlements` | Settlement history |
| `/staff` | Staff account management |
| `/settings` | Branch settings |
| `/reports` | Reports |
| `/notifications` | Notification inbox |
| `/profile` | Partner profile |

## Run (human path)

```powershell
npm run dev --workspace=@lunara/partner-web
```

Opens at http://localhost:3003.

## Dev credentials

The login page pre-fills `partner@lunara.dev` / `password123` when `NODE_ENV=development`. Just click the login button.

## Gotchas

- **Pre-filled dev credentials** — `src/app/login/page.tsx` reads `process.env.NODE_ENV` and pre-fills email/password fields in dev. In production these are empty.
- **No branches = blank portal** — the partner user must have a branch assigned (done via seed or admin-web `/partners/new`). Without a branch, most data endpoints return empty.
- **Staff role** — staff users (`staff@lunara.dev`) can also log in here with a subset of permissions. The portal uses `staffLogin()` from `src/lib/partner-api.ts` which accepts both `partner` and `staff` roles.
- **`prebuild`** — shared packages must be built. Run from repo root: `npm run build --workspace=@lunara/types && npm run build --workspace=@lunara/utils && npm run build --workspace=@lunara/config`.

## Troubleshooting

**`Cannot reach API`** — start `apps/api` first.

**Port 3003 already in use** — port hardcoded in `package.json`. Kill the process.

**Login succeeds but portal is blank** — partner user has no branch. Use admin-web `/partners/new` or run `npm run seed --workspace=@lunara/api`.
