# Rider Mobile App Deployment Guide

Deploy the rider Expo app (`apps/rider-mobile`) to **Expo EAS**.

---

## Production checklist

Before `eas build --profile production`:

| Step | Command / action |
|------|------------------|
| EAS project linked | `extra.eas.projectId` in `app.config.js` |
| API URL env | `eas env:create --name EXPO_PUBLIC_API_URL --value https://your-api.onrender.com --environment production` |
| Monorepo upload | Root [`.easignore`](../.easignore) must **not** list `apps/rider-mobile` (EAS uploads from repo root) |
| Shared packages | `eas-build-post-install` in `package.json` builds `@lunara/types`, `@lunara/utils`, `@lunara/config` after install |
| Store listing | [Store listing guide](./STORE_LISTING_RIDER_MOBILE.md) — screenshots, copy, App Store / Play checklists |

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
│ rider-mobile                │
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
cd apps/rider-mobile
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
  ...appJson.extra,
  eas: {
    ...appJson.extra?.eas,
    projectId: '<your-eas-project-id>',
  },
},
```

---

## 2. Environment Configuration

### EAS Secrets

Set environment variables for production builds:

```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value https://api.lunara.example.com
eas secret:create --name EXPO_PUBLIC_ENV --value production
```

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
      "autoIncrement": true,
      "node": "20.0.0",
      "android": {
        "buildType": "app-bundle"
      }
    },
    "preview": {
      "distribution": "internal",
      "node": "20.0.0",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
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
3. Fill in metadata, screenshots, description (rider-specific)
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
3. Add screenshots, description, content rating
4. Promote to **Production** after testing (Google Play reviews within 24 hours)

---

## 6. Rider-Specific Features

Ensure the following are tested before release:

- **Document verification:** Rider can upload KYC documents (license, insurance)
- **Earnings tracking:** Realtime earnings display updates via WebSocket
- **Performance metrics:** Historical performance and ratings display
- **Task acceptance:** Push notifications trigger and task details load immediately
- **Realtime tracking:** Map updates as rider approaches/completes tasks
- **Payouts:** Payout schedule and payment method management

---

## 7. Over-the-Air (OTA) Updates

For bug fixes and non-critical updates, use Expo Updates:

```bash
eas update --branch production --message "Fix: earnings calculation"
```

Users see updates on next app launch. No App Store review needed.

---

## 8. Post-Deploy Checklist

### Verify on devices

- [ ] Download and install from TestFlight (iOS) or Google Play (Android)
- [ ] Complete rider onboarding and document verification
- [ ] Receive a test task via push notification
- [ ] Accept task and verify realtime tracking
- [ ] Complete task and verify earnings update
- [ ] Check API calls in DevTools

### Monitor

- [Expo Dashboard](https://expo.dev/eas) — build and deployment history
- **API logs** (Render) — watch for mobile API errors
- **Firebase Console** — check push notification delivery

---

## 9. Operations

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

## 10. Testing Before Release

### On production build (preview profile)

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Test with staging or production API before submitting to app stores.

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Build fails: "API not found" | Missing `EXPO_PUBLIC_API_URL` in EAS secrets | Run `eas secret:create --name EXPO_PUBLIC_API_URL ...` |
| "Cannot connect to API" on app | Wrong `EXPO_PUBLIC_API_URL` | Verify URL is public (not `localhost`); update secret and rebuild |
| Push notifications not working | Firebase not configured | Set `FIREBASE_*` on API (Render); rebuild with new credentials |
| Earnings don't update | WebSocket connection issue | Verify `EXPO_PUBLIC_API_URL` uses `https://`; check API logs |
| "Submit failed" | Service account key issue (Android) | Regenerate key at Google Cloud Console; retry submit |
| App crashes on task acceptance | API endpoint mismatch | Check API version and rider task endpoints; see [API docs](./API_ENDPOINTS.md) |
| Document upload fails | Persistent disk issue on API | Verify Render disk is attached and has space |

---

## Related docs

- [Store listing (App Store & Play)](./STORE_LISTING_RIDER_MOBILE.md)
- [Main deployment guide](./DEPLOYMENT.md)
- [API deployment](./DEPLOYMENT_API.md)
- [Customer Mobile deployment](./DEPLOYMENT_CUSTOMER_MOBILE.md)
- [API endpoints](./API_ENDPOINTS.md)
- [Expo documentation](https://docs.expo.dev/)
- [EAS Submit docs](https://docs.expo.dev/submit/setup/)
