# Audit: Customer-mobile — Scan laundry tag

Date: 2026-07-24

## Entry point
- Screen: `apps/customer-mobile/app/scan-tag.tsx`
- Component(s): `src/components/qr-scanner.tsx` (`QrScanner`, shared camera/scan-handling component)

## Sub-pages
None — this is a single-purpose utility screen (scan -> alert -> back), reached from `/profile`'s "Scan my laundry tag" row.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Tag lookup | GET | `/laundry-tags/lookup?code=` | `TagLookupResult` (`tag`, `order`, `customer`) | `LaundryTagsController.lookup` -> `LaundryTagsService.lookup` |

## Backend trace
This endpoint is reachable by five roles (`ADMIN`/`PARTNER`/`STAFF`/`RIDER`/`CUSTOMER`) and its response shape includes another customer's `firstName`/`lastName`/`phone` when the tag resolves to an order — so this was worth tracing carefully for a potential PII-exposure gap. Confirmed it's correctly guarded: `assertLookupAccess` (`laundry-tags.service.ts:295-325`) throws `ForbiddenException` for a `CUSTOMER` actor unless `order.customerId === actor.sub` — this check runs **before** the customer/PII data is assembled and returned, so a customer scanning a tag attached to someone else's order gets a 403, never a payload containing that stranger's name/phone. The client's `if (!res.order)` "Not your laundry" branch is effectively unreachable for this specific misuse case (a mismatched-owner scan throws and is caught as an error by `QrScanner`, not returned as a successful `order: null` response) — it only fires for the genuinely rare case of an orphaned tag reference (`tag.currentOrderId` pointing at a deleted order). A tag with no `currentOrderId` at all is also rejected outright for `CUSTOMER`/`RIDER` roles rather than returning a null-order success response.

## Cards / panels
Not applicable — this screen has no persistent widgets, just a camera view + result `Alert.alert`.

## Mutations
None — this is a read-only lookup.

## Authorization
See Backend trace — server-side ownership enforcement is solid and independently verified, not merely mirrored by the client. No `[authz]` issues.

## Findings

1. **[FIXED] The "not your laundry" outcome permanently froze the scanner.** `QrScanner.handleScan` (`src/components/qr-scanner.tsx`) only reset `scannedRef.current` back to `false` inside its `catch` block. `scan-tag.tsx`'s `onScan` resolves *successfully* (no throw) for the `!res.order` case — it shows an `Alert.alert('Not your laundry', ...)` and simply `return`s, without calling `router.back()`. That left `scannedRef.current` stuck at `true` with no code path left to clear it, so the customer's next scan attempt on the same screen silently did nothing (`if (scannedRef.current || busy) return;` short-circuits before the camera callback even fires) — the only way to scan again was to cancel out and reopen the screen. Confirmed unreachable via the ownership-mismatch case specifically (that path throws server-side, per Backend trace above, so it hits the `catch` and re-arms correctly) but real for the orphaned-tag case that *does* legitimately return a null-order success response.
   **Fix:** moved `scannedRef.current = false` out of the `catch` block into the shared `finally`, so any non-navigating `onScan` outcome — success or failure — re-arms the scanner. Confirmed this component has exactly one consumer (`scan-tag.tsx`), so no other screen's behavior is affected.

## Unused/dead fields
`res.tag.status` is fetched and shown in the success alert but not otherwise used; `res.customer` is fetched but never rendered on this screen at all (only `res.order.shortCode`/`.status` are shown) — not flagged as a finding since it's the same field already confirmed non-sensitive-when-reached (only ever populated for the customer's own order, i.e. their own data) and simply not needed for this screen's narrow "which order is this?" purpose.

## Loading/error/realtime behavior
No loading/error state beyond what `QrScanner` already provides (camera permission gate, `busy` spinner during the lookup call, inline error text on failure). No polling or realtime subscription — appropriate for a one-shot scan-and-confirm utility.
