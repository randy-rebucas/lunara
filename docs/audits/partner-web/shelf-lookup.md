# Audit: Partner-web — Find on shelf

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/shelf-lookup/page.tsx`
- Component(s): inline in the page file, no separate component

## Sub-pages
| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/page.tsx` | "Open order →" link, `page.tsx:89-94` | `result.orderId` -> `id` route param | yes |

Same large, independent order-processing feature already flagged as
out-of-scope for a full trace in `docs/audits/partner-web/customers.md`,
`messages.md`, and `orders-queue.md` — not re-traced here. Notably, that
page's own shelf-slot *assignment* input (`orders/[id]/page.tsx:488`) is
where the case-sensitivity mismatch fixed in Finding #1 originates — see
below.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Shelf/tag lookup | GET | `/partner/orders/shelf-lookup?query=` | `PartnerShelfLookupResult \| null` | `PartnerController.findOnShelf` -> `ProcessingService.findOnShelf` |

## Backend trace
`findOnShelf` first tries to resolve `query` as a tag code via
`LaundryTagsService.findByCode` (which normalizes case/whitespace through
`resolveTagCode`/`normalizeTagCode` — `packages/utils/src/qr-tag.ts`), and if
that tag is currently attached to an order, matches by that order's `_id`
directly. Otherwise it falls back to matching `laundryProcessing.shelfSlot`
— see Finding #1 for what was wrong with that fallback. Role scoping matches
the pattern already verified correct in `docs/audits/partner-web/scan.md`'s
sibling tag-lookup feature: `PARTNER` -> own `partnerId`, `STAFF` -> their
resolved branch (`resolvePortalBranchId`/`applyStaffBranchFilter`), `ADMIN`
-> unscoped. Customer identity is resolved via the `customerModel`
(`userId`-keyed `firstName`/`lastName`) plus a separate `phone` lookup on
`User` — the *correct* two-collection pattern (unlike the bug already found
and fixed in `docs/audits/partner-web/customers.md`, which had looked up
name fields on the wrong collection). A sparse partial index backs the
`shelfSlot` fallback query specifically to avoid a full collection scan
(`order.schema.ts:465-471`, with a code comment referencing this exact
method) — see Finding #1's Fix note for how the case-insensitivity change
interacts with that index.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Search input + Find button | local `query` state; Enter key or button click both trigger `search()` | input has a CSS-only `uppercase` text-transform (visual display only, doesn't change the submitted value) — see Finding #1 |
| Result card | `result.customerName` (fallback `'Customer'`), `.customerPhone` (conditional), `.shelfSlot` (conditional badge), `.currentStepLabel ?? .status` (badge), link to the order | |
| Empty-result card | n/a | shown when `searched && !error && !result` — i.e. a successful lookup that found nothing |

## Mutations
None — this page only performs a read (shelf/tag lookup), no create/update/delete actions.

## Authorization
`GET /partner/orders/shelf-lookup` is `@Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)`, matching the frontend's `useProtectedPage({ roles: [PARTNER, STAFF, ADMIN] })` exactly. Role-scoped filters (`partnerId`/branch) are derived entirely server-side from `req.user` — the `query` param only selects *which* shelf slot/tag to search for, never whose orders to search across. No `[authz]` issues.

## Findings

1. **[FIXED] Shelf-slot lookup was case-sensitive, but nothing in the product ever normalizes case — a real, silent "not found" trap.** Neither the shelf-slot *assignment* input (`orders/[id]/page.tsx:488`, a plain text field saved with only `.trim()`, no case transform) nor this lookup page's search input (`page.tsx:49-58`, likewise only `query.trim()` sent to the backend) normalize case, yet `findOnShelf`'s fallback filter (pre-fix, `processing.service.ts:358-360`) was an *exact* string match on `laundryProcessing.shelfSlot`. Worse, this lookup page's search input has a CSS-only `uppercase` class (`page.tsx:51`) — it visually displays whatever the user types as uppercase, actively suggesting the search is case-normalized when the actual submitted `query` value retains whatever case was typed. A shelf slot assigned as `"a-12"` by one staff member and searched as `"A-12"` (or vice versa) by another would silently return "No order found" despite the order existing exactly where expected — a real, reachable failure mode for a tool whose entire purpose is fast physical-shelf lookup during a live handoff.
   **Fix:** the shelf-slot fallback match is now a case-insensitive anchored regex (`new RegExp(`^${escaped}$`, 'i')`, with the query string regex-escaped first, mirroring the same escaping fix applied to the audit-log search in the admin-web audits) instead of an exact string match — `apps/api/src/modules/partner/processing.service.ts:353-363`. Tag-code lookups are unaffected (already case-normalized via `resolveTagCode`). **Performance note:** the sparse partial index on `shelfSlot` (`order.schema.ts:468-471`, added specifically for this method per its own comment) can't be used for an index *seek* by a case-insensitive regex the way it could for an exact match — MongoDB would scan the index's entries rather than seek directly to one. Since the index is already sparse (only orders that currently have a shelf slot assigned — a small, actively-processing subset, not the whole `orders` collection), this is an acceptable, deliberate trade-off for correctness over a marginal, bounded performance cost, not a full-collection-scan regression of the kind the index was originally added to prevent.
   - Typechecked `apps/api` clean. Regression-checked: `findOnShelf` has exactly one caller (`PartnerController.findOnShelf`), so this fix has no other consumers to verify.

No other issues found — every field `PartnerShelfLookupResult` declares is
both returned and rendered, and the customer-identity lookup correctly uses
the same two-collection pattern already fixed elsewhere in this app.

## Unused/dead fields
None — every field the endpoint returns is rendered on this page.

## Loading/error/realtime behavior
No `usePartnerQuery`/list-style loading — a single one-shot lookup per
search, with `loading`/`error`/`searched` all managed locally. A failed
request shows an error message; a successful-but-empty result shows a
dedicated "No order found" card distinct from the error state. No polling or
realtime subscription — appropriate for an on-demand physical-lookup tool.
