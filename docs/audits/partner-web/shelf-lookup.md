# Audit: Partner-web — Find on shelf

Date: 2026-08-31

**This page was rebuilt since the last audit (2026-07-23) — it now backs a completely
different feature.** The old page searched by order/tag shelf-*slot* assignment
(`/partner/orders/shelf-lookup`) and linked out to `orders/[id]`. The current page
manages **physical shelves with freeform named items** (`/partner/shelves*`) — create
a shelf, add/remove named items on it, and search across all your shelves by item
name. It's the same backend feature already reached from `scan/page.tsx`'s "Add to
shelf" panel (see [scan.md](scan.md)); this page is the standalone management UI for
it (create/delete shelves, remove items) that the scan panel doesn't expose. The
previous order-shelfSlot lookup feature this page used to host appears to have been
retired — no other partner-web page was found calling
`/partner/orders/shelf-lookup`.

## Entry point
- Page: `apps/partner-web/src/app/shelf-lookup/page.tsx`
- Component(s): inline in the page file, no separate component

## Sub-pages
None — no outbound navigation into a detail route. Everything (search, shelf list,
per-shelf item add/remove) is inline on this one page.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Search items across shelves | GET | `/partner/shelves/search?query=` | `PartnerShelfItemSearchResult[]` | `PartnerController.searchShelfItems` -> `ShelfService.searchItems` |
| List shelves | GET | `/partner/shelves` | `PartnerShelf[]` | `PartnerController.listShelves` -> `ShelfService.listShelves` |
| Create shelf | POST | `/partner/shelves` | — | `PartnerController.createShelf` -> `ShelfService.createShelf` |
| Delete shelf | DELETE | `/partner/shelves/:shelfId` | `{ _id: string }` | `PartnerController.deleteShelf` -> `ShelfService.deleteShelf` |
| Add item to shelf | POST | `/partner/shelves/:shelfId/items` | `PartnerShelf` | `PartnerController.addShelfItem` -> `ShelfService.addItem` |
| Remove item from shelf | DELETE | `/partner/shelves/:shelfId/items/:itemId` | `PartnerShelf` | `PartnerController.removeShelfItem` -> `ShelfService.removeItem` |

## Backend trace
`ShelfService` resolves accessible branches per role the same way as the rest of this
module (`STAFF` -> their one branch, `PARTNER` -> every branch they own, `ADMIN` ->
every `partner_shop` branch), and every mutating call independently re-verifies the
target shelf's `branchId` is in that set (`assertShelfAccess`) before allowing a
write — a partner/staff account can't read, edit, or delete another shop's shelf by
guessing its `_id`. `createShelf` case-insensitively rejects a duplicate name within
the same branch. `searchItems` escapes the query before building a `RegExp` (`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`), so user input can't inject regex
metacharacters — safe against both a broken match and any ReDoS-shaped pattern.
`removeItem` throws `NotFoundException` if the given `itemId` doesn't match any item on
the shelf (filter length unchanged after removal), rather than silently no-op'ing.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Search box + results list | `r.name`, `.note`, `.quantity`, `.shelfName` | client only filters on Enter/button click, not live-as-you-type; empty-query search is a no-op (`setResults(null)`), matching the backend's own early-return for an empty/whitespace query |
| New-shelf input | local `newShelfName` | Enter key submits, same as the search box |
| Shelf card (per shelf) | `shelf.name`, `shelf.items[].name/.quantity/.note/._id` | "Delete shelf" removes the whole shelf and everything on it |
| Add-item row (per shelf) | local per-shelf draft (`name`/`quantity`/`note`), keyed by `shelf._id` in `itemDrafts` | Enter key on name/note submits, matching the search/create inputs' behavior |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Create shelf | no | n/a | yes — `disabled={creatingShelf \|\| !newShelfName.trim()}` | yes — `createError` |
| Add item to shelf | no | n/a | yes — `disabled={savingItem === shelf._id \|\| !draft.name.trim()}` | **was no (before fix)** — see Findings #1 |
| Remove item from shelf | no (single item) | no (low-impact, single-item undo-by-re-add) | no busy-state guard, but idempotent (a repeat click 404s harmlessly once the item's gone) | **was no (before fix)** — see Findings #1 |
| Delete shelf | **yes** — removes the shelf and every item on it | **was no (before fix)** — see Findings #1 | no busy-state guard (single click fires the DELETE immediately) | **was no (before fix)** — see Findings #1 |

## Authorization
All six `/partner/shelves*` endpoints are `@Roles(PARTNER, STAFF, ADMIN)`, matching
this page's `useProtectedPage` gate. Branch ownership is independently re-verified
server-side on every read/write (see Backend trace) — no request param can widen
access past the caller's own accessible branches. No `[authz]` issues.

## Findings

1. **Deleting a shelf had no confirmation, and none of the three write actions
   (add item, remove item, delete shelf) surfaced a failure to the user.**
   `deleteShelf`/`removeItem` (pre-fix, `page.tsx:78-81,112-115`) called their DELETE
   endpoints with no `try`/`catch` at all — a failed request became an unhandled
   promise rejection with zero UI feedback (the button just appeared to do nothing).
   `addItem` (pre-fix) had a `try`/`finally` but no `catch`, so a failed POST also
   silently vanished rather than showing an error. Separately, "Delete shelf"
   (pre-fix) fired its DELETE on a single click with no confirmation step at
   all — unlike every other destructive action already audited in this app
   (inventory's item delete, services' custom-service/add-on delete), which all use
   a `window.confirm` prompt. A misclick here would silently wipe an entire shelf's
   contents with no undo and no visible acknowledgment that anything happened.
   **Fix:** added a `window.confirm('Delete shelf "..." and everything on it? This
   cannot be undone.')` guard before `deleteShelf`'s request, and a shared
   `shelfActionError` state (rendered via the existing `alert-error` convention used
   elsewhere on this page for `createError`) that `addItem`/`removeItem`/`deleteShelf`
   all now set in a `catch` block on failure —
   `apps/partner-web/src/app/shelf-lookup/page.tsx`. Typechecked `apps/partner-web`
   clean.

## Unused/dead fields
None — every field on `PartnerShelf`/`PartnerShelfItemSearchResult` is rendered.

## Loading/error/realtime behavior
Shelves list uses the shared `usePartnerQuery` hook (loading/error via
`DataPageStatus`, previous data preserved on a failed reload). Search is a one-shot
manual fetch (`searching`/`searchError` local state), not tied to `usePartnerQuery`,
appropriate since it's user-triggered rather than list-on-mount. No polling or
realtime subscription — reasonable for a manually-curated shelf inventory that only
changes through this page's own actions.
