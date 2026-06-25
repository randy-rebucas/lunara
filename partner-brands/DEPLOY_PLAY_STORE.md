# Deploying to Google Play Store

This guide covers building and submitting the **Je Lave** (or any partner-branded) customer mobile
app to the Play Store using EAS Build + EAS Submit.

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

### 1b. Create the EAS project (first time only)

For **Je Lave** you need a dedicated EAS project — it gets its own build history, signing keys, and
bundle ID (`com.jelave.customer`).

```bash
# From the monorepo root
cd apps/customer-mobile
LUNARA_PARTNER_SLUG=jelave eas project:init
```

Copy the project ID printed and paste it into
`partner-brands/jelave/manifest.json` → `easProjectId`.

### 1c. Add the EAS build profile for Je Lave

In `apps/customer-mobile/eas.json` add:

```json
"production-jelave": {
  "extends": "production",
  "env": {
    "LUNARA_PARTNER_SLUG": "jelave"
  }
}
```

### 1d. Set required environment variables in EAS

These are read at build time by the API and Expo config. Set them once per EAS project:

```bash
# From apps/customer-mobile
eas env:create --name EXPO_PUBLIC_API_URL      --value https://api.yourdomain.com  --visibility public
eas env:create --name EXPO_PUBLIC_WEBSITE_URL  --value https://jelave.yourdomain.com --visibility public
```

> Any variable prefixed `EXPO_PUBLIC_` is bundled into the app binary.
> Keep secrets (API keys, JWT secrets) **off** the mobile build — they belong server-side only.

---

## 2. Add Je Lave brand assets

Place these files in `partner-brands/jelave/` before building:

| File | Spec |
|------|------|
| `icon.png` | 1024 × 1024 px, PNG, no transparency |
| `adaptive-icon.png` | 1024 × 1024 px, PNG (Android foreground layer) |
| `splash.png` | 1284 × 2778 px recommended, PNG |

The splash background colour is already set to `#ffffff` in `manifest.json`.

---

## 3. Fill in `manifest.json`

Open `partner-brands/jelave/manifest.json` and fill in the two blank fields:

```json
{
  "partnerId": "<ObjectId from admin API after creating Je Lave partner record>",
  "easProjectId": "<project ID from step 1b>"
}
```

---

## 4. Build the Android bundle

Run from the **monorepo root** or from `apps/customer-mobile`:

```bash
# From apps/customer-mobile
eas build --platform android --profile production-jelave
```

This produces a signed **AAB** (`app-bundle`) — the format Play Store requires.

EAS handles:
- Downloading the correct Node 20 environment
- Running `eas-build-post-install` (builds `@lunara/types`, `@lunara/utils`, `@lunara/config`)
- Generating and storing the Android keystore (first build creates it; subsequent builds reuse it)

Wait ~10–20 minutes for the build to finish. You can monitor it at https://expo.dev or in your
terminal.

---

## 5. First submission — manual upload

The very first release must be uploaded manually through the Play Console because EAS Submit needs
an existing app listing to attach to.

1. Go to [Google Play Console](https://play.google.com/console) → **Create app**
2. Fill in: App name `Je Lave`, default language, app/game, free/paid
3. Complete the store listing (description, screenshots, icon, feature graphic)
4. Go to **Testing → Internal testing** → **Create new release**
5. Upload the `.aab` downloaded from the EAS build page
6. Roll out to internal testing, fix any policy warnings, then promote to **Production**

---

## 6. Subsequent releases — automated submit

After the first release, EAS Submit can push directly:

```bash
# Submits the latest production-jelave build
eas submit --platform android --profile production --latest
```

For this to work, create a Google Play service account and link it to EAS:

1. Play Console → **Setup → API access** → link to a Google Cloud project
2. Create a **Service account** with the **Release manager** role
3. Download the JSON key file
4. In EAS: `eas credentials` → Android → add the service account JSON

---

## 7. Version management

`eas.json` already has `"autoIncrement": true` in the `production` profile — EAS automatically
increments `versionCode` on every build so you never have to manage it manually.

To bump the user-visible version (`1.0.4` → `1.1.0`), update `version` in
`apps/customer-mobile/package.json` before building.

---

## 8. Full build + submit in one step (CI/CD)

```bash
# Build and immediately queue for Play Store submission
eas build --platform android --profile production-jelave --auto-submit
```

Or chain them explicitly:

```bash
eas build --platform android --profile production-jelave \
  && eas submit --platform android --profile production --latest
```

---

## Quick-reference cheat sheet

```bash
# 1. Build Je Lave for Android
eas build --platform android --profile production-jelave

# 2. Submit latest build to Play Store
eas submit --platform android --profile production --latest

# 3. Build + submit in one command
eas build --platform android --profile production-jelave --auto-submit

# 4. Check build status
eas build:list

# 5. Download the AAB manually
eas build:view --latest
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `manifest.json not found` | Confirm `LUNARA_PARTNER_SLUG=jelave` is set and `partner-brands/jelave/manifest.json` exists |
| `icon.png not found` | Add `partner-brands/jelave/icon.png` (1024×1024) |
| `partnerId is empty` | Create the Je Lave partner record via admin API and paste the ObjectId into `manifest.json` |
| Play rejects AAB — wrong package | Ensure `manifest.json → androidPackage` is `com.jelave.customer` and matches Play Console |
| `versionCode` conflict | EAS `autoIncrement` handles this automatically; do not set `versionCode` manually |
| Build fails on monorepo packages | The `eas-build-post-install` script rebuilds shared packages — check that `@lunara/types`, `@lunara/utils`, `@lunara/config` compile cleanly locally first |
