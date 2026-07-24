# Audit: Partner-web — Scan tag

Date: 2026-07-23

## Entry point
- Page: `apps/partner-web/src/app/scan/page.tsx`
- Component(s): inline in the page file (camera capture + `jsQR` decode loop, no separate component)

## Sub-pages
None — no outbound navigation into a dynamic detail route. A successful scan
shows the result inline on this same page (customer name/phone, order short
code/status) rather than navigating anywhere.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Tag lookup | GET | `/laundry-tags/lookup?code=` | `TagLookupResult` (local interface) | `LaundryTagsController.lookup` -> `LaundryTagsService.lookup` |

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

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Camera preview | n/a (raw `getUserMedia` stream piped to a hidden `<video>`, decoded via an offscreen `<canvas>` + `jsQR` on every animation frame) | replaced by the result/error card once a code is decoded, not shown simultaneously |
| Lookup result card | `result.tag.code`, `result.order.shortCode`/`.status` (only if both `order` and `customer` are present), `result.customer.firstName`/`.lastName`/`.phone` (conditional) | falls back to "This tag isn't currently attached to any order" when `order`/`customer` are `null` — matches the two `null`-returning branches in the backend (`tag.currentOrderId` absent, or the linked `order` document missing) |
| Camera error card | `cameraError` (a single generic message covering any `getUserMedia` rejection reason — permission denied, no camera, insecure context, etc.) | |
| Lookup error card | `lookupError` (thrown `Error.message`, e.g. a `ForbiddenException`/`NotFoundException` message from the backend) | "Scan again" button resets and restarts the camera |

## Mutations
None — this page only performs a read (tag lookup), no create/update/delete actions.

## Authorization
`GET /laundry-tags/lookup` is reachable by every authenticated role (`@Roles(ADMIN, PARTNER, STAFF, RIDER, CUSTOMER)`), but access to the *data* is independently and correctly re-checked per role inside `assertLookupAccess` (see Backend trace) — a partner/staff account can only resolve tags attached to orders at their own branch(es), never another shop's. No request param exists to widen this (`code` only selects *which* tag, not whose data to return — the returned data is always gated by the order's actual ownership). No `[authz]` issues.

## Findings
No issues found. Camera lifecycle (start/stop/cleanup on unmount, restart on
"Scan again") is handled correctly — the `useEffect` that opens the camera
correctly stops all tracks on cleanup and doesn't leak a second stream when
`paused` toggles, and the `requestAnimationFrame` scan loop halts itself
(via `scanningRef`) the moment a code is decoded, before the lookup even
starts, so a continuous video feed can't fire multiple concurrent lookups
for the same scan. The result/error rendering correctly branches on the
exact two `null`-shapes the backend can return (no order, or order+customer
both present), with no unhandled partial-data case.

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
