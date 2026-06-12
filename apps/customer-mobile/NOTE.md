Pre-release checklist
Configuration

 EXPO_PUBLIC_API_URL points to production API (not localhost)

 Optional: EXPO_PUBLIC_WEBSITE_URL = https://lunara.app

 iOS APNs credentials configured (eas credentials --platform ios)

 Android signing key configured (eas credentials --platform android)

 Google Play service account JSON ready for eas submit

# Verify EAS secrets
eas secret:list

# Production builds (both platforms)
npm run eas:build
# or individually:
npm run eas:build:ios
npm run eas:build:android

# Submit latest builds to stores
npm run eas:submit
# or:
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest

Trigger point to generate release details.

Say: **`we're publishing customer-mobile X.X.X`**

See `.cursor/rules/customer-mobile-release.mdc` for the full workflow. Output goes to `release/<version>.md`.

cd apps/customer-mobile
npm run eas:build
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest