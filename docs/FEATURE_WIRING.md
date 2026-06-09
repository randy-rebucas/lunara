# Feature Wiring Guide

Use this guide when adding, changing, or removing platform features so work lands consistently across the monorepo.

## Apps & audiences

| App | Package | Port | Primary users | When to wire |
|-----|---------|------|---------------|--------------|
| `api` | `@lunara/api` | 3001 | All | **Always** — backend is the source of truth |
| `admin-web` | `@lunara/admin-web` | 3002 | Admin | Platform management, support, analytics, promotions |
| `partner-web` | `@lunara/partner-web` | 3003 | Partner, staff | Shop orders, inventory, branch ops, reports |
| `customer-web` | `@lunara/customer-web` | 3000 | Customer | Booking, orders, wallet, support, account |
| `customer-mobile` | `@lunara/customer-mobile` | 8081 | Customer | Mobile parity with customer-web (unless web-only) |
| `rider-mobile` | `@lunara/rider-mobile` | 8082 | Rider | Dispatch, navigation, proof of delivery, earnings |

Not every feature touches every app. Use the **audience** column: if riders never interact with it, skip `rider-mobile`.

## Recommended wiring order

```
@lunara/types  →  @lunara/validation  →  @lunara/utils  →  @lunara/hooks
        ↓
     apps/api (module, DTOs, guards, events, realtime)
        ↓
  admin-web · partner-web · customer-web · customer-mobile · rider-mobile
        ↓
  docs (API_ENDPOINTS.md + docs/features/<slug>.md)
```

### 1. Shared packages

| Package | Update when… |
|---------|----------------|
| `@lunara/types` | New enums, interfaces, API response shapes |
| `@lunara/validation` | Request/body schemas shared with clients |
| `@lunara/utils` | RBAC rules, order flow, pricing, business helpers |
| `@lunara/hooks` | Shared React hooks, `createApiClient`, auth provider |
| `@lunara/ui` | Reusable components used by 2+ web apps |
| `@lunara/config` | Theme, feature flags, app-wide constants |

Rebuild after package changes:

```bash
npm run build --workspace=@lunara/types
npm run build --workspace=@lunara/validation
npm run build --workspace=@lunara/utils
npm run build --workspace=@lunara/hooks
```

### 2. API (`apps/api`)

- Add or extend a NestJS module under `apps/api/src/modules/`
- DTOs with `class-validator`; respect existing `forbidNonWhitelisted` behavior
- `@Roles()` and guards for RBAC (`customer`, `partner`, `staff`, `rider`, `admin`)
- Emit domain events if other modules or realtime depend on the change
- Socket.IO namespace updates if customers/riders need live updates
- Update `apps/api/src/scripts/seed.ts` when dev data should reflect the feature

### 3. Web apps (Next.js)

| App | API client pattern | Auth |
|-----|-------------------|------|
| `admin-web` | App-specific lib + `@lunara/hooks` | Admin JWT |
| `partner-web` | `partner-api.ts` + hooks | Partner/staff JWT |
| `customer-web` | `@lunara/hooks` `AuthProvider` | Customer JWT / OTP |

Wire: pages/routes, forms, loading/error states, and role-appropriate navigation.

### 4. Mobile apps (Expo)

| App | Config | Notes |
|-----|--------|-------|
| `customer-mobile` | `EXPO_PUBLIC_API_URL` in root `.env` | Expo Router screens under `app/` |
| `rider-mobile` | Same | Offline/sync patterns in `src/lib/offline/` where used |

Match customer-web behavior unless the feature is intentionally web-only. Test on Expo Go with the API running locally.

## Feature-type quick reference

| Feature type | API | admin-web | partner-web | customer-web | customer-mobile | rider-mobile |
|--------------|-----|-----------|-------------|--------------|-----------------|--------------|
| New order status | ✓ | ✓ monitor | ✓ fulfill | ✓ track | ✓ track | ✓ task flow |
| Customer booking | ✓ | — | — | ✓ | ✓ | — |
| Rider dispatch | ✓ | ✓ assign | ✓ branch | ✓ track | ✓ track | ✓ primary |
| Partner inventory | ✓ | optional | ✓ | — | — | — |
| Admin promotion | ✓ | ✓ CRUD | — | ✓ apply | ✓ apply | — |
| Support ticket | ✓ | ✓ resolve | optional | ✓ create | ✓ create | — |
| Push notification | ✓ | — | optional | ✓ | ✓ | ✓ |

## Documentation requirements

When a feature changes API contracts or user-visible behavior:

1. **`docs/API_ENDPOINTS.md`** — new or changed routes, roles, request/response notes
2. **`docs/features/<feature-slug>.md`** — feature summary (use [`docs/features/_TEMPLATE.md`](./features/_TEMPLATE.md))
3. **`docs/features/README.md`** — add a row linking to the new summary
4. **`README.md`** — update manual test flows if the feature is part of a documented E2E path

Optional: update [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) for structural or event-flow changes.

## Verification checklist

Copy into the feature summary or PR description:

```markdown
### Wiring verification

- [ ] Shared packages built and types align across apps
- [ ] API: endpoints, validation, RBAC, tests/manual smoke
- [ ] admin-web: (N/A or describe)
- [ ] partner-web: (N/A or describe)
- [ ] customer-web: (N/A or describe)
- [ ] customer-mobile: (N/A or describe)
- [ ] rider-mobile: (N/A or describe)
- [ ] Seed/dev login paths still work
- [ ] docs/API_ENDPOINTS.md updated
- [ ] docs/features/<slug>.md written
```

## Related docs

- [Architecture](./ARCHITECTURE.md) — system overview, events, RBAC
- [API Endpoints](./API_ENDPOINTS.md) — REST reference
- [Auth Flow](./AUTH_FLOW.md) — login, OTP, tokens
- [Deployment](./DEPLOYMENT.md) — production rollout per app
