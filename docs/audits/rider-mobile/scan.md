# Audit: Rider-mobile — Scan (QR/tag handoff verification)

Date: 2026-07-24

## Entry point
- Page: `apps/rider-mobile/app/scan.tsx`
- Component(s): `src/components/qr-scanner.tsx` (camera UI, not traced in depth here — a presentational scanner component).

## Sub-pages
None — this is a modal-style utility screen reached via `router.push({pathname:'/scan', params:{orderId, mode}})` from five call sites already covered in other audits: `pickup/[id].tsx` (customer verify, laundry tag assign, order handover — see [home.md](home.md)), `delivery/[id].tsx` (customer delivery verify — [home.md](home.md)), and `(tabs)/tasks.tsx` ("Scan tag" header button, `mode=lookup_tag` — [tasks.md](tasks.md)). Not re-traced from those call sites; audited here as the shared scan-handling logic itself.

## Data flow

| Mode | Method | Path | Notes |
|---|---|---|---|
| `lookup_tag` | GET | `/laundry-tags/lookup?code=...` | `LaundryTagsController.lookup` → `LaundryTagsService.lookup` |
| `assign_laundry_tag` | POST | `/riders/pickup-tasks/:orderId/assign-tag` | |
| `customer_pickup` | POST | `/riders/pickup-tasks/:orderId/verify` | body `{qrPayload}` — same endpoint the pickup screen's manual-code path uses with `{code}` instead |
| `order_handover` | POST | `/riders/pickup-tasks/:orderId/drop-at-shop` | body `{qrPayload}` — same endpoint the pickup screen's "Deliver without scan" button calls with no body at all |
| `customer_delivery` | POST | `/riders/delivery-tasks/:orderId/verify-customer-qr` | |

## Backend trace
- **`verifyCustomer`** (`pickup.service.ts:220-239`) and **`dropAtShop`** (`pickup.service.ts:368+`) both correctly support *either* a scanned QR payload or a manually-entered value via `HandoffQrService.resolvePickupVerificationCode({code?, qrPayload?}, orderId)` (`handoff-qr.service.ts:35-46`) — it prefers `code` if present, else parses and validates `qrPayload` (checking the QR's kind matches `customer_pickup` and its embedded `orderId` matches the order being acted on, rejecting a QR scanned for a different order). `dropAtShop` treats `qrPayload` as fully optional, matching the pickup screen's "Deliver without scan" fallback path exactly — verified both call sites (scan-based and manual) hit the same validated logic, no divergent behavior between them.
- **`lookup_tag`** (`LaundryTagsService.lookup`, `laundry-tags.service.ts:257-293`) is the most sensitive path here since it's reachable by `CUSTOMER`/`RIDER`/`STAFF`/`PARTNER`/`ADMIN` alike (`laundry-tags.controller.ts:34`) and returns customer name + phone. Role-scoping is enforced by `assertLookupAccess` (`laundry-tags.service.ts:295-325`): a rider is only allowed through if `order.pickupRiderId` or `order.deliveryRiderId` matches their own id (`312-317`) — a rider cannot look up a tag attached to an order they aren't assigned to and see another customer's name/phone. Verified this scoping is airtight for all five roles (each has its own branch, falling through to a final `ForbiddenException` for anything unmatched). No `[authz]` finding.

## Cards / panels
Not applicable — this screen delegates all UI to `QrScanner`, passing only `title`/`hint`/`onScan`/`onCancel`. The five mode-specific hint strings (`scan.tsx:48-54`) are hardcoded copy, reasonable for a fixed, small set of scan purposes.

## Mutations

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Any scan-triggered mutation | no (each is a workflow-forward step already gated by the underlying order's state machine — e.g. `dropAtShop` requires a receipt code to already exist) | no explicit confirmation dialog before firing on a successful scan — the scan *is* the confirming action | yes — `QrScanner` (`src/components/qr-scanner.tsx:14-39`) guards against duplicate/concurrent scans itself: a `scannedRef` ref is set synchronously on the first decoded frame (before the `await onScan(payload)` call), and further frames are ignored while `scannedRef.current` or `busy` is true. The lock is only released (`scannedRef.current = false`) if `onScan` throws, allowing a genuine retry after a failure — a successful scan keeps the lock held (screen navigates away via `router.back()` in `scan.tsx`, so there's nothing left to re-trigger). This screen (`scan.tsx`) correctly relies on that shared guard rather than duplicating it. | yes — `QrScanner` catches whatever `onScan` throws and renders it via a local `error` state (not shown in the excerpt read, but the catch block sets `setError(...)`), so a validation failure (e.g. a QR scanned for the wrong order) surfaces to the rider without crashing or silently failing. |

## Authorization
Traced above — `lookup_tag` correctly scoped per-role; the four `/riders/*` mutation endpoints are already covered under their respective task screens' audits ([home.md](home.md)) and correctly scoped via `getActivePickupOrder`/`getOrderForRider`-style checks. No new `[authz]` findings from this screen's own code.

## Findings
No issues found. `scan.tsx` correctly delegates scan-debouncing to `QrScanner`'s own `scannedRef`/`busy` guard rather than needing its own, and every mode's backend endpoint was already verified (via the pickup/delivery/tasks audits and the `lookup_tag` role-scoping trace above) to be either idempotent or protected by the underlying order/tag state machine against a genuine retry.

## Unused/dead fields
Not applicable — no list-shaped payload to check for unused fields; the `TagLookupResult` interface's fields (`tag`, `order`, `customer`) are all read in the `lookup_tag` branch's alert-building logic.

## Loading/error/realtime behavior
No independent loading state in this file — delegated entirely to `QrScanner`, which tracks its own `busy`/`error` state and keeps the camera view mounted (no forced navigation) on a thrown error, so a failed scan naturally allows the rider to try again without leaving the screen. Each mode's `handleScan` is a single `await` + `Alert.alert` + `router.back()` sequence on success — no realtime concerns, appropriate for a one-shot verification action.
