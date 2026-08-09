---
name: scaffold-partner-brand
description: Scaffold a new white-label partner brand — creates partner-brands/<slug>/ with manifest.json, ASSETS.md, and placeholder mobile images (icon/splash/adaptive-icon/feature-graphic) sized to spec. Use when onboarding a new partner brand, or when asked to "set up brand assets", "scaffold a partner", "generate partner images", or "create partner-brands folder" for customer-mobile white-labeling.
---

# Scaffold Partner Brand

Generates the local scaffold a new white-labeled `customer-mobile` build needs, per
`partner-brands/README.md`. This only covers the **mobile** side (files read by
`apps/customer-mobile/app.config.js` via `LUNARA_PARTNER_SLUG`). It does **not** create the
`Partner` record or upload web brand assets (logo/icon/splash/favicon) — those go through the
admin API / admin-web UI onto Cloudinary (`POST /admin/partners`, `PATCH /admin/partners/:id/branding`,
`POST /admin/partners/:id/branding/assets/:field`), because they're stored per-tenant in Mongo +
Cloudinary, not as repo files.

## When to use

The user wants to start a new partner brand's mobile build, or is missing
`partner-brands/<slug>/manifest.json` / image files and needs them scaffolded before running
`eas build` or `eas project:init`.

## What it creates

```
partner-brands/<slug>/
  manifest.json       # filled from the required args below — partnerId/easProjectId included, not blank
  ASSETS.md            # spec sheet + remaining manual steps, mirrors partner-brands/jelave/ASSETS.md
  icon.png              # real 1024x1024 icon, copied in from --iconPath (not a placeholder)
  adaptive-icon.png     # 1024x1024 solid placeholder (Android foreground layer)
  splash.png            # 1284x2778 solid placeholder in the partner's background color
  feature-graphic.png   # 1024x500 solid placeholder (Play Store listing only, not read by app.config.js)
```

`icon.png` is copied in verbatim from a real file the user provides — it is never generated.
`adaptive-icon.png`, `splash.png`, and `feature-graphic.png` are still **solid-color
placeholders**, not final art — they exist so `app.config.js` and `eas build` don't fail on a
missing file while real splash/store art is being designed. Say this explicitly to the user and
tell them to replace those three files before shipping to production or submitting to a store
listing.

## Steps

1. Gather what's known: `slug` (kebab-case, matches `LUNARA_PARTNER_SLUG`), `appName`,
   `appDisplayName`, `partnerId` (owner User ObjectId from the `Partner` record — created via
   admin-web or `POST /admin/partners` first if it doesn't exist yet), `easProjectId` (run
   `LUNARA_PARTNER_SLUG=<slug> eas project:init` from `apps/customer-mobile` first if it doesn't
   exist yet, per `partner-brands/DEPLOY_PLAY_STORE.md`), a real 1024x1024 `.png` icon file path,
   brand colors (primary/secondary/accent/background/foreground/muted/border/destructive — reuse
   `apps/api/src/modules/partners/schemas/partner.schema.ts` defaults for any the user doesn't
   specify), `iosBundleId`, `androidPackage`. All of `slug`, `appName`, `displayName`,
   `partnerId`, `easProjectId`, and the icon path are **required** — the generator refuses to run
   without them. Ask the user for whatever isn't given rather than inventing bundle IDs, a slug,
   or blank IDs.
2. Run the generator:
   ```
   node .claude/skills/scaffold-partner-brand/generate.mjs \
     --slug <slug> \
     --appName "<App Name>" \
     --displayName "<Display Name>" \
     --partnerId <ownerUserObjectId> \
     --easProjectId <easProjectId> \
     --iconPath "<path/to/icon-1024x1024.png>" \
     --iosBundleId <com.partner.customer> \
     --androidPackage <com.partner.customer> \
     --primary <#hex> --secondary <#hex> --accent <#hex> \
     --background <#hex> --foreground <#hex> --muted <#hex> \
     --border <#hex> --destructive <#hex>
   ```
   Omit any color flag to use the `PartnerBrandColors` schema defaults. The script refuses to
   overwrite an existing `partner-brands/<slug>/` directory unless `--force` is passed — check
   with the user before forcing.
3. After scaffolding, tell the user the remaining manual steps:
   - Replace `adaptive-icon.png`, `splash.png`, and `feature-graphic.png` with real design assets
     at the same filenames/dimensions before shipping to production or a store listing.
   - Upload the same logo (or a web-optimized variant) as the partner's web brand assets via
     admin-web, since those are stored separately in Cloudinary and not derived from this folder.

## Notes

- Don't touch `apps/customer-mobile/app.config.js` — it already reads any
  `partner-brands/<slug>/` folder automatically once `LUNARA_PARTNER_SLUG` is set.
- Font files (`fonts/Regular.ttf` + optional `fonts/Bold.ttf`) are optional and not generated —
  only add them if the partner actually supplies a custom typeface.
