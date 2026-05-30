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

1. `POST /auth/otp/request` → generates 6-digit code, stores in Redis (5 min TTL), sends SMS
2. `POST /auth/login` with phone + otp
3. API verifies OTP from Redis, issues tokens

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
