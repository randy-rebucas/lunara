# Feature: API access for enterprise/franchise integrations

> **Status:** draft (design only — not implemented)
> **Date:** 2026-07-24
> **Author / PR:** —

## Summary

Today the API's only external-facing surface is the existing JWT-authenticated app APIs (customer/partner/rider/admin) plus one inbound webhook (`POST /payments/webhooks/paymongo`, gated by `PaymentWebhookGuard` — a shared-secret header check). There is no API-key issuance, no scoped external-partner access, and no outbound webhook/event-subscription system. This document scopes what a franchise/enterprise integration surface would look like, without committing to build it — the actual shape depends entirely on a product decision this session can't make: **what would an enterprise/franchise partner actually want to integrate with?**

## Why this needs a product decision first

"API access for franchise integrations" could mean several different things with very different scope:

1. **A franchise owner's own read-only reporting API** — e.g. a franchise operator wants to pull their own branches' order/revenue data into their own BI tool. This is the smallest slice: scoped, read-only, keyed to branches they already own.
2. **A booking/order-creation API for enterprise customers** — e.g. a corporate account (see the earlier corporate-portal feature) wants to place orders programmatically rather than through the customer app. This touches the booking flow, not just reporting.
3. **A webhook/event system** — e.g. notify an external system whenever an order status changes, a settlement posts, etc. This is architecturally the biggest lift (needs a subscription model, retry/delivery-guarantee logic, and signing).
4. **Full white-label API** for a franchise to run their own branded front-end against Lunara's backend — the largest possible scope, effectively productizing the whole platform as a B2B API.

Each of these has a completely different data model and security surface. Building any one without knowing which is wanted risks throwaway work.

## Proposed shape (if scoped to option 1 — read-only reporting API)

This is the smallest, safest starting point and the one most likely to match "franchise integration" in practice.

### New entity: `ApiKey`

```
ApiKey {
  _id
  ownerId: ObjectId          // the partner/franchise user this key belongs to
  label: string              // e.g. "Franchise HQ BI export"
  hashedKey: string          // store a hash, never the raw key
  scopes: string[]           // e.g. ['reports:read', 'orders:read']
  branchIds: ObjectId[]      // which branches this key can see — mirrors listOwnedBranchIds scoping
  lastUsedAt?: Date
  revokedAt?: Date
  createdAt, updatedAt
}
```

### Auth

New `ApiKeyGuard` (sibling to `PaymentWebhookGuard`) checking an `X-Api-Key` header against a hashed lookup, attaching a scoped "principal" to the request the same way `JwtAuthGuard` attaches `req.user` today. Existing `RolesGuard`-style scope-checking logic could be reused/adapted rather than duplicated.

### Endpoints

A new versioned surface, e.g. `GET /public-api/v1/reports`, `GET /public-api/v1/orders`, reusing the existing scoping pattern already in `partner-operations.service.ts` (`listOwnedBranchIds`) so a key's visible data is exactly the branches its owner already has access to in partner-web — no new authorization logic, just a new auth *method* (API key instead of JWT) in front of read paths that already exist.

### Admin-web

A new "API keys" management screen (likely under a partner's detail page, admin-issued) to create/revoke keys and see last-used timestamps — mirrors the existing verification-status/application-review pattern already in admin-web.

## Open questions before implementation

1. **Which of the four options above is actually wanted?** This determines everything else — read-only reporting vs. write access vs. webhooks vs. full white-label are not incremental steps from one to the next, they're different projects.
2. **Rate limiting**: the existing `ThrottlerModule` (`app.module.ts`) is configured platform-wide; an external API surface likely needs its own, stricter limits.
3. **Versioning/deprecation policy**: once external parties depend on a response shape, changing it is a breaking-change problem the internal app APIs don't currently have to worry about (all clients are Lunara's own apps, deployed together).
4. **Who requests/approves a key?** Self-serve from partner-web, or admin-issued only? Given this is framed as "enterprise/franchise," admin-issued (matching the `ApiKey.ownerId` + admin-web management screen above) is the safer default.

## Affected apps (if built, option 1 scope)

| App | Wired? | Notes |
|-----|--------|-------|
| `api` | no | New `ApiKey` schema/module, `ApiKeyGuard`, new `public-api` versioned route group |
| `admin-web` | no | API key issuance/revocation UI |

## Recommendation

Do not start this until a specific franchise/enterprise partner (or a concrete request from one) exists — building speculative external API surface without a real integration target to validate against is the highest-risk kind of scope-creep in this whole feature list. If/when one exists, scope option 1 (read-only reporting, scoped to owned branches) first — it reuses existing authorization logic almost entirely and has the smallest security surface.

## Out of scope / follow-ups

- Outbound webhooks/event subscriptions (option 3) and full white-label API (option 4) are substantially bigger and shouldn't be scoped until option 1 has shipped and proven the pattern.
- Any write-access external API (creating orders, editing branch settings, etc.) needs its own security review beyond what this doc covers.
