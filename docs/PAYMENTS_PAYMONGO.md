# PayMongo payments guide

Lunara uses [PayMongo](https://paymongo.com) Checkout Sessions for online payments in PHP: **GCash**, **Maya**, and **credit/debit card**. Wallet top-ups and order checkout share the same integration.

**Apps involved:** `apps/api` (server), `apps/customer-web`, `apps/customer-mobile`

---

## What PayMongo handles

| Flow | API route | After payment |
|------|-----------|---------------|
| **Order checkout** | `POST /payments/intent` | Order → `pending_dispatch`, receipt shown |
| **Wallet top-up** | `POST /payments/wallet-topup/intent` | Wallet credited, user returns to `/wallet` |

Other methods (unchanged):

- **Lunara Wallet** — instant debit, no PayMongo
- **Cash** — booking confirmed, payment stays `pending` until collected by rider

---

## Environment variables

Set these on the **API** (root `.env` or hosting provider):

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYMONGO_SECRET_KEY` | Yes (production) | Secret key from PayMongo dashboard (`sk_test_…` or `sk_live_…`) |
| `PAYMONGO_WEBHOOK_SECRET` | Yes (production) | Signing secret for your webhook endpoint (`whsk_…` or hook secret from dashboard) |
| `CUSTOMER_WEB_URL` | Yes | Public customer web URL, e.g. `https://lunara.app` or `http://localhost:3000` |
| `API_URL` | Yes | Public API base used for dev mock redirects, e.g. `https://api.lunara.app` or `http://localhost:3001` |
| `PAYMENT_WEBHOOK_SECRET` | Optional | Legacy guard for `POST /payments/:id/confirm` (not used by PayMongo webhooks) |

Example (`.env`):

```env
PAYMONGO_SECRET_KEY=sk_test_xxxxxxxx
PAYMONGO_WEBHOOK_SECRET=whsk_xxxxxxxx
CUSTOMER_WEB_URL=http://localhost:3000
API_URL=http://localhost:3001
```

When `PAYMONGO_SECRET_KEY` is **empty**, order checkout falls back to **dev mock** pages at `/api/v1/payments/mock/paymongo/*`. Wallet top-up still uses mock checkout in that mode. Production must set real keys.

---

## PayMongo dashboard setup

### 1. Create / open your PayMongo account

- [PayMongo Dashboard](https://dashboard.paymongo.com)
- Use **Test mode** for development (`sk_test_…` keys)

### 2. Enable payment methods

In the dashboard, enable the methods you need:

- GCash
- Maya (PayMongo API type: `paymaya`)
- Cards

### 3. Create a webhook endpoint

1. Go to **Developers → Webhooks** (or **Webhooks** in settings).
2. Add endpoint URL:

   ```
   https://<your-api-host>/api/v1/payments/webhooks/paymongo
   ```

   Local dev: use [ngrok](https://ngrok.com) or similar to expose port `3001`, e.g.

   ```
   https://abc123.ngrok-free.app/api/v1/payments/webhooks/paymongo
   ```

3. Subscribe to events (at minimum):

   - `checkout_session.payment.paid`
   - `payment.paid` (backup)

4. Copy the **webhook signing secret** → `PAYMONGO_WEBHOOK_SECRET`.

### 4. API keys

Copy **Secret key** → `PAYMONGO_SECRET_KEY` on the API server. Never expose this in customer-web or mobile env vars.

---

## How checkout works

```mermaid
sequenceDiagram
  participant User
  participant Web as customer-web
  participant API
  participant PM as PayMongo

  User->>Web: Choose GCash / Maya / Card
  Web->>API: POST /payments/intent or /wallet-topup/intent
  Note over Web,API: Includes clientOrigin (window.location.origin)
  API->>PM: Create Checkout Session
  PM-->>API: checkout_url
  API-->>Web: checkoutUrl
  Web->>PM: Redirect user
  User->>PM: Complete payment
  PM->>API: Webhook checkout_session.payment.paid
  API->>API: Fulfill payment (order or wallet)
  PM->>Web: Redirect to success_url
  Web->>API: POST /payments/:id/sync (optional)
  Web->>User: Wallet or receipt page
```

### Success URLs

| Purpose | Redirect after PayMongo |
|---------|-------------------------|
| Order | `{origin}/checkout/{orderId}/success?paymentId={id}` |
| Wallet top-up | `{origin}/wallet?topupPaymentId={id}` |

`origin` comes from `clientOrigin` sent by the browser (`window.location.origin`), so the user returns to the **same host** they signed in on (important when using LAN IP vs `localhost`).

In production, `clientOrigin` must match `CUSTOMER_WEB_URL` host or it falls back to `CUSTOMER_WEB_URL`.

### Fulfillment

Payments are marked **paid** when:

1. **Webhook** — `POST /payments/webhooks/paymongo` (primary), or
2. **Sync** — `POST /payments/:id/sync` when the user lands on success/wallet return (polls PayMongo session status)

Wallet credits are **idempotent** (duplicate webhooks do not double-credit).

---

## API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/payments/intent` | JWT | Start order payment. Body: `orderId`, `method`, optional `cashTiming`, `clientOrigin` |
| `POST` | `/payments/wallet-topup/intent` | JWT | Start wallet top-up. Body: `amount` (min ₱100), `method`, `clientOrigin` |
| `GET` | `/payments/orders/:orderId` | JWT | Checkout summary |
| `GET` | `/payments/:id` | JWT | Payment + order; auto-syncs pending PayMongo session |
| `POST` | `/payments/:id/sync` | JWT | Poll PayMongo and fulfill if paid |
| `POST` | `/payments/webhooks/paymongo` | PayMongo signature | Webhook handler |

### Payment methods (`method` field)

| Lunara enum | PayMongo checkout type | UI label |
|-------------|------------------------|----------|
| `gcash` | `gcash` | GCash |
| `maya` | `paymaya` | Maya |
| `stripe` | `card` | Card (enum name is legacy; not Stripe) |

### Metadata on PayMongo sessions

Stored on each session for webhook matching:

- `lunara_payment_id` — MongoDB payment `_id`
- `lunara_purpose` — `order` or `wallet_topup`
- `lunara_user_id` — customer user id

---

## Customer apps

### customer-web

| Page | Behavior |
|------|----------|
| `/checkout/[orderId]` | Payment method picker → redirect to PayMongo |
| `/checkout/[orderId]/success` | Syncs payment, shows receipt |
| `/wallet` | Top-up form → PayMongo → return with `?topupPaymentId=` |

### customer-mobile

- Checkout and wallet open PayMongo in the **device browser** (`Linking.openURL`).
- After payment, user returns to the **web** success URL (`CUSTOMER_WEB_URL`). Pull to refresh wallet or reopen the app.
- Pass `clientOrigin` when top-up from mobile if you add a dedicated return URL later; today wallet intent uses API default unless extended.

---

## Local development

### With PayMongo test keys (recommended)

1. Set `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` in root `.env`.
2. Run API and customer-web:

   ```bash
   npm run dev --workspace=@lunara/api
   npm run dev --workspace=@lunara/customer-web
   ```

3. Expose API for webhooks (ngrok):

   ```bash
   ngrok http 3001
   ```

4. Register webhook URL in PayMongo pointing to `https://<ngrok>/api/v1/payments/webhooks/paymongo`.

5. Use PayMongo **test cards** and test GCash/Maya flows per [PayMongo docs](https://developers.paymongo.com).

### Without PayMongo keys (mock only)

- Leave `PAYMONGO_SECRET_KEY` empty.
- Order checkout uses mock HTML at `/api/v1/payments/mock/paymongo/checkout` → **Pay now** → redirects back to customer-web.
- Wallet top-up uses the same mock flow.
- No real money moves.

### Auth after redirect

- Always open customer-web on one origin (e.g. only `http://localhost:3000`, not mixing with `127.0.0.1` or LAN IP).
- The app sends `clientOrigin` so PayMongo returns you to the correct host.
- If the access token expired during checkout, the API client retries refresh once before signing you out.

---

## Production checklist

- [ ] `PAYMONGO_SECRET_KEY` = **live** secret key (`sk_live_…`)
- [ ] `PAYMONGO_WEBHOOK_SECRET` set from live webhook endpoint
- [ ] Webhook URL registered and reachable (HTTPS)
- [ ] `CUSTOMER_WEB_URL` = production customer site
- [ ] `API_URL` = production API (for any mock-disabled paths)
- [ ] PayMongo account verified, GCash/Maya/card enabled for live
- [ ] Test order checkout end-to-end
- [ ] Test wallet top-up end-to-end
- [ ] Confirm webhook deliveries in PayMongo dashboard (no repeated failures)
- [ ] Refunds: Lunara credits **Lunara Wallet** for online payments; PayMongo refunds to original instrument are not automated yet

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Redirect to **login** after PayMongo | Wrong return host (lost `localStorage` session) | Use same URL to browse and pay; ensure `clientOrigin` is sent (customer-web does this automatically) |
| Payment stays **pending** after PayMongo | Sync checked session `status === 'paid'` (wrong — sessions are `active`/`expired`) | Fixed: sync reads `payments[].status === 'paid'`. Checkout page auto-syncs on load. |
| Webhook not received | No ngrok / wrong URL | Register webhook; use sync on return URL as backup |
| `PayMongo is not configured` | Missing secret key | Set `PAYMONGO_SECRET_KEY` on API |
| `Use POST /payments/wallet-topup/intent` | Calling old `POST /wallets/topup` with keys set | Use PayMongo top-up flow only |
| Webhook **401/400** | Bad signature | Match `PAYMONGO_WEBHOOK_SECRET` to endpoint secret; API must receive raw body (`rawBody: true` in `main.ts`) |
| Amount mismatch | PayMongo uses **centavos** | API converts `amount * 100` automatically |

---

## Related code

| Area | Path |
|------|------|
| PayMongo client | `apps/api/src/modules/payments/paymongo.service.ts` |
| Payment logic | `apps/api/src/modules/payments/payments.service.ts` |
| Routes | `apps/api/src/modules/payments/payments.controller.ts` |
| Payment schema | `apps/api/src/modules/payments/schemas/payment.schema.ts` |
| Shared labels | `packages/utils/src/payment.ts` |
| Web checkout UI | `apps/customer-web/src/components/payment/` |

---

## Further reading

- [PayMongo API — Checkout Sessions](https://developers.paymongo.com/reference/create-a-checkout)
- [PayMongo Webhooks](https://developers.paymongo.com/docs/webhooks)
- Lunara API index: [API_ENDPOINTS.md](./API_ENDPOINTS.md)
