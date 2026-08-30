# Audit: Partner-web — Settlements

Date: 2026-07-23 (re-audited 2026-08-30 — no changes, no new findings)

## Entry point
- Page: `apps/partner-web/src/app/settlements/page.tsx`
- Component(s): inline in the page file, no separate component

## Sub-pages
None — no outbound navigation into a dynamic detail route. Each settlement
row expands inline (fetching its own orders on demand) rather than
navigating anywhere. "View revenue breakdown →" and "Change in Settings →"
link to sibling top-level pages already audited (`docs/audits/partner-web/revenue.md`,
`docs/audits/partner-web/settings.md`).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List settlements | GET | `/partner/settlements` | `PartnerSettlement[]` | `PartnerController.getSettlements` -> `PartnerOperationsService.getSettlements` |
| Settlement's orders (on row expand) | GET | `/partner/settlements/:id/orders` | `PartnerOrderDetail[]` | `PartnerController.getSettlementOrders` -> `PartnerOperationsService.getSettlementOrders` |
| Outstanding balance | GET | `/partner/ledger-balance` | `{ partnerId: string; payableBalance: number }` | `PartnerController.getLedgerBalance` -> `PartnerOperationsService.getLedgerBalance` |
| Payout method (for the summary tile) | GET | `/partner/settings` | `PartnerSettingsData` | traced in `docs/audits/partner-web/settings.md` |

## Backend trace
`getSettlements` scopes by `partnerId` for non-admin callers (unrestricted
for `ADMIN`). `getSettlementOrders` loads the settlement first, then 404s
(not 403 — avoids confirming a settlement id exists to a non-owner) if a
non-admin caller's id doesn't match `settlement.partnerId`, then returns the
orders tagged with that `settlementId`, using the settlement's own
*snapshotted* `commissionRate` for legacy-pricing orders rather than each
order's live branch rate — a deliberate historical-reconciliation choice
(comment explains it), not a bug. `getLedgerBalance` sums `partnerPayout` (or
`totalAmount` as fallback) across the caller's own `pending` settlements.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Outstanding balance | `ledger.payableBalance` | falls back to `'—'` if the ledger fetch hasn't resolved or failed — see Authorization note |
| Total paid out | client-derived `totalPayout` (sum of `partnerPayout ?? totalAmount` across `status === 'paid'` settlements), `totalSettlements` (`data.length`) | |
| Last settlement payout | `data[0].partnerPayout ?? .totalAmount`, `.paidAt` | relies on `data` already being sorted `createdAt: -1` server-side (confirmed in `getSettlements`), not re-sorted client-side |
| Revenue tracking | static link to `/revenue` | |
| Payout method | `settingsData.settings.payoutMethod/gcashNumber/mayaNumber/bankName/bankAccountNumber` (via `PAYOUT_METHOD_LABELS` + `payoutMethodSub`), link to `/settings` | this page is `PARTNER`/`ADMIN`-only (`useRequirePartner`), so it's unaffected by the payout-field redaction added for non-editing roles in `docs/audits/partner-web/settings.md` — both roles this page allows can see their own payout details |
| Settlements table | `s.periodStart/periodEnd` (via `formatDateRange`), `.totalOrders`, `.cashOrders`/`.digitalOrders` (as "3C / 2D"), `.status`, `.paidAt`, `.partnerPayout ?? .totalAmount` | row click expands/collapses inline order detail, cached per settlement id (`ordersCache`) so re-expanding doesn't re-fetch |
| Expanded order detail | `o.completedAt`, `.orderId` (truncated), `.bookingType`, `.paymentMethod`/`.cashCollected`, `.partnerPayout ?? .amount`, plus a per-period total footer | |
| Admin notes section | `s.adminNote` (only rendered for settlements that have one) | |

## Mutations
None — this page is entirely read-only (settlement records are created/paid
by Lunara admin elsewhere, not from this page).

## Authorization
`GET /partner/settlements`, `/partner/settlements/:id/orders` are `@Roles(UserRole.PARTNER, UserRole.ADMIN)`, matching this page's `useRequirePartner()`. `GET /partner/ledger-balance` is narrower — `@Roles(UserRole.PARTNER)` only, excluding `ADMIN` — which this page calls unconditionally for any role it allows, including `ADMIN`. An admin viewing this page (e.g. for support/impersonation) would get a 403 on that one call specifically; since only `data` is destructured from that query's `usePartnerQuery` result (`page.tsx:76`, `error` and `loading` are discarded), the failure is completely silent and the "Outstanding balance" tile just shows `'—'`. This isn't flagged as a bug: `getLedgerBalance(req.user.sub)` looks up pending settlements by `partnerId`, and an admin's own `sub` was never going to match any real partner's settlements anyway — an admin genuinely has no "balance owed to them," so `'—'` is the correct thing to show, just arrived at via a swallowed error rather than an explicit role check. No other `[authz]` issues — `getSettlementOrders` correctly 404s (not 403) on a settlement id that doesn't belong to the caller, avoiding confirming other partners' settlement ids exist.

## Findings

1. **[FIXED] A previous fetch's error message could linger and render alongside a different, successfully-cached settlement's order table.** `toggleOrders` (pre-fix, `page.tsx:44-61`) only cleared `ordersError` *after* checking the cache (`if (ordersCache[s._id]) return;` came first) — so if settlement B's order fetch failed (setting `ordersError`), then the user collapsed B and re-expanded a *different*, already-cached settlement A, the early-return for A's cache hit skipped the `setOrdersError(null)` call entirely. Since the three render branches for the expanded row (`ordersError && <p>`, `orders?.length === 0 && <p>`, `orders && orders.length > 0 && <table>`) are independent conditionals rather than mutually exclusive, this meant A's correct order table rendered **with B's stale error message still shown above it** — a single shared `ordersError` string standing in for what should have been per-settlement state.
   **Fix:** moved `setOrdersError(null)` to run immediately when any row is expanded, before the cache-hit early return — `apps/partner-web/src/app/settlements/page.tsx:44-50`. A freshly-opened row (cached or not) now always starts with no stale error.

No other issues found — every mutation-free interaction (expand/collapse, CSV export, refresh) behaves correctly, and role scoping is correctly enforced server-side with no widenable request params.

## Unused/dead fields
`PartnerSettlement.paidBy` and `.createdAt` are returned by `formatSettlement`
but never read on this page — low impact (`paidBy` is an internal admin
user id referencing who processed the payout, not third-party PII;
`createdAt` is redundant with the already-displayed `periodStart`/`periodEnd`).
`.commissionRate` is also returned but not directly displayed (it factors
into the already-shown `lunaraFee`/`partnerPayout`, so the raw rate itself
just isn't surfaced) — not flagged as a bug, just noted.

## Loading/error/realtime behavior
All three top-level fetches (`settlements`, `ledger-balance`, `settings`) use
the shared `usePartnerQuery` hook (fixed for the "wipe on error" bug in
`docs/audits/partner-web/inventory.md` — this page benefits from that fix
too), though only the main `settlements` query's `loading`/`error` are
actually surfaced via `DataPageStatus`; the other two are used
data-only (see Authorization note above for why that's acceptable for
`ledger-balance`). No polling or realtime subscription — a manual "Refresh"
button is the only way to see newly-processed settlements, appropriate for a
weekly-cadence feature.
