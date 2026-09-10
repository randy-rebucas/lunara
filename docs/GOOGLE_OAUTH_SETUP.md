# Google OAuth Setup

How to create `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (already declared, empty, in [.env.example](../.env.example) and root `.env`) in Google Cloud Console.

> **Status:** credentials-only guide. No code in `apps/api` currently reads these vars — Social Login is listed as "planned" in [AUTH_FLOW.md](./AUTH_FLOW.md#social-login-planned). This doc gets the Google-side credentials ready; wiring a `GoogleStrategy` / `POST /auth/google` endpoint is separate follow-up work.

---

## 1. Create (or select) a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Top-left project picker → **New Project**
   - Name: `Lunara` (or `Lunara Dev` / `Lunara Prod` if you want separate projects per environment)
3. Select the project once created.

## 2. Configure the OAuth consent screen

1. Left nav → **APIs & Services → OAuth consent screen**
2. User type:
   - **External** — required unless every user is inside a Google Workspace org you control
3. Fill in the required fields:
   - App name: `Lunara`
   - User support email: your support inbox (e.g. `admin@localpro.asia`, matches `SMTP_USER`)
   - App logo: optional for dev, required before Google verifies the app for production
   - Developer contact email: your email
4. Scopes: add `.../auth/userinfo.email` and `.../auth/userinfo.profile` (enough for sign-in — no sensitive/restricted scopes needed)
5. Test users (while in "Testing" publish status): add the Google accounts you'll use to test sign-in — unlisted accounts get a "app not verified / access blocked" error
6. Leave publish status as **Testing** for dev; move to **In production** only once ready for real users (triggers Google's verification review if you request sensitive scopes — not needed here)

## 3. Create OAuth client ID credentials

1. Left nav → **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
2. Application type — you'll likely need **two** client IDs, since this repo has both a web backend and mobile apps:

### Web application (used by API + Next.js web apps)

- Application type: **Web application**
- Name: `Lunara API (dev)`
- **Authorized JavaScript origins** — add every web origin that will initiate the flow (matches `CORS_ORIGINS` in `.env`):
  ```
  http://localhost:3000   # customer-web
  http://localhost:3002   # (partner-web or admin-web, confirm port)
  http://localhost:3003
  http://localhost:3005
  http://localhost:3006
  ```
- **Authorized redirect URIs** — where Google redirects after consent, back to the API:
  ```
  http://localhost:3001/api/v1/auth/google/callback
  ```
  (adjust the path to whatever route the backend implementation ends up using — `API_URL` in `.env` is `http://localhost:3001`)
- For production, add the real domains too, e.g.:
  ```
  https://lunara.app
  https://api.lunara.app/api/v1/auth/google/callback
  ```

### Android / iOS (only if mobile apps will support native Google Sign-In)

- Application type: **Android** — needs the package name (`com.lunara.staff`, `com.lunara.customer`, etc. — see each app's `app.json`) and the SHA-1 signing certificate fingerprint (`eas credentials --platform android` or `keytool -list -v -keystore <path>`)
- Application type: **iOS** — needs the bundle identifier
- Skip this section entirely if mobile sign-in will go through a web view / the backend web client instead (simpler, works today with Expo's `AuthSession` proxy)

3. Click **Create**. Google shows the **Client ID** and **Client secret** once — copy both immediately.

## 4. Fill in `.env`

```
GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxx
```

- Never commit real values — `.env` is gitignored; only `.env.example` (blank placeholders) is tracked.
- For each deployed environment (staging/production), create a **separate** OAuth client with that environment's exact origins/redirect URIs, and set the secrets via that environment's config (Vercel/Render/EAS secrets, etc.) — don't reuse the dev client's redirect URIs, since Google rejects a redirect URI at request time if it isn't in the allow-list for that specific client.

## 5. Enable the People API (optional, only if you need more than basic profile)

The consent-screen scopes above (`userinfo.email`, `userinfo.profile`) work out of the box — no extra API needs enabling for basic "Sign in with Google". Only enable **APIs & Services → Library → Google People API** if a future implementation needs additional profile fields.

## 6. Verification checklist before going to real users

- [ ] OAuth consent screen has a real support email and (for production) a privacy policy URL — see `apps/customer-web` legal pages if one already exists
- [ ] Publish status moved from **Testing** to **In production** (removes the "unverified app" warning and the test-user allow-list restriction)
- [ ] Production OAuth client's authorized origins/redirect URIs use `https://` production domains only
- [ ] Client secret stored as an environment secret, not committed anywhere

---

## Next step (not covered here): backend wiring

Once credentials exist, the API side needs, roughly:

1. `npm install google-auth-library` (or `passport-google-oauth20` if using Passport, matching the existing `JwtAuthGuard`/`RolesGuard` pattern in [AUTH_FLOW.md](./AUTH_FLOW.md))
2. An endpoint (e.g. `POST /auth/google`) that accepts a Google ID token from the client, verifies it against `GOOGLE_CLIENT_ID`, finds-or-creates a `users` document, and issues the same JWT access/refresh pair as `POST /auth/login`
3. Client-side: web apps use Google Identity Services' JS SDK to get the ID token; mobile apps use `expo-auth-session` or `@react-native-google-signin/google-signin`

This is intentionally out of scope for this doc — ask when ready to implement it.
