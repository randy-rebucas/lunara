# Customer Mobile App Deployment Guide

Deploy the customer Expo app (`apps/customer-mobile`) to **Expo EAS**.

---

## Production checklist

Before `eas build --profile production`:

| Step | Command / action |
|------|------------------|
| EAS project linked | `extra.eas.projectId` in `app.config.js` ✓ |
| API URL secret | `eas secret:create --name EXPO_PUBLIC_API_URL --value https://your-api.onrender.com` |
| Firebase on API | `FIREBASE_*` on Render (for background push) |
| FCM credentials | `eas credentials --platform android` |
| APNs credentials | `eas credentials --platform ios` |
| Twilio on API | Required for real phone OTP in production |
| Privacy & terms pages | Live at `https://lunara.app/privacy` and `/terms` |
| Store assets | [Store listing guide](./STORE_LISTING_CUSTOMER_MOBILE.md) — screenshots & metadata |

Shared packages (`@lunara/types`, `@lunara/utils`, `@lunara/config`) compile automatically via the `eas-build-post-install` script in `package.json` (runs **after** `npm install`, not before).

---

## Prerequisites

- Expo account at [expo.dev](https://expo.dev)
- `eas-cli` installed: `npm install -g eas-cli` or `npm ci` (workspace setup)
- A deployed API at a publicly accessible URL (see [API deployment](./DEPLOYMENT_API.md))
- **iOS:** Apple Developer account (for TestFlight and App Store submission)
- **Android:** Google Play Developer account
- Node.js **20+**

---

## Architecture

```
┌─────────────────────────────┐
│ Expo EAS Build              │
├─────────────────────────────┤
│ customer-mobile             │
│ (React Native, Expo)        │
└────────┬────────────────────┘
         │
         ├─→ App Store (iOS)
         ├─→ Google Play (Android)
         └─→ Internal testing
                │
                ▼
         ┌──────────────────┐
         │ Render NestJS    │
         │ /api/v1/*        │
         └──────────────────┘
```

---

## 1. Expo Setup

### Connect to EAS

```bash
cd apps/customer-mobile
eas login
```

### Link your app

If not already set up:

```bash
eas project:init
```

This project uses dynamic config (`app.config.js`), so EAS cannot auto-write the project ID. After init, add the ID it prints to `app.config.js`:

```javascript
extra: {
  eas: {
    projectId: '<your-eas-project-id>',
  },
},
```

The customer app is linked to project `08355e56-d5dc-4fe0-b11c-8b6a27691dc5`.

---

## 2. Environment Configuration

### EAS Secrets

Set environment variables for production builds:

```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value https://api.lunara.example.com
```

Optional:

```bash
eas secret:create --name EXPO_PUBLIC_WEBSITE_URL --value https://lunara.app
```

`EXPO_PUBLIC_API_URL` is **required** — the app throws at startup in production builds if it is missing.

List existing secrets:

```bash
eas secret:list
```

### Update `eas.json`

Ensure production profile includes necessary settings:

```json
{
  "build": {
    "production": {
      "node": "20.0.0",
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    },
    "preview": {
      "node": "20.0.0",
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

> **Note:** `buildType` is **Android-only** (`apk` or `app-bundle`). For iOS simulator builds use `"simulator": true`. Store builds omit iOS-specific options — EAS produces an `.ipa` by default.

---

## 3. Firebase Setup (Optional but Recommended)

For push notifications, configure Firebase Cloud Messaging (FCM):

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com)
2. Enable FCM and get the server key
3. Set on the **API** (Render):
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

The mobile app automatically uses FCM when these are configured on the API.

---

## 4. iOS Deployment

### Prerequisites

- Apple Developer account ($99/year)
- Xcode with signing certificates set up

### Step 1: Build for iOS

```bash
eas build --platform ios --profile production
```

Monitor build at [expo.dev/eas](https://expo.dev/eas).

### Step 2: Submit to TestFlight

After build completes:

```bash
eas submit --platform ios --profile production --latest
```

Provide:
- Apple ID
- App-specific password (generate at [appleid.apple.com](https://appleid.apple.com/account/security))

The app appears in TestFlight within minutes for internal testing.

### Step 3: Submit to App Store

1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Create a new app version
3. Fill in metadata, screenshots, description — see [Store listing guide](./STORE_LISTING_CUSTOMER_MOBILE.md)
4. Submit for review (Apple reviews within 24–48 hours)

---

## 5. Android Deployment

### Prerequisites

- Google Play Developer account ($25 one-time)
- Android signing key (EAS can generate; see below)

### Step 1: Create Android signing key

If you don't have one:

```bash
eas credentials --platform android
```

Follow prompts to generate or upload a signing key. EAS stores it securely.

### Step 2: Build for Android

```bash
eas build --platform android --profile production
```

Monitor build at [expo.dev/eas](https://expo.dev/eas).

### Step 3: Submit to Google Play

After build completes:

```bash
eas submit --platform android --profile production --latest
```

Provide:
- Google Play service account JSON key (create at [console.cloud.google.com](https://console.cloud.google.com))

The app is uploaded to Google Play Console.

### Step 4: Configure and release on Google Play

1. Log in to [Google Play Console](https://play.google.com/console)
2. Create a new release in the **Internal testing** or **Closed testing** track
3. Add screenshots, description, content rating — see [Store listing guide](./STORE_LISTING_CUSTOMER_MOBILE.md)
4. Promote to **Production** after testing (Google Play reviews within 24 hours)

---

## 6. Over-the-Air (OTA) Updates

For bug fixes and non-critical updates, use Expo Updates:

```bash
eas update --branch production --message "Fix: checkout bug"
```

Users see updates on next app launch. No App Store review needed.

---

## 7. Post-Deploy Checklist

### Verify on devices

- [ ] Download and install from TestFlight (iOS) or Google Play (Android)
- [ ] Sign in with customer account
- [ ] Book a ride
- [ ] Verify WebSocket connection (realtime tracking in **Debug > Console**)
- [ ] Test push notifications (if Firebase configured)
- [ ] Check API calls in DevTools

### Monitor

- [Expo Dashboard](https://expo.dev/eas) — build and deployment history
- **API logs** (Render) — watch for mobile API errors
- **Firebase Console** — check push notification delivery

---

## 8. Operations

### Rebuild for a new API URL

If API domain changes, rebuild (don't OTA):

```bash
eas update --branch production --message "Update: new API domain"
```

Or force a new build:

```bash
eas build --platform ios --profile production
```

### Rollback

1. [Expo Dashboard](https://expo.dev/eas) → Build history
2. Find a previous successful build
3. Re-submit or update to an older version

### Monitor app performance

- **Expo Dashboard** — crash reports and analytics
- **Firebase Console** — FCM delivery metrics
- **App Store Connect / Google Play Console** — user ratings, crash logs

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Build fails: "API not found" | Missing `EXPO_PUBLIC_API_URL` in EAS secrets | Run `eas secret:create --name EXPO_PUBLIC_API_URL ...` |
| "Cannot connect to API" on app (production build) | Wrong `EXPO_PUBLIC_API_URL` | Verify URL is public (not `localhost`); update secret and rebuild |
| "Cannot reach API at http://192.168.x.x:3001" in dev | See [Dev-time "Cannot reach API"](#dev-time-cannot-reach-api) below | LAN reachability issue, or (post-SDK-57) a fetch-level crash misreported as unreachable |
| Push notifications not working | Firebase not configured | Set `FIREBASE_*` on API (Render) |
| App crashes on launch | Dependency issue | Check EAS build logs for errors; rebuild with `--no-cache` |
| "Submit failed" | Service account key issue (Android) | Regenerate key at Google Cloud Console; retry submit |
| WebSocket fails on device | API doesn't support WSS | Use `https://` (not `http://`) in `EXPO_PUBLIC_API_URL` |

### Dev-time "Cannot reach API"

The dev sign-in screen shows `Cannot reach API at http://<lan-ip>:3001. Start the API (npm run dev --workspace=@lunara/api) and use the same Wi‑Fi as your phone.` whenever `fetch()` inside [`authRequest`](../apps/customer-mobile/src/lib/api-client.ts) throws for *any* reason — the message names the LAN cause, but it fires for other fetch-level failures too, and it can be misleading. Work through it in this order:

1. **API not running or not on the same network.** Confirm `npm run dev --workspace=@lunara/api` is running, the phone and dev machine are on the same Wi‑Fi/LAN, and the LAN IP in the error is reachable from the phone's own browser (not just from the dev machine — a PC-side curl/browser success does **not** prove the phone can reach it).
2. **Router/AP client isolation or a blocked port.** If Metro (port 8081) reaches the phone fine but the API port doesn't, and the phone's own browser can't load the API URL either, suspect AP/client isolation or a port-specific block on the router — check `Get-NetFirewallRule` for the API's port on the dev machine first (rule scope/profile), then the router. A quick way to sidestep this entirely during dev: tunnel the API with `ngrok http 3001` and point the app at the public URL via `EXPO_PUBLIC_API_URL=https://<id>.ngrok-free.app` in `apps/customer-mobile/.env` (local, gitignored — don't put a tunnel URL in the shared root `.env`), then restart `expo start` so the new value gets inlined into the bundle. This is a dev-only workaround, not a fix for the underlying network block.
3. **Rule out stale state before assuming (1) or (2).** Confirm the phone can load the exact configured URL in its *own* browser, and that the app was fully force-quit and reopened after any `.env`/env-var change (`EXPO_PUBLIC_*` values are inlined into the JS bundle at Metro's transform time — a stale bundle keeps the old URL even after Metro restarts).
4. **If the URL is provably reachable (browser succeeds, curl succeeds) but the app still fails** — this is not a network problem. `authRequest`'s `catch` around `fetch()` swallows the real error into the generic message above. Temporarily log it:
   ```ts
   } catch (e) {
     console.error('[api-client] fetch failed', baseUrl + path, e);
     throw new Error(apiUnreachableMessage(baseUrl));
   }
   ```
   and reproduce. This is how a real SDK 57 regression was found in this app (see below) — the true error was a native `ArgumentCastException`, not a network failure at all.

#### Root cause found post-SDK-57 upgrade: `partnerId` header crash

After upgrading `customer-mobile` from Expo SDK 51 → 57, sign-in failed with the generic "Cannot reach API" message even though the API and its URL were confirmed reachable (curl and the phone's own browser both succeeded against the same URL). Logging the real error (step 4 above) surfaced:

```
Error: fetch failed: ArgumentCastException: The 2nd argument cannot be cast to type NativeRequestInit
→ Caused by: FieldInvalidTypeException: Cannot cast '...' for field 'headers' of type Array<Array<String>>
→ Caused by: ConversionToNativeFailedException: Conversion from JavaScript value of type 'object' to native 'String' failed
```

**Cause:** `app.config.js` computes `extra.partnerId` as `manifest?.partnerId ?? null` — correctly `null` for the default (non-white-labeled) build. But Expo SDK 57's config serialization coerces that `null` into `{}` by the time it reaches the device's runtime manifest (`Constants.expoConfig.extra.partnerId` is genuinely `{}` on device, confirmed via `npx expo config --json`). The old `getPartnerId()` used `?? null`, which doesn't catch this — `{}` is truthy, so it passed the empty object through. That object then got spread into a fetch header: `{ 'x-lunara-partner-id': {} }`. SDK 51's JS-polyfilled `fetch` silently tolerated a non-string header value; SDK 57's new native `fetch` module (via ExpoModulesCore) hard-crashes on it before the request is even sent — which is exactly why curl/browser (which never touch this header-building code) worked fine while the app never did.

**Fix** ([`src/lib/api-client.ts`](../apps/customer-mobile/src/lib/api-client.ts)): require `partnerId` to actually be a non-empty string, not just truthy —

```ts
export function getPartnerId(): string | null {
  const value = Constants.expoConfig?.extra?.partnerId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}
```

`theme/index.ts` reads the same kind of `extra.*` fields (`partnerTheme`, `partnerFontFamily`) with the same `?? null` pattern and has the same underlying `{}`-instead-of-`null` quirk, but it degrades harmlessly there (`{}.regular` is `undefined`; spreading `{}` into a theme override is a no-op) so it was left as-is. If a future SDK bump adds new `extra.*` config values, apply the same "must actually be the expected type" guard rather than trusting `??`.

---

## Related docs

- [Store listing — screenshots & metadata](./STORE_LISTING_CUSTOMER_MOBILE.md)
- [Main deployment guide](./DEPLOYMENT.md)
- [API deployment](./DEPLOYMENT_API.md)
- [Rider Mobile deployment](./DEPLOYMENT_RIDER_MOBILE.md)
- [Expo documentation](https://docs.expo.dev/)
- [EAS Submit docs](https://docs.expo.dev/submit/setup/)
