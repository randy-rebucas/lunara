# customer-mobile full audit

Scope: `apps/customer-mobile/` (Expo/React Native, expo-router, zustand), branch `feature/multi-tenant`. Read-only investigation, no code changes made. Cross-referenced against `apps/api/src/modules/{branches,payments,reviews}` where those show as modified in git status.

---

## 1. Build/config health

- **[CRITICAL] AndroidManifest references two `@xml` resources that don't exist — will break the Android build.**
  `apps/customer-mobile/android/app/src/main/AndroidManifest.xml:18` (`<application>` tag) adds:
  `android:fullBackupContent="@xml/secure_store_backup_rules" android:dataExtractionRules="@xml/secure_store_data_extraction_rules"`.
  Confirmed `apps/customer-mobile/android/app/src/main/res/xml/` does not exist at all (no files match `res/xml/*`). AAPT2 resource linking will fail on the next Android build. This was meant to accompany the new `expo-secure-store` dependency (see `package.json`/`app.config.js`) but the generated backup-rules XML files were never committed. **Must fix before this branch can build for Android.** This is doubly important because it also undermines a real security fix — see Security §1.

- **[HIGH] `android:allowBackup="true"` combined with the missing backup-rules XML above means SecureStore tokens may not actually be excluded from Android auto-backup.**
  `apps/customer-mobile/android/app/src/main/AndroidManifest.xml:18`. The intent of `fullBackupContent`/`dataExtractionRules` is to exclude Keystore-backed SecureStore data from Android's cloud/device-transfer backups (otherwise a refresh token could leak into a Google account backup). With the referenced XML missing, either the build fails outright, or (if some cached/stale prebuild artifact papers over it) the exclusion silently doesn't apply. Fold this into the same fix as the build-breaker above.

- **[LOW / correction] `hermesCommand` in `build.gradle` resolving `hermes-compiler` is NOT broken.**
  `apps/customer-mobile/android/app/build.gradle` line ~14 changed from the old `react-native/sdks/hermesc` path to resolving `hermes-compiler/package.json`. Verified `hermes-compiler@250829098.0.17` is a real, installed dependency (root `package-lock.json:18371`, `node_modules/hermes-compiler`), resolvable via `require.resolve`. Consistent with the RN 0.86/Expo SDK 57 upgrade (Hermes moved to its own package). Not a build breaker.

- **[HIGH] Gradle wrapper major-version bump (8.14.3 → 9.3.1) with regenerated jar — needs CI/toolchain verification.**
  `apps/customer-mobile/android/gradle/wrapper/gradle-wrapper.properties`: `distributionUrl` now points at `gradle-9.3.1-bin.zip`; `gradle-wrapper.jar` shows a binary diff (43764 → 46175 bytes); `gradlew`/`gradlew.bat` also modified. A major Gradle version jump can break AGP/plugin compatibility. Looks intentional (paired with the SDK 57 upgrade) but verify against the installed Android Gradle Plugin version and any CI image pins before merging.

- **[MEDIUM] `partner-brands/lunara-development-territory` EAS profile has no matching asset folder.**
  `apps/customer-mobile/eas.json` references build profiles for partner slugs `jelave` and `3d-laundry-hub`, both with real folders under `partner-brands/<slug>/` (manifest.json + icon/splash/adaptive-icon/feature-graphic + ASSETS.md). It also has a `lunara-development-territory` profile with no corresponding `partner-brands/lunara-development-territory/` directory. If `app.config.js`'s brand-loading logic reads that folder path at build time for that profile, the build will fail or silently fall back to default branding.

- **[MEDIUM] `tsconfig.json` diff drops `.expo/types/**/*.ts` and `expo-env.d.ts` from `include`.**
  `apps/customer-mobile/tsconfig.json`: old `"include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]` → new `"include": ["**/*.ts", "**/*.tsx"]`. Paired with `typedRoutes` flipping `true → false` in `app.json`, dropping `.expo/types` is plausibly deliberate. But it also drops `expo-env.d.ts`, which typically supplies ambient module declarations (`.png` imports, `EXPO_PUBLIC_*` env typing). This is easy to miss because the surrounding diff is mostly pure reformatting (the `paths` block was reformatted from one line to multi-line with no functional change) — confirm this was intentional, not an accidental side effect of an editor auto-format.

- **[NOTE] `app.json` → `experiments.typedRoutes` flipped `true → false`.** Paired with the tsconfig change above; confirm deliberate (e.g. typed-routes codegen broke under the SDK57 bump) rather than an accidental revert.

- **[NOTE] Coherent, intentional edge-to-edge / SDK57 upgrade, not a half-done change.** `android/app/src/main/res/values/{styles.xml,colors.xml,strings.xml}` and `android/gradle.properties` together remove `expo.edgeToEdgeEnabled=true` (mandatory/default under RN 0.86 New Architecture) and `colorPrimaryDark`/`enforceNavigationBarContrast`, replacing with transparent status/nav bar styling; `gradle.properties` adds `expo.inlineModules.watchedDirectories=[]` paired with a new `.gitignore` entry `app/src/main/java/inline/`. `MainApplication.kt` was rewritten from the legacy `ReactNativeHost` pattern to `ExpoReactHostFactory.getDefaultReactHost(...)` (SDK57 bridgeless template). Reads as a legitimate, coordinated RN/Expo version bump — not white-label branding, not broken.

- **[NOTE] Splash screen PNGs updated consistently across all 5 Android densities** (hdpi/mdpi/xhdpi/xxhdpi/xxxhdpi), each shrinking slightly and uniformly (e.g. hdpi 18570→17831 bytes) — a lossless re-export, not a partial update. No `ios/` directory exists in this repo, so no iOS asset-catalog cross-check was possible.

- **[LOW] `android/app/debug.keystore` is tracked in git.** `git ls-files apps/customer-mobile | grep -i keystore` → only `debug.keystore` (the standard shared Android debug key, not a release signing key — common in RN/Expo bare projects, low risk). No `.jks`/`.p12`/`.p8`, `google-services.json`, `GoogleService-Info.plist`, or `.env` files are tracked under `apps/customer-mobile`. `android/.gitignore` correctly excludes `build/`, `.gradle`, `local.properties`, `*.hprof`, `.cxx/`.

- **[NOTE] `package.json` additions are coherent:** `expo-secure-store` (~57.0.3), `expo-system-ui` (~57.0.3), `@expo/vector-icons` (^15.0.2) all added and consistent with the SecureStore migration (Security §1) and SDK57 upgrade.

- **[NOTE] `build.gradle` `versionName` bumped 1.2.6 → 1.2.7, `versionCode` left at `1`.** Likely fine if EAS manages `versionCode` remotely via `autoIncrement`; confirm that's set for local/non-EAS builds too.

---

## 2. Security

- **[GOOD — context, not a defect] Auth tokens migrated from plaintext AsyncStorage to expo-secure-store.**
  `apps/customer-mobile/src/store/auth.ts:19-34` splits session storage into `USER_STORAGE_KEY` (AsyncStorage, non-sensitive profile) and `TOKENS_STORAGE_KEY` (`SecureStore`, Keychain/Keystore-backed). Previously the whole `{user, tokens}` blob — including JWTs — sat in plaintext AsyncStorage under one key (`lunara_auth`); that was a real **high**-severity issue, now resolved by all read/write/clear paths (`hydrate` lines 148-164, `loginWithEmail` 176, `loginWithOtp` 188, `logout` 212, `refreshAccessToken` 270) consistently routing tokens through SecureStore. **This fix is currently undermined by the missing AndroidManifest XML resources (Build/config §1/§2) — verify both land together**, and confirm this change is actually committed before merge (it's presently only a working-tree modification).

- **[HIGH] Unused `SYSTEM_ALERT_WINDOW` Android permission.**
  `apps/customer-mobile/android/app/src/main/AndroidManifest.xml:8`. No overlay/floating-window code found anywhere in `src/` or `app/`, and it's not configured via any Expo plugin in `app.json`/`app.config.js` — suggesting a raw manifest edit rather than a managed dependency. This is a sensitive "draw over other apps" permission commonly associated with overlay/phishing attacks and frequently flagged in Play Store review; an unused declaration should be removed.

- **[MEDIUM] Unused `RECORD_AUDIO` Android permission.**
  `apps/customer-mobile/android/app/src/main/AndroidManifest.xml:7`. No `expo-av`, `Audio.*`, or any microphone-related code found in `src/` or `app/`; not declared via any Expo plugin config either. Should be removed unless a planned feature justifies it.

- **[MEDIUM] Precise device GPS coordinates sent to an unauthenticated third-party service.**
  `apps/customer-mobile/src/lib/reverse-geocode.ts:73` sends the user's lat/lon (derived from delivery-address entry) to the public `nominatim.openstreetmap.org` API over HTTPS with no API key/auth. Transport is fine, but this is a privacy/data-sharing point — precise home/delivery coordinates leave the app's trust boundary to a public third party. Confirm this is disclosed in the privacy policy.

- **[LOW] `http://` (not `https://`) used for the iOS Apple Maps deep link.**
  `apps/customer-mobile/app/orders/[id]/index.tsx:95`: `` ios: `http://maps.apple.com/?ll=${lat},${lng}` ``. iOS intercepts this URL scheme before any real network request occurs, so risk is minimal, but should be `https://` for consistency/hygiene.

- **[LOW] No runtime protocol assertion on the configured API base URL.**
  `apps/customer-mobile/src/api-config.ts` (`getApiV1BaseUrl`) enforces that `EXPO_PUBLIC_API_URL` is *set* in production (throws if unset, lines 26-30) but does not assert it starts with `https://`. Defense-in-depth only — the value is controlled by whoever configures the EAS build secret, not attacker-reachable at runtime.

- **[NOTE] No hardcoded API keys/secrets found** anywhere in `src/`, `app/`, `app.json`, `app.config.js`, `eas.json`. Only non-sensitive hardcoded HTTPS URL found: `src/lib/client-origin.ts:3` / `app.config.js:11` fallback `https://lunara.app`.

- **[NOTE] No eval/dynamic code execution.** No `eval(`, `new Function(`, or dynamic `require()`. `src/lib/push-notifications.ts:23` uses `await import('expo-notifications')` — a legitimate lazy module import (explicitly commented as an Expo Go crash-avoidance guard), not a security concern.

- **[NOTE] No console logging found at all in this app's source** — `grep` for `console.log|warn|error|info|debug` across `src/`/`app/` returns zero matches, so there's no risk of tokens/PII in device logs. (Flip side: with zero logging and disciplined error-swallowing in places — see Code Quality §8 — some failures may go completely unobserved in production; no telemetry/crash-reporting integration was found either.)

- **[NOTE] Android permission-to-usage justification — mostly good:**
  | Permission | Justified by |
  |---|---|
  | `ACCESS_FINE_LOCATION`/coarse | `expo-location` used in `src/components/address-form-modal.tsx:72`, `app/onboarding/address.tsx:79`, `src/lib/reverse-geocode.ts` — justified |
  | `CAMERA` | `expo-camera`/`useCameraPermissions()` in `src/components/qr-scanner.tsx:15,54` for QR tag scanning — justified |
  | `INTERNET` | required for all API calls — justified |
  | `READ/WRITE_EXTERNAL_STORAGE` (maxSdkVersion=32) | `expo-image-picker` in `src/components/profile-avatar.tsx`, correctly scoped to pre-Android-13 — justified |
  | `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` | no usage found — see findings above |
  | `VIBRATE` | standard for notifications — reasonable |

  No `ios/Info.plist` exists (Expo config-plugin driven); `ios.infoPlist` in `app.config.js` only sets `ITSAppUsesNonExemptEncryption: false`. Camera/location/image-picker usage descriptions are supplied via plugin config in `app.json:24-42` with reasonable, feature-specific copy — no inconsistency found there.

---

## 3. Code quality & architecture

### Navigation (expo-router)
- **[MEDIUM] `app/_layout.tsx` formatting is a major outlier** — nearly every statement/JSX line is followed by a blank line (lines 1-67, 93-224), tripling the file's effective line count (575 lines) versus every other file in the app. Looks like a bad auto-format or merge artifact; a Prettier re-run on this file specifically would help.
- **[MEDIUM] Route header config is manually duplicated per-screen instead of using per-group `_layout.tsx` files.** Every screen needs both a file under `app/` (auto-routing) and a manual `<Stack.Screen name="..." options={{...}}>` entry in `app/_layout.tsx:251-565` just to attach shared header options. The same `headerLeft: () => <Pressable onPress={handleHeaderBack}>...` block is copy-pasted 8+ times (lines 337-341, 396-400, 419-423, 442-446, 465-469, 488-492, 505-509, 538-542). A new screen added under `app/` but forgotten in `_layout.tsx` silently gets default header styling. No `_layout.tsx` exists under `app/orders/`, `app/refunds/`, `app/checkout/`, `app/onboarding/`, or `app/support/` — the idiomatic expo-router fix (colocated group `_layout.tsx` files) would eliminate this duplication.
- **[LOW] `app/scan-tag.tsx` has no `<Stack.Screen>` entry in `_layout.tsx`**, unlike every sibling screen — it will render with default/bare header styling. Confirm intentional.
- **[LOW] Inconsistent route-nesting depth conventions**: `orders/[id]/index.tsx` and `checkout/[orderId]/index.tsx` use nested-folder + `index.tsx`, while `refunds/[id].tsx` and `support/[id].tsx` use flat `[id].tsx` for the structurally identical "detail screen for a list" pattern.
- **[LOW] Custom back-button fallback (`handleHeaderBack`, `_layout.tsx:111-117`) is applied inconsistently** — used for orders, refunds, subscriptions, support, rewards, notifications, but not for `book`, `checkout/[orderId]/*`, or `review/[id]`, which fall back to default expo-router back behavior with no explained rationale. A checkout deep-link with no back stack could dead-end.

### State management (zustand — `src/store/`)
- Only 3 stores: `auth.ts` (281 lines), `notification-sync.ts` (12 lines), `order-realtime.ts` (26 lines).
- **[NOTE] No `persist` middleware used**, even for `auth.ts`'s durable session — it hand-rolls persistence via `persistSession`/`clearSession`/`hydrate` because tokens and user profile need two different storage backends (SecureStore vs AsyncStorage), which zustand's `persist` doesn't cleanly support for a single store. Reasonable choice, but undocumented — a short comment would help future maintainers who reach for `persist` by habit.
- **[LOW] `notification-sync.ts` and `order-realtime.ts` duplicate the same "tick counter to trigger a refetch" pattern** under different names/shapes (one carries a `lastUpdate` payload, the other doesn't). Candidate for a shared `createTickStore()`/`useRefetchSignal(key)` factory.
- **[MEDIUM] `auth.ts` conflates three concerns**: (a) auth/session store, (b) a generic authenticated HTTP client (`apiFetch`, `apiUpload`, `authRequest`, `authUpload`, token-refresh dedup — lines 55-139, 141-281), and (c) an unrelated `getPartnerId()` utility (lines 13-15). `authRequest`/`authUpload` (lines 55-97, 99-139) are near-duplicates differing only in body shape and should be merged. Since virtually every screen calls `apiFetch` from this store, it has become a de facto API layer that would be cleaner split into `src/lib/api-client.ts`, leaving the store holding only `{user, tokens, isLoading}` + thin actions.
- **[NOTE] Good pattern**: the 401-retry-once-with-refresh flow and `refreshInFlight` module-level dedup (lines 141, 252-281) is solid and well-commented.

### Consistency across screens
- **[NOTE — positive]** Data-fetching/loading/error pattern is genuinely consistent: `loading`/`error` state + `useCallback load()` + `useEffect` + `<DataLoadState>` + `RefreshControl`/`onRefresh`, repeated identically across `orders.tsx`, `orders/[id]/index.tsx`, `review/[id].tsx`, `subscriptions/index.tsx` — just never extracted into a shared hook (see Dead code/duplication below).
- **[LOW] Error surfacing shape is inconsistent** — most screens use `error: string` + inline `<Text>`/`DataLoadState`, but `_layout.tsx:512` uses `Alert.alert('Rewards history', 'Coming soon.')` for a placeholder feature. Worth standardizing on one mechanism.
- **[HIGH] `app/orders/[id]/index.tsx` is a 946-line, 24-`useState` mega-component** owning order tracking, delivery verify/sign, review submission, reschedule flow, and subscription upsell, with three separate `<Modal>`s (lines 711, 820, 866) each with their own form state. Should be decomposed into sub-components (`ReviewModal`, `RescheduleModal`, `DeliverySignModal`).
- **[HIGH] `app/book.tsx` is 2,944 lines / 26 `useState` hooks — an order of magnitude larger than any other screen** (next largest, `profile.tsx`, is 812 lines). This is the single largest maintainability risk in the codebase; should be split into step components or a `useBookingFlow` reducer/hook, especially since `src/lib/booking-flow.ts` already exists as a plausible extraction target.

### Dead code
- **[NOTE]** No `TODO`/`FIXME`/`XXX`/`@deprecated` markers found anywhere in `apps/customer-mobile`. Either genuinely clean or the convention simply isn't used here — can't distinguish from a grep alone.

### Duplicated logic
- **[MEDIUM]** The load/refresh/error scaffold (see "Consistency" above) is repeated near-verbatim across at least 4 screens and likely more unsampled ones (`refunds/index.tsx`, `support/index.tsx`, `rewards.tsx`) — strong candidate for a shared `useAsyncResource(fetcher)`/`useApiList(path)` hook returning `{data, loading, error, refreshing, reload, onRefresh}`.
- **[LOW] Date/time formatting duplicated inconsistently.** `orders.tsx:81-98` defines local `formatWindow`/`formatStamp` helpers using `toLocaleDateString('en-PH', ...)`, while `orders/[id]/index.tsx:472-477` inlines an equivalent `toLocaleString('en-PH', {...})` directly in JSX instead of reusing them. Currency/status/payment-method formatters are correctly centralized in `@lunara/utils` — only date/time formatting is inconsistently applied.
- **[LOW] The `e instanceof Error ? e.message : 'fallback'` idiom is repeated 15+ times** across sampled files (`orders.tsx:178`; `orders/[id]/index.tsx:186,250,273,308,335,355,385`; `subscriptions/index.tsx:36`, etc.) despite `src/lib/api-error.ts` already existing with `parseApiError` (used in `auth.ts`) — should add a one-line `toErrorMessage(e)` helper there instead of re-typing the ternary at every call site.

### Component organization
- **[LOW]** `src/components/` is a flat ~28-file list plus a `ui/` subfolder for primitives, despite clear feature clusters visible in naming (`home-*.tsx` × 5). Grouping by feature (`src/components/home/`, etc.) would help as the count grows.
- **[NOTE — positive]** Naming convention (kebab-case files, PascalCase components) is consistent. `Button`/`Card` primitives are well-typed (proper prop interfaces extending RN's own, e.g. `ButtonProps extends Omit<PressableProps,'style'>`).

### TypeScript usage
- **[MEDIUM]** Same `tsconfig.json` `include` regression flagged in Build/config §6 — removing `expo-env.d.ts`/`.expo/types/**/*.ts` risks losing ambient env/asset typing; the diff is easy to miss since it's buried in a pure-reformatting change to the `paths` block.
- **[NOTE — strong positive]** `strict: true` is set, and there are **zero** occurrences of `: any`, `as any`, `@ts-ignore`, or `@ts-expect-error` anywhere in `src/`/`app/` — genuinely good discipline for a codebase this size (25+ routes, 30+ components/hooks/lib files).
- **[LOW]** Several screens re-declare overlapping local interfaces (`orders.tsx:24-36` `OrderRow`, `orders/[id]/index.tsx:49-80` `OrderDetail`) that likely overlap with types already in `@lunara/types` (`OrderStatus`, `PaymentMethod` are imported from there elsewhere) — risks drift if the API shape changes; consider extending/picking from shared types instead.

### Error boundary / error handling
- **[MEDIUM] No `ErrorBoundary` anywhere in the app** — confirmed zero matches for `ErrorBoundary`/`componentDidCatch` across all of `src/`/`app/`. No boundary wraps the root `<Stack>` in `app/_layout.tsx`; an uncaught render exception in any screen crashes to a native red/white screen with no recovery UX, in a payments-carrying customer app.
- **[NOTE — positive]** Async error handling at the call-site level is disciplined: virtually every `apiFetch`/`apiUpload` call is wrapped in try/catch routed into a local `error` string state. Deliberate `.catch(() => {})` swallowing is used for best-effort background refreshes (`_layout.tsx:193`, `orders.tsx:191`, `orders/[id]/index.tsx:201`) — reasonable for non-critical calls, but e.g. `_layout.tsx:193`'s onboarding-status fetch failing silently could leave a user stuck with no feedback; worth double-checking none of these mask real failures.
- **[NOTE]** `apiUnreachableMessage` (`src/lib/network-error.ts`) gives a friendlier offline-specific message, but it's only wired into `authRequest`/`authUpload` — confirm no other fetch path in the app bypasses those two functions.

---

## 4. Data flow & API integration

- **[NOTE] Backend changes (branches/payments/reviews) are additive and backward-compatible — no mismatch found with customer-mobile.**
  All three modified backend files add **optional, unauthenticated white-label scoping** to public marketing-site endpoints, unrelated to customer-mobile's authenticated flows:
  - `apps/api/src/modules/branches/branches.controller.ts` — `PublicBranchesController.list()` gained an optional `domain` query param scoping `GET /public/branches`; `apps/api/src/modules/branches/branches.service.ts` `listPublicBranches(partnerId?)` takes a matching optional filter.
  - `apps/api/src/modules/reviews/reviews.controller.ts`/`reviews.service.ts` — same optional `domain`/`partnerId` scoping pattern for `GET /public/reviews/featured`.
  - `apps/api/src/modules/payments/payments.controller.ts` — the PayMongo webhook handler's error-status logic changed to return 500 (not 400) for non-`HttpException` failures, so PayMongo correctly retries infra failures instead of treating them as permanently rejected. A payments-reliability fix, not a customer-mobile-facing contract change.

  Grepping `apps/customer-mobile` for `apiFetch`/`apiUpload` calls shows the app only calls authenticated endpoints: `/orders/:id/delivery/verify`, `/orders/:id/delivery/sign`, `/orders/:id/reschedule`, `/reviews` (POST, authenticated create — a different endpoint from the modified public `GET /public/reviews/featured`), `/subscriptions` (POST/PATCH/DELETE via `:id`), `/favorites` (POST/DELETE), `/addresses` (POST/PATCH/DELETE via `:id`), `/customers/me` (PATCH), `/notifications/:id/read`, `/notifications/read-all`, `/users/me/push-token`. **No breaking mismatch found** between the modified public controllers and customer-mobile's actual usage — the mobile app doesn't call `/public/branches` or `/public/reviews/featured` at all (those are marketing-site-only).

- **[NOTE] API client setup is centralized and consistent.** `src/api-config.ts` (`getApiV1BaseUrl`) + `src/store/auth.ts` (`authRequest`/`authUpload`) form the single integration point; all screens route through `useAuthStore().apiFetch`/`apiUpload` rather than calling `fetch` directly (confirmed via grep across `book.tsx`, `onboarding/*.tsx`, `(tabs)/profile.tsx`, `subscriptions/index.tsx`, `orders/[id]/index.tsx`, `use-notifications.ts`, `push-notifications.ts`).

- **[MEDIUM] Not independently line-traced this pass: branch-picker / nearest-branches screens' response typing and loading/error states.** `src/components/branch-picker-sheet.tsx` and `src/components/nearest-branches.tsx` are the likely consumers of branch-listing data; their exact fetch calls and typing vs. `@lunara/types` weren't individually verified — flagged as a gap for a focused follow-up rather than an asserted defect.

- **[LOW] No retry/backoff for transient network failures beyond the single 401-refresh-and-retry path** in `authRequest`/`authUpload` (`src/store/auth.ts:59-64,110-115`). A non-401 network blip on a mutating call (e.g. `/orders/:id/reschedule`) surfaces an error after one attempt with no automatic retry — likely intentional for mutations, but worth confirming.

- **[CRITICAL — pre-existing bug, not from this branch's diffs] "Make this a recurring pickup" is broken: wrong request shape sent to `POST /subscriptions`.**
  `apps/customer-mobile/app/orders/[id]/index.tsx`, `handleSubscribe()` (lines 361-389, POST body at 368-382) sends `bookingType`, `branchId`, `bagSizeId`, `addonIds`, `addonQuantities`, `pickupAddressId` as **top-level** fields. But `CreateSubscriptionDto extends CreateBookingOrderDto extends BookingQuoteDto` (`apps/api/src/modules/subscriptions/dto/subscription.dto.ts:6`, `apps/api/src/modules/booking/dto/booking.dto.ts:74-115,122-132`) requires a top-level **`services: ServiceSelectionDto[]`** array (`@IsArray() @ArrayMinSize(1)`, not optional) — `bookingType`/`bagSizeId`/etc. belong *inside each entry of `services[]]`*, not at the top level. The correct shape is used correctly elsewhere in the same app, at `app/book.tsx:949-969` (`POST /booking/orders`), which nests these fields under `services: [{ ... }]`.
  As written, every "recurring pickup" request from the order-detail screen is missing the required `services` field and will fail class-validator validation (400, "services should not be empty") for every booking type. The `catch` block (lines 384-386) surfaces this as a generic "Could not set up recurring pickup" error toast rather than crashing, so the feature silently fails 100% of the time rather than erroring loudly. **Fix: wrap the relevant fields in a `services: [{...}]` array, mirroring `app/book.tsx:952-961`.** This is unrelated to the branches/payments/reviews backend diffs on this branch — it's a standalone, pre-existing defect surfaced during this audit.

- **[LOW] `app/book.tsx:698` swallows shop-list load failures silently** — the `catch` in `loadShops` sets `setShopOptions([])` with no user-visible error message distinct from "no shops available"; a network failure looks identical to a legitimately empty list.

- **[NOTE] No central `lib/api.ts`** — the HTTP client lives inside `src/store/auth.ts` (an auth store doubling as the API client, see Code Quality's `auth.ts` finding). Functions correctly and is used consistently everywhere, but the placement is unusual.

- **[NOTE] Branches module has no direct customer-mobile consumer.** Customer-mobile has no branch listing/detail screen wired to `apps/api/src/modules/branches` at all — it gets shop/branch data via a different endpoint, `GET /booking/shops` (`app/book.tsx:686`), typed as `ShopOption[]`. The modified `branches.controller.ts`/`branches.service.ts` changes are scoped to `PublicBranchesController` (marketing site only) and don't affect the mobile app either way.

- **[NOTE] Payments and reviews request/response shapes verified byte-for-byte against current backend DTOs — no drift found.** `payment-checkout.tsx:114` (`POST /payments/intent`) and `(tabs)/wallet.tsx:116` (`POST /payments/wallet-topup/intent`) match `CreatePaymentIntentDto`/`CreateWalletTopupIntentDto` (`apps/api/src/modules/payments/dto/payment.dto.ts`) exactly. `review/[id].tsx:86` POST body (`orderId, rating, comment`) matches `CreateReviewDto` exactly, and the `{review, message}` response shape from `reviews.service.ts:114-120` matches what the screen reads (`result.review`, line 94).

---

## Summary counts

- Critical: 2
- High: 4
- Medium: 9
- Low: 10
- Note: 19

## Top 5 to fix first

1. **[CRITICAL — Data flow]** `handleSubscribe()` in `app/orders/[id]/index.tsx:361-389` sends the wrong request shape to `POST /subscriptions` (missing required `services[]` array — fields sent top-level instead). "Make this a recurring pickup" fails validation and silently errors for every user, every booking type. Fix by nesting fields under `services: [{...}]`, mirroring `app/book.tsx:952-961`.
2. **[CRITICAL — Build]** Add the missing `res/xml/secure_store_backup_rules.xml` and `res/xml/secure_store_data_extraction_rules.xml` referenced by `AndroidManifest.xml:18` — the Android build cannot link resources without them, so this branch cannot ship to Android as-is. This also blocks the SecureStore backup-exclusion security control from actually working (`allowBackup="true"` + missing exclusion rules).
3. **[HIGH — Code quality]** `app/book.tsx` (2,944 lines / 26 `useState`) and `app/orders/[id]/index.tsx` (946 lines / 24 `useState`) are severe maintainability outliers that should be decomposed into step/modal sub-components before more features are layered on.
4. **[HIGH — Security]** Remove the unused `SYSTEM_ALERT_WINDOW` (and likely `RECORD_AUDIO`) permissions from `AndroidManifest.xml` — no code justifies either, and `SYSTEM_ALERT_WINDOW` specifically draws Play Store review scrutiny as an overlay/phishing-associated permission.
5. **[HIGH — Build]** Verify the Gradle wrapper 8.14.3 → 9.3.1 jump against the pinned Android Gradle Plugin version and CI image before merging — an incompatible pairing breaks every Android build.

Everything else — the SecureStore token migration itself, the SDK57/edge-to-edge upgrade, the white-label backend scoping changes, and the app's TypeScript strictness (zero `any`/`@ts-ignore` anywhere) — looks intentional, coherent, and in most cases a genuine improvement, not broken or half-done.
