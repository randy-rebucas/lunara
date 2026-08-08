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
  manifest.json       # filled from the answers below; partnerId/easProjectId left blank if unknown
  ASSETS.md            # spec sheet + remaining manual steps, mirrors partner-brands/jelave/ASSETS.md
  icon.png              # 1024x1024 solid placeholder in the partner's primary color
  adaptive-icon.png     # 1024x1024 solid placeholder (Android foreground layer)
  splash.png            # 1284x2778 solid placeholder in the partner's background color
  feature-graphic.png   # 1024x500 solid placeholder (Play Store listing only, not read by app.config.js)
```

The generated PNGs are **solid-color placeholders**, not final art — they exist so
`app.config.js` and `eas build` don't fail on a missing file while real logo/splash art is being
designed. Say this explicitly to the user and tell them to replace the files before shipping to
production or submitting to a store listing.

## Steps

1. Gather what's known: `slug` (kebab-case, matches `LUNARA_PARTNER_SLUG`), `appName`,
   `appDisplayName`, brand colors (primary/secondary/accent/background/foreground/muted/border/
   destructive — reuse `apps/api/src/modules/partners/schemas/partner.schema.ts` defaults for any
   the user doesn't specify), `iosBundleId`, `androidPackage`. Ask the user for whatever isn't
   given rather than inventing bundle IDs or a slug.
2. `partnerId` and `easProjectId` are usually not known yet at scaffold time — leave them as empty
   strings in `manifest.json` with a comment-equivalent note in `ASSETS.md` on how to fill them
   (partnerId comes from the admin API after creating the `Partner` record; easProjectId from
   `LUNARA_PARTNER_SLUG=<slug> eas project:init`, per `partner-brands/DEPLOY_PLAY_STORE.md`).
3. Run the generator:
   ```
   node .claude/skills/scaffold-partner-brand/generate.mjs \
     --slug <slug> \
     --appName "<App Name>" \
     --displayName "<Display Name>" \
     --iosBundleId <com.partner.customer> \
     --androidPackage <com.partner.customer> \
     --primary <#hex> --secondary <#hex> --accent <#hex> \
     --background <#hex> --foreground <#hex> --muted <#hex> \
     --border <#hex> --destructive <#hex>
   ```
   Omit any color flag to use the `PartnerBrandColors` schema defaults. The script refuses to
   overwrite an existing `partner-brands/<slug>/` directory unless `--force` is passed — check
   with the user before forcing.
4. After scaffolding, tell the user the remaining manual steps (mirrors
   `partner-brands/DEPLOY_PLAY_STORE.md` §1–3):
   - Create the `Partner` record via admin-web or `POST /admin/partners`, then paste the returned
     `_id`'s owner-user ObjectId into `manifest.json → partnerId`.
   - Run `LUNARA_PARTNER_SLUG=<slug> eas project:init` from `apps/customer-mobile`, paste the
     project id into `manifest.json → easProjectId`.
   - Replace the placeholder PNGs with real design assets at the same filenames/dimensions.
   - Upload the same logo (or a web-optimized variant) as the partner's web brand assets via
     admin-web, since those are stored separately in Cloudinary and not derived from this folder.

## Notes

- Don't touch `apps/customer-mobile/app.config.js` — it already reads any
  `partner-brands/<slug>/` folder automatically once `LUNARA_PARTNER_SLUG` is set.
- Font files (`fonts/Regular.ttf` + optional `fonts/Bold.ttf`) are optional and not generated —
  only add them if the partner actually supplies a custom typeface.
