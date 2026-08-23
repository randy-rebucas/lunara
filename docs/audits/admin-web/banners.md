# Audit: Admin-web — Banners

Date: 2026-08-23

## Entry point
- Page: `apps/admin-web/src/app/banners/page.tsx`
- Component(s): `apps/admin-web/src/components/datacenter/banners-board.tsx`

## Sub-pages
None — no outbound navigation into a detail route. All CRUD happens inline on
the single board (create form toggle, per-row actions).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List banners | GET | `/admin/banners` | `Banner[]` | `AdminBannersController.list` -> `BannersService.adminList` |
| Create banner | POST (multipart) | `/admin/banners` | — | `AdminBannersController.create` -> `BannersService.create` |
| Toggle active / reorder / edit | PATCH | `/admin/banners/:id` | — | `AdminBannersController.update` -> `BannersService.update` |
| Replace image | POST (multipart) | `/admin/banners/:id/image` | — | `AdminBannersController.updateImage` -> `BannersService.updateImage` |
| Delete banner | DELETE | `/admin/banners/:id` | — | `AdminBannersController.remove` -> `BannersService.remove` |
| (Public feed, other apps) | GET | `/banners` | — | `BannersController.listActive` -> `BannersService.listActive` |

## Backend trace
`adminList()` returns every `Banner` document sorted by `sortOrder` then
`createdAt` desc — full documents (including `createdAt`/`updatedAt`), fine
since it's admin-only. `create()` requires a file, uploads it to Cloudinary
(`lunara/banners` folder) and stores the `secure_url`; `sortOrder` defaults to
`0` if the caller doesn't send one (see Finding 1). `update()` does a partial
field patch. `updateImage()` uploads the new image, saves it, then
best-effort-deletes the old Cloudinary asset via `deleteFile` (which accepts
either a stored filename or a full URL — see `cloudinary-storage.service.ts:53`
— so passing `banner.imageUrl`, a full URL, works correctly). `remove()`
deletes the document then best-effort-deletes its Cloudinary asset the same
way. The public `listActive()` filters to `isActive: true` within the
`startsAt`/`endsAt` window and projects down to only `_id`/`title`/`imageUrl`/
`linkUrl` — correctly excludes `sortOrder`/timestamps/`isActive` from the
public payload.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Create banner form | `title`, image file, `linkUrl`, `startsAt`, `endsAt` | Client validates `title` `minLength={3}` matching `CreateBannerDto`'s `@MinLength(3)`; image file required client-side, matching the backend's `BadRequestException` if missing. `sortOrder` was not sent (Finding 1, fixed). |
| Sort-by control | Client-only `sortKey` (`order`/`title`/`status`/`startsAt`) via `sortBanners()` | Pure client-side re-sort of the already-fetched list; up/down reorder buttons only shown when `sortKey === 'order'`. |
| Banner row (per banner) | `imageUrl`, `title`, `formatValidity(startsAt, endsAt)`, `linkUrl` (conditionally), `isActive` (pill), `sortOrder` (for reorder buttons' disabled state) | `formatValidity` and the active/inactive pill color are both derived client-side; straightforward, no backend-defined color map to stay in sync with. |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Create banner | no | n/a | yes, `disabled={saving}` | yes |
| Replace image | no (overwrites the live image immediately) | no — not asked for, arguably fine since it's non-destructive to the record and instantly reversible by replacing again | yes, `actioningId` disables the row's buttons | yes |
| Toggle active/inactive | no | n/a | yes, `actioningId` | **fixed** — was silently swallowed, see Finding 2 |
| Move up/down (reorder) | no | n/a | yes, `actioningId` | **fixed** — was silently swallowed, see Finding 2 |
| Delete banner | yes | yes, `window.confirm` | yes, `actioningId` | **fixed** — was silently swallowed, see Finding 2 |

## Authorization
`AdminBannersController` is class-level `@Roles(UserRole.ADMIN)` behind
`JwtAuthGuard`+`RolesGuard` — matches the frontend (admin-only board, no
lower-privileged role reaches these routes). No role-scoped filter exists to
widen (banners are a single global list, not partitioned per branch/partner).
The separate public `BannersController.listActive` is intentionally open to
any authenticated role (customer/rider/partner apps) per its doc comment, and
its projection is already minimal (no `isActive`/`sortOrder`/timestamps sent).
No `[authz]` findings.

## Findings

1. **New banners always default to `sortOrder: 0`, landing them at the top of
   the manual order instead of the end.** `banners-board.tsx`'s `create()`
   never appended a `sortOrder` field to the upload `FormData`, so every new
   banner fell through to `CreateBannerDto`'s `dto.sortOrder ?? 0`
   (`banners.service.ts:39`). Since existing banners frequently share
   `sortOrder: 0` too (the code's own comment at `banners-board.tsx:142`
   acknowledges this), a newly created banner would land in an
   unpredictable position among other `0`-order banners rather than
   appending at the end, until an admin manually reordered it.
   **Fix:** `create()` now computes `nextSortOrder` as one past the current
   max `sortOrder` in the loaded list and sends it explicitly
   (`banners-board.tsx`, `create()`).

2. **Toggle active, reorder, and delete swallowed failures silently.**
   `toggleActive()`, `move()`, and `remove()` (pre-fix) wrapped their
   `adminFetch` calls in `try { ... } finally { setActioningId(null) }` with
   no `catch` — a failed request (network error, 404, validation error) threw
   an unhandled promise rejection instead of surfacing any message, the
   button silently re-enabled, and the board could be left showing a stale
   order/status with no indication anything went wrong. `move()` is
   especially risky here since it fires multiple parallel `PATCH` requests —
   a partial failure there leaves `sortOrder` values inconsistent with what's
   rendered, with no error to flag it. This is the same failure-visibility
   gap already documented and fixed on Promotions' toggle action
   (`docs/audits/admin-web/promotions.md`, Finding 2), so it's a recurring
   pattern rather than isolated to this board — worth checking on any other
   board audited before this convention was established.
   **Fix:** added `catch` blocks to `toggleActive()`, `move()`, and `remove()`
   that set `actionError`, and added a global `actionError` alert
   (`alert-error`, matching the Promotions/other boards' pattern) rendered
   above the list so these errors are now visible regardless of whether the
   create form is open (`banners-board.tsx`).

## Unused/dead fields
- `Banner.createdAt`/`updatedAt` are returned by `adminList()` but never read
  by the frontend `Banner` type — harmless (non-sensitive, admin-only) but
  dead weight.
- `UpdateBannerDto.imageUrl` (`banner.dto.ts:40-41`) is never sent by the
  frontend — the only way to change a banner's image is the dedicated
  `POST /:id/image` upload endpoint, which correctly cleans up the old
  Cloudinary asset. The DTO field is reachable directly via the API by any
  admin-authenticated caller and, if used, would silently orphan the
  previous Cloudinary asset (no delete happens in `update()`) — low risk
  since there's no UI path to it and the caller would already be an
  authenticated admin, but left as-is since removing/wiring it up would be a
  product decision outside this audit's scope (does the DTO field get
  removed, or does `update()` gain cleanup logic to match `updateImage()`?).

## Loading/error/realtime behavior
Standard `useAdminQuery` (`useAsyncQuery`) behavior: spinner while `data` is
`null`, a failed reload keeps previously loaded data on screen instead of
wiping it, and initial-load errors render inline. No realtime socket
subscription or polling — reasonable for a low-frequency marketing-config
page with no other actor pushing concurrent changes. Mutation-level error
visibility was the gap (Finding 2, now fixed).
