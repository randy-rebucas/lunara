Trigger point to generate release details.

Say: **`we're publishing rider-mobile X.X.X`**

See `.cursor/rules/rider-mobile-release.mdc` for the full workflow. Output goes to `release/<version>.md`.

cd apps/rider-mobile
npm run eas:build
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
