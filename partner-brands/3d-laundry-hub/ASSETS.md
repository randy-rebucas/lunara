# 3D Laundry Hub — Brand Assets

Place the following image files in this directory before running an EAS build. The versions here
were generated as **solid-color placeholders** — replace them with real design assets before
shipping to production or submitting a store listing.

| File | Size | Required |
|------|------|----------|
| `icon.png` | 1024×1024 px | Yes — copied in from `--iconPath` |
| `splash.png` | 1284×2778 px (or any ratio) | No — falls back to icon.png |
| `adaptive-icon.png` | 1024×1024 px (Android foreground layer) | No — falls back to icon.png |
| `feature-graphic.png` | 1024×500 px (Play Store listing only) | No — not read by app.config.js |

## Brand colours

| Token | Hex |
|-------|-----|
| Primary | `#4f46e5` |
| Secondary | `#06b6d4` |
| Accent | `#22c55e` |
| Background | `#ffffff` |
| Foreground | `#0f172a` |
| Muted | `#64748b` |
| Border | `#e2e8f0` |
| Destructive | `#ef4444` |

## Steps after adding real assets

1. Replace `splash.png`, `adaptive-icon.png`, and `feature-graphic.png` (still solid-color
   placeholders) with real design assets before shipping to production or submitting a store
   listing. `icon.png` was already copied in from a real file at scaffold time.
2. Upload the partner's web brand assets (logo/icon/splash/favicon) separately via admin-web —
   they live in Cloudinary against the `Partner` record, not this folder.
3. Run `LUNARA_PARTNER_SLUG=3d-laundry-hub eas build --profile production` from `apps/customer-mobile`
   (add a `production-3d-laundry-hub` profile to `eas.json` first — see
   `partner-brands/DEPLOY_PLAY_STORE.md`).
