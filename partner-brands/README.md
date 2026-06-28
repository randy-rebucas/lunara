# Partner mobile brand assets

Each white-labeled customer-mobile build reads its assets and identifiers from a folder here,
named after the partner's slug, selected via the `LUNARA_PARTNER_SLUG` env var passed to
`apps/customer-mobile/app.config.js` (see that file and `eas.json`).

## Layout

```
partner-brands/<slug>/
  manifest.json
  icon.png              # 1024x1024, required
  splash.png            # optional — falls back to icon.png if absent
  adaptive-icon.png     # optional (Android) — falls back to icon.png if absent
```

## manifest.json schema

```json
{
  "partnerId": "<Mongo ObjectId of the Partner document — used to tag bookings>",
  "appName": "Partner Laundry",
  "slug": "partner-laundry-customer",
  "iosBundleId": "com.partnerlaundry.customer",
  "androidPackage": "com.partnerlaundry.customer",
  "easProjectId": "<this partner's own EAS project id>",
  "splashBackgroundColor": "#ffffff",
  "theme": {
    "appDisplayName": "Partner Laundry",
    "logoUrl": null,
    "colors": {
      "primary": "#4F46E5",
      "secondary": "#06B6D4",
      "accent": "#22C55E",
      "background": "#F8FAFC",
      "foreground": "#0F172A",
      "muted": "#64748B",
      "border": "#E2E8F0",
      "destructive": "#EF4444"
    },
    "fonts": {
      "sans": "Inter, system-ui, sans-serif"
    }
  }
}
```

Unset fields fall back to the default Lunara app's values — only override what the partner's
brand actually changes.

## How branding is applied

### Build-time (icon, splash, app name, bundle ID)
`app.config.js` reads the manifest and overrides the Expo config before the build runs.
EAS profiles in `eas.json` set `LUNARA_PARTNER_SLUG` per partner (e.g. `production-jelave`).

### Runtime (colors, logo, display name)
`theme.colors`, `theme.logoUrl`, and `theme.appDisplayName` are baked into
`expoConfig.extra` at build time and read by `BrandProvider` on app startup:

- **Colors** — merged over the default Lunara palette and available everywhere via `useBrand().colors`
- **Logo** — `BrandMark` uses `logoUrl` as a remote URI when set; falls back to the bundled `assets/logo.png`
- **Display name** — used as the logo's accessibility label and wherever the app name is shown in-app

Logo resolution priority at build time:
1. `theme.logoUrl` — a hosted URL (e.g. uploaded via the admin branding panel); takes precedence
2. Partner `icon.png` — base64-encoded into `expoConfig.extra` automatically if no `logoUrl` is set
3. Default Lunara `assets/logo.png` — used when building without a partner slug

## partnerId

`partnerId` must match the `_id` of the Partner document in the database. Both customer-mobile
(via `expoConfig.extra.partnerId`) and customer-web (via the public branding API) attach this
value as the `x-lunara-partner-id` request header so bookings are auto-dispatched to the
correct partner's branches.

## Adding a new partner

1. Create `partner-brands/<slug>/` with `icon.png`, optional `splash.png` / `adaptive-icon.png`
2. Fill in `manifest.json` using the schema above
3. Add an EAS build profile to `apps/customer-mobile/eas.json`:
   ```json
   "production-<slug>": {
     "extends": "production",
     "env": { "LUNARA_PARTNER_SLUG": "<slug>" }
   }
   ```
4. See `DEPLOY_PLAY_STORE.md` for the full Play Store deployment guide
