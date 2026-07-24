# Audit: Admin-web — Laundry tags

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/laundry-tags/page.tsx`
- Component(s): `apps/admin-web/src/components/datacenter/laundry-tags-board.tsx` (client component, `LaundryTagsBoard`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List (paged loop) | GET | `/laundry-tags?limit=200&page=N` | `{ items: LaundryTag[]; total: number }` | `LaundryTagsController.listTags` -> `LaundryTagsService.listTags` |
| Generate batch | POST | `/laundry-tags/batches` | `{ batchId: string; tags: LaundryTag[] }` | `LaundryTagsController.generateBatch` -> `LaundryTagsService.generateBatch` |
| Retire | POST | `/laundry-tags/:id/retire` | (unused response) | `LaundryTagsController.retire` -> `LaundryTagsService.retire` |
| Reactivate | POST | `/laundry-tags/:id/reactivate` | (unused response) | `LaundryTagsController.reactivate` -> `LaundryTagsService.reactivate` |
| Realtime | socket | `onLaundryTagsUpdated` | n/a | `TrackingGateway.emitLaundryTagsUpdated` (emitted from generate/assign/release/retire/reactivate) |

## Backend trace
`listTags` builds a Mongo filter from `status`/`batchId`/`branchId` and role-scopes it (staff locked to their branch, partner limited to owned branches, admin unrestricted), then runs a paginated `find` + `countDocuments` in parallel. `QueryTagsDto` (`apps/api/src/modules/laundry-tags/dto/query-tags.dto.ts`) supports `status`, `branchId`, `batchId`, `page`, and `limit` (capped at 200) — all server-side filtering the frontend never uses. `generateBatch` finds the highest existing code in the prefix's range, increments, bulk-inserts, and retries up to 5 times on a duplicate-key race. `retire`/`reactivate` load-mutate-save a single document and emit a socket event.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Stat tiles (Available / Assigned / Retired) | `status` (client-counted across the full in-memory `tags` array) | Counts are computed client-side over the entire fetched collection instead of using server `countDocuments` per status; tile click sets `statusFilter`, which only filters the already-loaded, already-fetched-in-full list. |
| List controls (search/limit/status filter) | `code`, `batchId` (search), `status` (filter), `limit` (client slice) | All filtering/searching/limiting happens client-side over the fully-loaded array (`filterBySearch`, `.slice(0, limit)`); none of it is sent to the server despite the backend supporting `status`/`batchId`/`limit`/`page` query params. |
| Tag pool table | `code`, `status`, `batchId` (sliced to 8 chars), `createdAt` (formatted `toLocaleDateString`), per-row actions | Status color mapping is a client `if/else` chain (`badge-accent` for available, `badge-neutral` for both assigned and retired) — visually indistinguishable between assigned and retired in the table (only row opacity differs for retired). |
| QR preview modal | `tag.code`, `tag.status` | Status badge again only distinguishes "available" vs. everything else. |
| Generate batch form | `quantity`, `codePrefix` | Client-only validation (`min=1 max=500` on the input) — not enforced by `CreateTagBatchDto` in the trace read here beyond `quantity`/`codePrefix`; server relies on Mongoose bulk insert. |
| Generated batch print grid | `batchId.length`, `t.code` | Straightforward, no derived logic beyond QR payload building. |

## Findings

1. **Full-collection fetch defeats server-side pagination/filtering.** `load()` in `laundry-tags-board.tsx:126-137` loops over `/laundry-tags?limit=200&page=N` until it has fetched every tag in the system, then all status filtering, search, and the visible `limit` are applied client-side (`laundry-tags-board.tsx:153-167`). The backend already supports `status`, `batchId`, `branchId`, `page`, and `limit` query params (`query-tags.dto.ts`) built for exactly this — none are sent. For a tenant with thousands of tags (a real possibility since tags are meant to be a reusable, ever-growing pool), this means every page load and every realtime update (`onLaundryTagsUpdated` at `laundry-tags-board.tsx:143-145`) re-downloads the entire tag table, even though the user is only looking at a filtered slice.
2. **Realtime updates trigger a full re-fetch-everything, not a scoped refresh.** `useAdminOperationsSocket({ onLaundryTagsUpdated: () => void reload() })` (`laundry-tags-board.tsx:142-146`) re-runs the same full-pagination `load()` on every single tag event (generated, assigned, released, retired, reactivated) — which fire on every order pickup/delivery across the whole system. Combined with finding 1, this is a full-collection re-fetch potentially several times a minute.
3. **Assigned vs. retired tags are visually identical in the table.** `laundry-tags-board.tsx:326-337` maps `status === 'available'` to `badge-accent` and everything else (`assigned` and `retired`) to `badge-neutral`, so the only visual difference between an assigned and a retired tag in the list is row opacity (`className={t.status === 'retired' ? 'opacity-75' : ''}` at line 324). An admin scanning the table for retired tags has to read the text label, not the badge color.

## Unused/dead fields
- `LaundryTag.currentOrderId` — returned by the backend, present on the frontend `LaundryTag` type, but never read/displayed anywhere in the board (no "assigned to order X" link/column).
- `branchId`, `generatedBy`, `assignmentHistory`, `retiredAt`/`retiredBy`/`retiredReason`, `updatedAt` — all present on the Mongoose schema and returned in list/detail responses, but absent from the frontend `LaundryTag` interface entirely, so they're dropped before the component can use them. Retired reason in particular is captured on retire (`retire(tag)` prompts for and submits `reason`) but never surfaced back in the UI for a previously retired tag.

## Loading/error/realtime behavior
Loading/error is handled through the shared `useAsyncQuery` hook (`packages/hooks/src/use-async-query.ts`, aliased as `useAdminQuery`): initial load shows a spinner (`items` is null), a failed reload sets `error` but deliberately keeps previously-loaded `data` on screen (comment at `use-async-query.ts:22`), and this behavior is shared across all admin-web boards using the same hook — a fix there would apply system-wide. Empty results are handled locally in this component (`filteredTags.length === 0` branch, `laundry-tags-board.tsx:300-308`) with distinct copy for "no tags yet" vs. "no tags match current filter." Realtime connection status is polled every 2s via `isAdminRealtimeConnected()` purely to flip a `Polling`/`Live` badge; the actual refresh trigger is the socket event described in Finding 2, not the poll.
