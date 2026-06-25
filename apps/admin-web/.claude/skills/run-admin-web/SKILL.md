---
name: run-admin-web
description: run, start, build, screenshot, test the lunara admin-web Next.js dashboard; navigate to login promotions addons partners shops setup
---

# Lunara Admin Web

Next.js 15 admin dashboard. Runs on port 3002. Driven with `chromium-cli` (browser-driven). Requires the API (`apps/api`) running on port 3001.

## Ports

| Service | Port |
|---|---|
| admin-web | 3002 |
| api | 3001 (required) |

## Prerequisites

- Node.js 18+
- API server running on port 3001 (see `apps/api/.claude/skills/run-api/SKILL.md`)
- `NEXT_PUBLIC_API_URL=http://localhost:3001` in `.env` (root `.env` is loaded via monorepo env resolution)

## Build shared packages first (if not already built)

```powershell
cd ../..   # repo root
npm run build --workspace=@lunara/types
npm run build --workspace=@lunara/utils
npm run build --workspace=@lunara/config
npm run build --workspace=@lunara/hooks
```

Or just let `npm run dev` trigger the `prebuild` script automatically on first run.

## Run (agent path — chromium-cli)

Start the dev server:

```powershell
# From repo root
npm run dev --workspace=@lunara/admin-web
```

Server ready when logs show `✓ Ready in`. Then drive with `chromium-cli`:

```bash
chromium-cli navigate http://localhost:3002
chromium-cli screenshot /tmp/admin-login.png
# Login
chromium-cli evaluate "document.querySelector('#email').value = 'admin@lunara.dev'"
chromium-cli evaluate "document.querySelector('#password').value = 'password123'"
chromium-cli evaluate "document.querySelector('form button[type=submit]').click()"
chromium-cli wait-for-navigation
chromium-cli screenshot /tmp/admin-dashboard.png
# Navigate to a section
chromium-cli navigate http://localhost:3002/promotions
chromium-cli screenshot /tmp/admin-promotions.png
```

Key routes:

| Route | Description |
|---|---|
| `/login` | Login — dev credentials: admin@lunara.dev / password123 |
| `/` | Dashboard / ops center |
| `/orders` | Order management |
| `/shops` | Shops / partner branches |
| `/partners/new` | Create new partner + branch |
| `/partners/branding` | White-label branding list |
| `/promotions` | Promo codes |
| `/addons` | Booking add-ons (with image upload) |
| `/services` | Laundry services catalog |
| `/riders` | Rider management |
| `/setup` | First-time network setup wizard |
| `/reports` | Revenue reports |

## Run (human path)

```powershell
npm run dev --workspace=@lunara/admin-web
```

Opens at http://localhost:3002 — redirects to `/login` if not authenticated.

## Test

```powershell
npm run test --workspace=@lunara/admin-web
npm run typecheck --workspace=@lunara/admin-web
```

## Gotchas

- **Redirect to `/login`** on every page if `lunara_admin_session` cookie is absent. The cookie is set by `adminLogin()` in `src/lib/admin-api.ts` and mirrors the JWT `expiresIn` (7 days). It is not HttpOnly — middleware just checks presence.
- **`/setup` redirects to `/login?redirect=/setup`** — the login page reads the `redirect` query param and returns there after auth. chromium-cli must follow the redirect properly.
- **Parent branch dropdown empty on `/partners/new`** — needs at least one branch in the DB. Run `/setup` wizard first to create the HQ, then add an operational branch.
- **Google Maps on `/partners/new`** — requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in env. Without it the map still renders (static fallback) but autocomplete is disabled.
- **Addon image upload on `/addons`** — clicking the image thumbnail opens a file picker; uploads to `POST /admin/addons/:id/image` which requires Cloudinary env vars on the API side.
- **`prebuild` script** runs workspace builds on `npm run build` but NOT on `npm run dev` if packages are already built. If types are stale, run the workspace builds manually.

## Troubleshooting

**`Cannot reach API at http://localhost:3001`** — start `apps/api` first.

**Blank page / hydration error** — shared packages (`@lunara/types`, `@lunara/utils`) not built. Run `npm run build --workspace=@lunara/types && npm run build --workspace=@lunara/utils` from repo root.

**Port 3002 already in use** — `npm run dev` for admin-web is hardcoded to 3002 in `package.json`. Kill the existing process or change the port.
