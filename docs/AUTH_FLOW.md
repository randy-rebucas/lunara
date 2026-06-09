# Authentication Flow

## Registration

1. Client sends `POST /auth/register` with email or phone + profile fields
2. API hashes password (if provided), creates `users` document with role
3. Returns JWT access + refresh tokens

## Login (Password)

1. `POST /auth/login` with email/phone + password
2. API validates credentials via bcrypt
3. JWT payload: `{ sub, email, phone, role, permissions[] }`

## Login (OTP)

1. `POST /auth/otp/request` → sends a 6-digit code via **Twilio Verify** SMS
   - Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID`
2. `POST /auth/login` with phone + otp
3. API verifies the code through Twilio Verify, issues tokens (creates customer account if new phone)

Phone numbers are normalized to E.164 before SMS (e.g. `09171234567` → `+639171234567`).

## Token Refresh

1. `POST /auth/refresh` with refresh token
2. Signed with `JWT_REFRESH_SECRET`, longer expiry (30d)
3. Returns new access + refresh pair

## Social Login (planned)

OAuth2 code exchange → find or create user → issue JWT.

## Client Storage

| Platform | Access Token | Refresh Token |
|----------|--------------|---------------|
| Web | Memory / httpOnly cookie | httpOnly cookie |
| Mobile | SecureStore | SecureStore |

## Authorization

- `JwtAuthGuard` validates Bearer token
- `RolesGuard` checks `@Roles()` metadata against `user.role`
- Fine-grained checks via `user.permissions` from RBAC map
