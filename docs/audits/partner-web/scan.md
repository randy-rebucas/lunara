# Audit: Partner-web — Scan tag

Date: 2026-08-31

## Entry point
- Page: `apps/partner-web/src/app/scan/page.tsx`
- Component(s): `AddToShelfPanel` (new since the last audit — lets a scanned
  tag/order be filed onto a physical shelf), camera capture + `jsQR` decode loop
  inline in the page file

## Sub-pages
None — no outbound navigation into a dynamic detail route. A successful scan
shows the result inline on this same page (customer name/phone, order short
code/status) rather than navigating anywhere. "Add to shelf" opens an inline
panel, not a route.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Tag lookup | GET | `/laundry-tags/lookup?code=` | `TagLookupResult` (local interface) | `LaundryTagsController.lookup` -> `LaundryTagsService.lookup` |
| List shelves (for the "Add to shelf" select) | GET | `/partner/shelves` | `PartnerShelf[]` | `PartnerController.listShelves` -> `ShelfService.listShelves` |
| Create shelf (if "+ New shelf…" chosen) | POST | `/partner/shelves` | `PartnerShelf` (`CreateShelfDto`) | `PartnerController.createShelf` -> `ShelfService.createShelf` |
| Add item to shelf | POST | `/partner/shelves/:shelfId/items` | `PartnerShelf` (`AddShelfItemDto`) | `PartnerController.addShelfItem` -> `ShelfService.addItem` |

Note: `/partner/shelves*` is a distinct feature from the shelf-*slot* lookup
already audited in [shelf-lookup.md](shelf-lookup.md) (`/partner/orders/shelf-lookup`,
which matches an order's `laundryProcessing.shelfSlot`) — this is a separate,
freeform "physical shelf with named items" storage system, not order-attached.

## Backend trace
`lookup` resolves the scanned QR payload to a canonical tag code
(`resolveTagCode`), finds the `Tag`, and — if it's currently attached to an
order — loads that order and calls `assertLookupAccess` **before** fetching
any customer PII. `assertLookupAccess` is a full per-role authorization
check, not just a route guard: `ADMIN` unrestricted, `PARTNER` must own the
order's branch (checked against `branchModel.find({ partnerUserId })`),
`STAFF` must be assigned to the order's exact branch (via
`resolvePortalBranchId`), `RIDER` must be the order's pickup or delivery
rider, `CUSTOMER` must be the order's own customer — every branch throws
`ForbiddenException` otherwise. Customer name/phone are only fetched *after*
this check passes, so a caller who fails the ownership check never triggers
the PII lookup at all. This endpoint is shared across every client app
(`@Roles(ADMIN, PARTNER, STAFF, RIDER, CUSTOMER)` — the full role list, not
partner-web-specific) since it also backs rider/customer scan features
elsewhere; partner-web's own client-side gate (`useProtectedPage({ roles:
[PARTNER, STAFF, ADMIN] })`) is a subset of what the backend allows, which is
correct — the frontend doesn't need to expose every backend-permitted role,
just the ones relevant to this app.

`ShelfService` (`listShelves`/`createShelf`/`addItem`) resolves accessible branch
ids per role the same way as elsewhere in this module — `STAFF` -> their one
resolved branch, `PARTNER` -> every branch they own, `ADMIN` -> every
`partner_shop` branch platform-wide — and `addItem`/`assertShelfAccess`
independently re-verifies the target shelf's `branchId` is in that set before
allowing a write, so a partner/staff account can't add items to another shop's
shelf by guessing its `_id`. `createShelf` case-insensitively checks for a
duplicate name within the target branch (`.collation({ locale: 'en', strength: 2
})`) before creating, avoiding accidental near-duplicate shelves like "Rack A"
vs "rack a".

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Camera preview | n/a (raw `getUserMedia` stream piped to a hidden `<video>`, decoded via an offscreen `<canvas>` + `jsQR` on every animation frame) | replaced by the result/error card once a code is decoded, not shown simultaneously |
| Lookup result card | `result.tag.code`, `result.order.shortCode`/`.status` (only if both `order` and `customer` are present), `result.customer.firstName`/`.lastName`/`.phone` (conditional) | falls back to "This tag isn't currently attached to any order" when `order`/`customer` are `null` — matches the two `null`-returning branches in the backend (`tag.currentOrderId` absent, or the linked `order` document missing) |
| Camera error card | `cameraError` (a single generic message covering any `getUserMedia` rejection reason — permission denied, no camera, insecure context, etc.) | |
| Lookup error card | `lookupError` (thrown `Error.message`, e.g. a `ForbiddenException`/`NotFoundException` message from the backend) | "Scan again" button resets and restarts the camera |
| Add-to-shelf panel | `shelves[].name`/`._id` (select options), local `itemName`/`note`/`newShelfName` form state, prefilled `itemName` from `result.order?.bookingType` and `note` from the tag code + order short code | shown for both branches of a lookup result (order+customer found, or tag unattached) — an unattached tag can still be filed onto a shelf, which is correct: shelf items aren't required to be order-linked |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Add scanned tag/order to a shelf (creating a new shelf if needed) | no | n/a | yes — `disabled={saving \|\| !itemName.trim()}` | yes — `saveError`/`shelvesError` rendered inline in the panel |

Tag lookup itself remains read-only (no create/update/delete on the tag/order).

## Authorization
`GET /laundry-tags/lookup` is reachable by every authenticated role (`@Roles(ADMIN, PARTNER, STAFF, RIDER, CUSTOMER)`), but access to the *data* is independently and correctly re-checked per role inside `assertLookupAccess` (see Backend trace) — a partner/staff account can only resolve tags attached to orders at their own branch(es), never another shop's. No request param exists to widen this (`code` only selects *which* tag, not whose data to return — the returned data is always gated by the order's actual ownership). `/partner/shelves*` is `@Roles(PARTNER, STAFF, ADMIN)`, matching this page's own gate, with branch ownership re-verified server-side per the Backend trace above. No `[authz]` issues.

## Findings
No issues found. Camera lifecycle (start/stop/cleanup on unmount, restart on
"Scan again") is handled correctly — the `useEffect` that opens the camera
correctly stops all tracks on cleanup and doesn't leak a second stream when
`paused` toggles, and the `requestAnimationFrame` scan loop halts itself
(via `scanningRef`) the moment a code is decoded, before the lookup even
starts, so a continuous video feed can't fire multiple concurrent lookups
for the same scan. The result/error rendering correctly branches on the
exact two `null`-shapes the backend can return (no order, or order+customer
both present), with no unhandled partial-data case. The new "Add to shelf"
panel correctly re-fetches shelves fresh each time it opens (`useEffect` with
no deps, scoped to the panel's own mount) rather than relying on possibly-stale
data, and its create-shelf-then-add-item flow is a straightforward two-step
sequence with no race condition (the second call always awaits the first's
returned `_id`).

## Unused/dead fields
`result.order.branchId` is returned by the backend but never read on this
page. Low impact — it's an internal id, not sensitive beyond what the order
status itself already implies, and the same `TagLookupResult`-shaped
response is likely consumed with more fields by other scan UIs elsewhere in
the codebase (this is a shared lookup endpoint, not partner-web-specific)
that may use it — not flagged as a bug, just noted.

## Loading/error/realtime behavior
No `usePartnerQuery`/list-style loading here — the only async operations are
camera acquisition (`cameraError` on failure) and the single lookup call per
scan (`loading` while in flight, `lookupError` on failure, both mutually
exclusive with the result card). No polling or realtime subscription;
scanning is entirely driven by the local `requestAnimationFrame` loop against
the live camera feed, not a server push.
