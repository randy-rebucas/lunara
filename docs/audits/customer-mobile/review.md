# Audit: Customer-mobile — Review

Date: 2026-07-24

## Entry point
- Screen: `apps/customer-mobile/app/review/[id].tsx`
- Component(s): `Card`, `Input`, `Button`, `DataLoadState`

## Sub-pages
None.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Review status | GET | `/reviews/orders/:id` | `ReviewStatus` | already traced in `docs/audits/customer-web/orders.md` |
| Notifications (mark related as read) | GET/PATCH | `/notifications/me?limit=20`, `/notifications/:id/read` | — | already traced in `docs/audits/customer-web/notifications.md`; same "mark the order-related unread notification as read on load" side effect as the web review page |
| Submit review | POST | `/reviews` | `{ review }` | already traced |

## Backend trace
Same already-audited, correctly-scoped endpoints. Nothing new server-side.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Star rating | `rating` (interactive only while `showForm`), `RATING_LABELS` (static) | |
| Comment field (optional, form state only) | `comment` | |
| Published state | `published.comment` | |
| Locked state | `status.orderStatus` implied via `canReview`/`review` flags (not directly rendered as text, unlike the web equivalent which shows the literal order status) | minor cosmetic difference from web, not a functional gap |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Submit review | no | n/a | yes (`disabled={submitting \|\| rating < 1}`) | yes (`error`, rendered inline in the form — correctly distinct from the initial-load error since `DataLoadState`'s `error` prop is gated on `!status`, so a submit failure after a successful load doesn't get swallowed or misrouted) |

## Authorization
Same already-confirmed scoping (`/reviews/orders/:id`, `/reviews` both scoped to the caller server-side). No `[authz]` issues.

## Findings
No issues found. The shared `error` state between the initial load and the submit action is handled correctly — `DataLoadState`'s error display is gated on `!status`, so a submit failure surfaces only in the form's own inline error block rather than being swallowed or incorrectly triggering the full-screen error/retry view.

## Unused/dead fields
None found.

## Loading/error/realtime behavior
Single load with retry via `DataLoadState`. No polling or realtime subscription — matches the equivalent web page's behavior exactly.
