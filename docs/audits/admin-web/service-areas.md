# Audit: Admin-web — Service areas

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/service-areas/page.tsx`
- Component(s): `apps/admin-web/src/components/datacenter/service-areas-board.tsx` (client component, `ServiceAreasBoard`)

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| List | GET | `/admin/service-areas` | `ServiceAreaRow[]` | `AdminController.getServiceAreas` -> `ServiceAreasService.listAll` |
| Create | POST | `/admin/service-areas` | (unused response) | `AdminController.createServiceArea` -> `ServiceAreasService.create` |
| Update | PATCH | `/admin/service-areas/:id` | (unused response) | `AdminController.updateServiceArea` -> `ServiceAreasService.update` |
| Toggle active | PATCH | `/admin/service-areas/:id` | (unused response) | same as update, body `{ isActive }` |
| Delete | DELETE | `/admin/service-areas/:id` | (unused response) | `AdminController.deleteServiceArea` -> `ServiceAreasService.delete` |

## Backend trace
`ServiceAreasService.listAll()` lazily seeds two default areas (`DEFAULT_AREAS`, Metro Manila + Baybay City) on first call if the collection is empty, then returns all areas sorted by `sortOrder` ascending, then `label`. This is the same ordering `listActive()` uses when matching an address at booking time (`resolveAreaForAddress` in the same service), so the admin table's row order reflects real match priority. `create`/`update` are simple Mongoose writes validated by `CreateServiceAreaDto`/`UpdateServiceAreaDto` (`services` validated against the `BookingType` enum). `delete` does a straight `deleteOne` with no dependency check — nothing prevents deleting an area that's actively resolving live bookings.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Coverage areas table | `label`, `cities` (joined, truncated), `services` (mapped through `BOOKING_TYPE_LABELS`, "All services" if empty), `isActive` | `provinces`, `postalPrefixes`, and `sortOrder` are fetched but not shown as columns — only visible after clicking "Edit" and reading the form. `BOOKING_TYPE_LABELS` (`service-areas-board.tsx:19-29`) is a hardcoded map duplicating the `BookingType` enum from `@lunara/types`; new booking types added to the enum silently render as their raw snake_case key until this map is updated by hand. |
| Add/Edit area forms (`ServiceAreaFields`) | `label`, `sortOrder`, `cities`, `provinces`, `postalPrefixes`, `services`, `isActive` | CSV fields (`splitCsv`) trim and drop empties but don't dedupe or normalize case, so `"Manila, manila"` becomes two literal-distinct strings stored and matched via `cityMatches` (case-insensitive at match time in `@lunara/utils`, so functionally harmless, just a messy stored value). |
| Row actions: Edit / Deactivate/Activate / Delete | `area._id`, `area.isActive` | Delete has no confirmation step — a single click permanently removes the area (`deleteArea`, `service-areas-board.tsx:179-188`), unlike the laundry-tags board's retire flow which prompts for a reason before an equivalent state change. |

## Findings

1. **Delete has no confirmation dialog.** `deleteArea` (`service-areas-board.tsx:179-188`) fires the `DELETE` request directly from the button's `onClick` with no `window.confirm` or similar guard. Because `resolveAreaForAddress` uses these areas to gate whether an address can book at all, deleting the wrong coverage area (e.g. "Metro Manila") immediately breaks address validation for every customer in that area — with no undo. This is a real behavior gap, not just a style nit, given the button sits directly next to "Edit"/"Deactivate" with identical styling (`link-primary text-xs font-medium`, only colored `text-destructive`).
2. **Table hides fields the admin needs to judge coverage overlap.** The list only renders `label`, `cities`, `services`, and `isActive` (`service-areas-board.tsx:271-286`); `provinces`, `postalPrefixes`, and `sortOrder` are fetched (`ServiceAreaRow`) but only visible by opening Edit on each row one at a time. Since matching falls through to the first area (in `sortOrder` order) whose city **or** province **or** postal prefix matches, an admin creating a new area has no way to spot an overlapping province/postal range against existing areas from the table view — they'd have to open every row's edit form to check.
3. **`BOOKING_TYPE_LABELS`/`BOOKING_TYPES` duplicate the backend `BookingType` enum by hand.** `service-areas-board.tsx:7-29` hardcodes both the list of booking types and their display labels; the schema comment (`service-area.schema.ts:21`) even notes "empty means every active type is allowed" but nothing enforces the frontend list staying in sync if `BookingType` (`packages/types/src/enums.ts:45-55`) gains or removes a value. Currently in sync, but there's no shared source of truth (e.g. a generated labels map) preventing drift.

## Unused/dead fields
- `createdAt` / `updatedAt` on the `ServiceArea` schema are returned in the list response but not part of the frontend `ServiceAreaRow` type and never rendered (no "last updated" indicator).
- `provinces`, `postalPrefixes`, `sortOrder` — returned and used inside the edit form, but never rendered in the main table (see Finding 2).

## Loading/error/realtime behavior
Loading/error handled via the shared `useAsyncQuery` hook (`useAdminQuery`), same as every other admin-web board: spinner while `items` is null, a failed reload sets `error` but preserves previously-loaded data, standard shared behavior already documented for other boards. There is no realtime/socket subscription on this page — changes only reflect after `reload()` is called following a create/update/delete/toggle action, which is appropriate since service areas are low-frequency admin config, not live operational data. No polling.
