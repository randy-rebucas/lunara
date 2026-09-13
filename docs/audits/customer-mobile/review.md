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

1. **[FIXED] A failure in the best-effort "mark related notification as read" side effect incorrectly surfaced as "Could not load review" inside the rating form, even when the review itself had loaded successfully.** `load()`'s single `try/catch` wrapped both the primary `GET /reviews/orders/:id` call and the follow-up `GET /notifications/me` + `PATCH /notifications/:id/read` calls. `DataLoadState`'s full-screen error is correctly gated on `!status`, so a failure here didn't trigger the wrong full-screen state — but the form's own inline `error` block (line ~188) renders `error` unconditionally, so a customer whose review loaded fine but whose background notification-read call hiccuped would see a misleading "Could not load review" message sitting in the middle of an otherwise-working rating form.
   **Fix:** split `load()` into two sequential `try/catch` blocks — the primary review-status fetch still sets `error` and returns early on failure (preserving the full-screen retry path), while the notification mark-read call now has its own `try/catch` that silently ignores failures, since it's a non-critical side effect and its outcome is invisible to the user either way.

Previously (2026-07-24 pass): the shared `error` state between the initial load and the submit action was checked and found correctly isolated — `DataLoadState`'s error display is gated on `!status`, so a submit failure surfaces only in the form's own inline error block rather than being swallowed or incorrectly triggering the full-screen error/retry view. That finding still holds; the notification-side-effect coupling above was a separate, previously-missed gap in the same function.

## Unused/dead fields
None found.

## Loading/error/realtime behavior
Single load with retry via `DataLoadState`. No polling or realtime subscription — matches the equivalent web page's behavior exactly.
