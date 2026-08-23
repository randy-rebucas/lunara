# Customer-Web Quick Health Scan

Fast repo-wide triage pass. Not a per-page audit (see other files in this folder for that).

## 1. Lint (`npm run lint`)
Was 0 errors, 5 warnings; now 0 errors, 2 warnings after fixes:
- **Fixed:** `src/components/auth-loading.tsx` — swapped `<img>` for `next/image` (static local SVG, safe swap).
- **Fixed:** `src/components/data-page-status.tsx` — swapped `<img>` for `next/image` (static local SVG, safe swap).
- **Fixed:** `src/components/booking/booking-wizard.tsx:882` (now ~881) — removed unnecessary `useMemo` dep `selectedShop`.
- **Left open:** `src/components/booking/booking-wizard.tsx:169` — `AddonImage`'s `<img>` src comes from `resolveMediaUrl` (Cloudinary-hosted addon images), and Cloudinary's hostname isn't in `next.config.ts`'s `images.remotePatterns` (only `images.unsplash.com`/`images.pexels.com` are allowlisted). Swapping to `next/image` here would 400 until that config is updated — left as-is pending a deliberate decision to add the Cloudinary pattern.
- **Left open (false positive):** `src/components/customer-tracking-sync.tsx:63` — `joinedOrdersRef` is a stable `useRef` object for the component's lifetime; reading `.current` in the effect cleanup isn't actually stale (it's not a DOM-node ref subject to React's node-recycling caveat). No behavior change needed.

## 2. Typecheck (`tsc --noEmit`)
1 error (fixed):
- `src/app/(authenticated)/settings/page.tsx:77` — `Type 'number' is not assignable to type 'Timeout'` — `ReturnType<typeof window.setTimeout>` was resolving against Node's global `setTimeout` override instead of DOM lib. **Fix:** typed `savedTimeoutRef` explicitly as `useRef<number | null>(null)` (settings/page.tsx:52). `tsc --noEmit` now clean.

## 3. Dependencies (package.json)
- `eslint-config-next: ^16.2.6` vs `next: ^15.3.3` — major version mismatch (config major is ahead of the framework major). Worth pinning both to the same major to avoid rule drift.
- `lucide-react: ^1.21.0` — confirm this is intentional; many repos on this stack pin `lucide-react` to 0.x releases. No usage issue found, just flagging the version for a deliberate check.
- No unused dependencies identified in a spot check (`react-markdown`, `react-qr-code`, `socket.io-client` all have call sites under `src/`).
- No `.env.example` present in this app to diff against `process.env.*` usage, so env-var reference check was skipped (no baseline to compare against).

## 4. TODO/FIXME/HACK/XXX markers
None found under `apps/customer-web/src`.

## 5. Dead code (spot check)
No obviously-orphaned exported components/hooks found in the spot check performed; not exhaustive.

## 6. Cross-app pattern consistency
- Data fetching is inconsistent: most pages/components call `fetch` directly and roll their own state, while a few files (`middleware.ts`, `lib/report-client-error.ts`, `layout.tsx`, `riders/apply/page.tsx`, `partners/apply/page.tsx`, `components/marketing/home-page-data.ts`) are the only hits for the fetch/SWR/query grep. No shared data-fetching hook (SWR/React Query) is used app-wide — each authenticated page under `(authenticated)/` appears to implement its own fetch/loading/error handling rather than sharing one hook. Confirm with the per-page audits whether this causes duplicated loading/error UI logic.

## 7. Security smells
- No hardcoded secrets, API keys, or private-key material found (`sk_live`, `sk_test`, `AIza`, `-----BEGIN`) under `src/`.
- No disabled TLS/cert checks (`rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED`) found.
- No `console.log` of password/token/secret/apiKey values found.

## 8. Environment variables
Skipped — no `.env.example` in `apps/customer-web` to diff `process.env.*` usage against. If one exists at the repo root or in a shared config package, re-run this check against that file.
