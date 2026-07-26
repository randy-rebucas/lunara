# AI Agent → API Endpoint Domain Map

Maps the API surface documented in [API_ENDPOINTS.md](./API_ENDPOINTS.md) to the AI persona whose domain it falls under (`apps/api/src/modules/ai-agents/personas.ts`). None of the personas currently have live tool/DB access — this map is for **routing questions to the right agent** and for scoping future tool-use if/when agents are wired to real data.

| Agent | Role | Owns these endpoint groups |
|---|---|---|
| **Aurora** | AI Orchestrator | No dedicated endpoints — routes cross-cutting questions to the specialists below. Backed by `/ai-agents/*` itself. |
| **Olivia Reyes** | Operations Manager | `/admin/dashboard`, `/admin/control-tower`, `/admin/live-tracking`, `/admin/orders`, `/admin/quality-alerts`, `/admin/revenue`, `/admin/reports`, `/admin/dispatch/dashboard`, `/admin/dispatch/queue` |
| **Emma Flores** | Customer Support | `/auth/*`, `/users/me`, `/customers/*`, `/addresses/*`, `/favorites/*`, `/booking/*`, `/deals`, `/subscriptions/*`, `/orders/*` (customer-facing), `/reviews/*`, `/notifications/*`, `/support/tickets`, `/support/lost-items`, `/support/area-requests`, `/refunds/*` |
| **Daniel Cruz** | Dispatcher | `/admin/dispatch/*`, `/admin/operations/orders/*`, `/admin/sos/*`, `/riders/pickup-offers`, `/riders/pickup-tasks/*`, `/riders/delivery-offers`, `/riders/delivery-tasks/*`, `/riders/tasks*`, `/riders/active-assignment`, `/riders/online`, `/riders/offline`, `/riders/break/*`, `/riders/location`, `/admin/service-areas/*` |
| **Mia Santos** | Partner Success | `/partner-applications/*`, `/rider-applications/*`, `/admin/partners/*`, `/admin/shops/*`, `/partner/dashboard`, `/partner/branches/*`, `/partner/profile`, `/partner/staff/*`, `/partner/notifications/*` |
| **Benjamin Scott** | Finance Officer | `/payments/*`, `/wallets/*`, `/refunds/*` (admin review side), `/admin/ledger/*`, `/admin/audit-logs/*`, `/partner/revenue`, `/partner/settlements/*`, `/partner/ledger-balance`, `/admin/partners/:id/settlements`, `/riders/wallet*`, `/riders/earnings`, `/riders/cash-summary`, `/riders/remit-cash`, `/admin/riders/withdrawals/*`, `/admin/riders/:userId/wallet/hold`, `/admin/riders/:userId/earnings/credit`, `/admin/riders/:userId/cash-remittances*` |
| **Noah Parker** | Software Engineer | No domain endpoints — advises on architecture across all modules (`apps/api/src/modules/**`), auth/JWT internals, schema/DTO conventions. |
| **Sophia Kim** | Marketing Manager | `/admin/promotions/*`, `/deals`, `/admin/incentive-campaigns/*`, `/riders/incentive-campaigns`, `/admin/banners/*`, `/banners`, `/admin/broadcast/*`, `/rewards/*` (referral code) |

## Shared / cross-cutting endpoints

These don't belong to one specialist and are either infrastructure or span multiple domains:

| Endpoint group | Notes |
|---|---|
| `/health`, `/app-version` | Infra — not agent-specific |
| `/uploads/*` | Media serving — supports whichever domain uploaded the file (rider docs → Daniel/Mia, task photos → Daniel, remittance proofs → Benjamin) |
| `/orders/*` (partner/staff processing side) | Split: booking/cancel/reschedule → Emma; rider assignment → Daniel; processing/receiving/dispatch → falls under Partner Success (Mia) since it's partner-shop workflow, but ops-wide monitoring is Olivia's |
| `/laundry-tags/*` | Operational tooling — Olivia (ops) for policy, Daniel for pickup/tag assignment during dispatch |
| `/admin/services`, `/admin/addons` | Catalog management — closest to Sophia (promotions/catalog-facing) but also plain ops config (Olivia) |
| `/users/*` (admin user management), `/admin/setup/*`, `/admin/maintenance/*` | Platform administration — Noah (engineering/config) is the best fit; not customer- or partner-facing |
| `/partner/messages/*`, `/admin/messages/*` | Communication tooling — Mia (partner) / Olivia (admin-to-user ops messaging) depending on side |

## Notes

- **Aurora** and **Noah** intentionally have no owned endpoint group — Aurora is pure routing, Noah's domain is the codebase itself, not a business data slice. Both remain fully tool-less.
- **Live tool-calling shipped 2026-07-26**: the other 6 personas (Olivia, Emma, Daniel, Mia, Benjamin, Sophia) now have real, scoped, **read-only** Anthropic tool-use access to the services behind this mapping, wired in `apps/api/src/modules/ai-agents/tools/` (`registry.ts` + one file per domain) and invoked in-process from `AiAgentsService.sendMessage` — no internal HTTP calls, same pattern as the rest of the codebase's cross-module DI. Emma's tools are hard-scoped server-side to the calling user's own orders/wallet/refunds regardless of what the model is asked to look up.
- No persona has any write-capable tool yet (v1 is read-only across the board, including Sophia's promotions). Wallet holds, refund approval/processing, rider (re)assignment, and promo create/update remain admin-tool-only actions a human must perform — a natural v2 candidate once the read path is proven in production.

*Last updated: 2026-07-26.*
