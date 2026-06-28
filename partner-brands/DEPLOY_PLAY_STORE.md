# Deploying a Partner App to Google Play Store

This guide covers building and submitting any partner-branded customer mobile app to the Play
Store using EAS Build + EAS Submit. Examples use **Je Lave** (`jelave`) — substitute your
partner's slug where applicable.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20.x | https://nodejs.org |
| EAS CLI | ≥ 16.0.0 | `npm install -g eas-cli` |
| Expo account | — | https://expo.dev |
| Google Play Console account | — | https://play.google.com/console |

---

## 1. One-time setup

### 1a. Log in to EAS

```bash
eas login
```

### 1b. Create the partner folder and assets

```
partner-brands/<slug>/
  manifest.json
  icon.png              # 1024×1024 px, PNG, no transparency — also used as the in-app logo
  adaptive-icon.png     # 1024×1024 px, PNG (Android foreground layer) — optional
  splash.png            # 1284×2778 px recommended, PNG — optional, falls back to icon.png
```

See `README.md` in this directory for the full `manifest.json` schema.

### 1c. Create the EAS project (first time only)

Each partner needs its own EAS project for separate build history, signing keys, and bundle ID.

```bash
cd apps/customer-mobile
LUNARA_PARTNER_SLUG=<slug> eas project:init
```

Copy the printed project ID into `partner-brands/<slug>/manifest.json` → `easProjectId`.

### 1d. Add the EAS build profile

In `apps/customer-mobile/eas.json` add:

```json
"production-<slug>": {
  "extends": "production",
  "env": {
    "LUNARA_PARTNER_SLUG": "<slug>"
  }
}
```

### 1e. Set environment variables in EAS

```bash
# From apps/customer-mobile
eas env:create --name EXPO_PUBLIC_API_URL      --value https://api.yourdomain.com        --visibility public
eas env:create --name EXPO_PUBLIC_WEBSITE_URL  --value https://<slug>.yourdomain.com     --visibility public
```

> Variables prefixed `EXPO_PUBLIC_` are bundled into the binary. Keep secrets server-side only.

---

## 2. Fill in `manifest.json`

```json
{
  "partnerId":   "<ObjectId from admin panel after creating the partner record>",
  "easProjectId": "<project ID from step 1c>",
  "appName": "Partner App Name",
  "slug": "<slug>-customer",
  "iosBundleId": "com.<slug>.customer",
  "androidPackage": "com.<slug>.customer",
  "splashBackgroundColor": "#ffffff",
  "theme": {
    "appDisplayName": "Partner Display Name",
    "colors": {
      "primary":     "#4F46E5",
      "secondary":   "#06B6D4",
      "accent":      "#22C55E",
      "background":  "#F8FAFC",
      "foreground":  "#0F172A",
      "muted":       "#64748B",
      "border":      "#E2E8F0",
      "destructive": "#EF4444"
    }
  }
}
```

**Logo note:** `icon.png` is automatically used as the in-app logo (base64-encoded at build time).
To use a different hosted image instead, add `"logoUrl": "<url>"` inside `theme`.

---

## 3. Build the Android bundle

```bash
# From apps/customer-mobile
eas build --platform android --profile production-<slug>
```

This produces a signed **AAB** ready for the Play Store. EAS handles the Android keystore
(created on first build, reused on subsequent builds). Build time is ~10–20 minutes.

Monitor at https://expo.dev or in your terminal.

---

## 4. First submission — manual upload

The first release must be uploaded manually because EAS Submit needs an existing Play Console
listing to attach to.

1. [Google Play Console](https://play.google.com/console) → **Create app**
2. Fill in: app name, default language, app/game, free/paid
3. Complete the store listing (description, screenshots, icon, feature graphic)
4. **Testing → Internal testing → Create new release**
5. Upload the `.aab` downloaded from the EAS build page
6. Roll out to internal testing, resolve any policy warnings, then promote to **Production**

---

## 5. Subsequent releases — automated submit

After the first release EAS Submit can push directly:

```bash
eas submit --platform android --profile production --latest
```

**Service account setup (one-time):**
1. Play Console → **Setup → API access** → link to a Google Cloud project
2. Create a **Service account** with the **Release manager** role
3. Download the JSON key file
4. `eas credentials` → Android → add the service account JSON

---

## 6. Version management

`eas.json` has `"autoIncrement": true` in the `production` profile — EAS increments
`versionCode` automatically on every build.

To bump the user-visible version (e.g. `1.0.4` → `1.1.0`), update `version` in
`apps/customer-mobile/package.json` before building.

---

## 7. Build + submit in one step (CI/CD)

```bash
eas build --platform android --profile production-<slug> --auto-submit
```

Or chain explicitly:

```bash
eas build --platform android --profile production-<slug> \
  && eas submit --platform android --profile production --latest
```

---

## Quick-reference cheat sheet

```bash
# Build for a partner
eas build --platform android --profile production-<slug>

# Submit latest build to Play Store
eas submit --platform android --profile production --latest

# Build + submit in one command
eas build --platform android --profile production-<slug> --auto-submit

# Check build status
eas build:list

# View / download the latest AAB
eas build:view --latest
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `manifest.json not found` | Confirm `LUNARA_PARTNER_SLUG=<slug>` is set and `partner-brands/<slug>/manifest.json` exists |
| `icon.png not found` | Add `partner-brands/<slug>/icon.png` (1024×1024) |
| `partnerId is empty` | Create the partner record via the admin panel and paste the ObjectId into `manifest.json` |
| Play rejects AAB — wrong package | Ensure `manifest.json → androidPackage` matches the bundle ID registered in Play Console |
| `versionCode` conflict | EAS `autoIncrement` handles this — do not set `versionCode` manually |
| Build fails on monorepo packages | `eas-build-post-install` rebuilds shared packages — verify `@lunara/types`, `@lunara/config`, `@lunara/utils` compile locally first |
| In-app logo not showing | Ensure `icon.png` exists in the partner folder; check `expoConfig.extra.brandLogoUrl` in Expo DevTools |
