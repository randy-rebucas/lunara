# Audit: Customer-mobile — Support (list + detail)

Date: 2026-07-24

## Entry point
- Screen: `apps/customer-mobile/app/support/index.tsx`
- Component(s): `Card`, `DataLoadState`

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `support/[id].tsx` | ticket row tap | `t._id` -> `id` route param | yes |

`support/[id].tsx` is a read-only ticket detail/timeline view (lost-item investigation stepper, outcome/compensation, updates timeline) — no mutations, covered in full here. Ticket *creation* happens via `orders/[id]/lost-item.tsx` (already audited in `docs/audits/customer-mobile/order-detail.md`) — this list has no create affordance of its own, unlike the equivalent customer-web `/support` page which has an inline multi-mode create section.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List tickets | GET | `/support/tickets` | `Ticket[]` | already traced in `docs/audits/customer-web/support.md` |
| Ticket detail | GET | `/support/tickets/:id` | `{ ticket, investigation }` | same |

## Backend trace
Same already-traced, correctly-scoped endpoints (`listCustomerTickets`/`getCustomerTicket`, both filtered/verified by `customerId`). Nothing new server-side.

## Cards / panels

**List:**
| Card | Fields consumed | Notes |
|---|---|---|
| Ticket row | `subject`, `type` (icon via `ticketIcon`), `status` (open/resolved pill via `RESOLVED_STATUSES`) | `RESOLVED_STATUSES = {'resolved', 'closed'}` correctly covers both terminal values of the real `TicketStatus` enum (`open`/`in_progress`/`resolved`/`closed` — only 4 values, unlike refunds' 7-value enum where the equivalent set was missing one), confirmed no gap here |
| Empty state | none | |

**Detail:**
| Card | Fields consumed | Notes |
|---|---|---|
| Status pill | `status` | |
| Lost-item investigation stepper (only for `type === 'lost_item'`) | `LOST_ITEM_FLOW` + `currentStage`/`status` | |
| Outcome card | `outcome`, `compensationAmount`, `compensationCreditedAt` | |
| Report card | `description`, `missingItems` | |
| Updates timeline | `timeline[]` | |
| Footer actions | static links to `/support` and (if `orderId`) `/orders/:orderId` | |

## Mutations
None on either screen — both read-only.

## Authorization
Same already-confirmed scoping. No `[authz]` issues.

## Findings

1. **[FIXED] A failed pull-to-refresh on the list screen hid the previously-loaded tickets, not just a banner.** Same cross-cutting pattern as `docs/audits/customer-mobile/subscriptions.md` Finding #3 — the render gate was `!loading && !error`, so a refresh failure after a successful initial load unmounted the whole ticket list in favor of the error banner alone. Missed in the original 2026-07-24 pass, which only checked mutations and data-shape correctness, not this render-gate family of bug found across several sibling screens in a later pass.
   **Fix:** added a `loaded` flag set after the first successful `GET /support/tickets`, changed the gate to `!loading && (loaded || !error)` — the list now survives a later failed refresh, with the error banner shown above it.

## Unused/dead fields
None found.

## Loading/error/realtime behavior
List uses `DataLoadState` with retry + pull-to-refresh. Detail uses `DataLoadState` for its single load with retry. No polling or realtime subscription on either screen. See Finding #1 for the failed-refresh content-hiding fix on the list screen.
