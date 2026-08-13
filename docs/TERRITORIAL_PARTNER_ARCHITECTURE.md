# Territorial Partner Architecture

## 1. Concept & terminology

```
LUNARA CORE (apps/api — shared NestJS/Mongoose backend)
  └─ Lunara Admin / Ops (apps/admin-web — dispatch, partners, branches, riders, service areas)
       └─ TERRITORIAL PARTNER  (Partner + PartnerTerritory documents)
            ├─ Partner Dashboard & Operations (apps/partner-web)
            │     └─ Laundry Branches (Branch docs) → Delivery / Riders (assignedRiderId, apps/rider-mobile)
            └─ Branded Customer Platform (Multi-tenant.md)
                  ├─ customer-web (subdomain/custom-domain theming)
                  └─ customer-mobile (per-partner EAS build)
```

A **Territorial Partner** is today's `Partner` brand entity (`apps/api/src/modules/partners/schemas/partner.schema.ts`) plus a **`PartnerTerritory`** — an explicit geographic footprint and exclusivity rule. Everything below Territorial Partner in the diagram already exists in the codebase; `PartnerTerritory` is the one net-new piece formalized here.

| Sketch layer | Code |
|---|---|
| Lunara Core | `apps/api` |
| Admin/Ops | `apps/admin-web` (dispatch, partners, branches, riders, service-areas boards) |
| Territorial Partner | `Partner` (brand/config) + `PartnerTerritory` (geo/exclusivity) |
| Partner Dashboard / Operations | `apps/partner-web` |
| Laundry Branches | `Branch` docs (`partnerUserId`, `parentBranchId`, `isMainShop`) |
| Delivery / Riders | `Branch.assignedRiderId`, `User{role: RIDER}`, `apps/rider-mobile` |
| Customer Platform | `apps/customer-web` + `apps/customer-mobile`, per `Multi-tenant.md` |

## 2. Design decision: Territory is a 1:1 facet of Partner, not a new parent tenant

`PartnerTerritory` does **not** group multiple partners. There is no requirement — in the product or in the user's own sketch — for one operator to own several partner brands. A Territorial Partner is exactly today's `Partner` → `Branch[]` shape, with one addition: a defined, optionally-exclusive service area.

`PartnerTerritory` is its own collection (`partner_territories`), not a subdocument embedded on `Partner`, so it can carry its own `2dsphere` geo index independent of `Partner`'s brand-config fields — the same separation-of-concerns already used between `Partner` (brand) and `Branch` (operations). Enforced 1:1 via a unique index on `partnerId`.

## 3. Data model

```ts
// apps/api/src/modules/partners/schemas/partner-territory.schema.ts
PartnerTerritory {
  partnerId: ObjectId (unique, ref Partner._id)
  name: string
  slug: string (unique)
  boundaryType: 'radius' | 'polygon'
  center?: GeoJSON Point        // when boundaryType = 'radius'
  radiusKm?: number
  boundary?: GeoJSON Polygon/MultiPolygon   // when boundaryType = 'polygon'
  isExclusive: boolean (default true)
  status: 'active' | 'pending' | 'suspended'
  primaryContactName?, primaryContactPhone?, opsNotes?
}
```

Relations: `Partner.ownerUserId` (User) ← `Branch.partnerUserId` (many) ; `Partner._id` ← `PartnerTerritory.partnerId` (one).

## 4. Dispatch & exclusivity flow

1. A booking placed on a partner's branded app carries `x-lunara-partner-id` (already implemented — see `booking.controller.ts`).
2. `booking.service.ts` calls `BranchesService.buildDispatchEvaluationsForPartner(address, bookingType, weightKg, partnerUserId)`.
3. **New**: that method resolves the partner's `PartnerTerritory` (via `PartnerTerritoriesService.findByOwnerUserId`). If a territory is configured and the address falls outside it, the call throws immediately — no fallback to the shared queue, consistent with Multi-tenant.md's existing "fully booked" rule for zero capacity.
4. If inside (or no territory configured — fully additive, existing partners without a territory are unaffected), ranking proceeds exactly as before, filtered to that partner's branches.
5. **New**: for the *unscoped* path (`buildDispatchEvaluations` with no `partnerUserId` — admin's shared `/dispatch` queue), before ranking, `PartnerTerritoriesService.findExclusiveOwnerUserIdsContaining(coords)` checks whether the address falls inside any other partner's exclusive territory. If so, candidate branches are restricted to that partner only, so admin/staff can't accidentally dispatch into another partner's exclusive turf.

## 5. Relationship to Multi-tenant.md

`Multi-tenant.md` defines the white-labeling rollout in four phases:
- **Phase 1** (Partner schema, partner-context header, auto-dispatch bypass) — **implemented**, verified in `booking.controller.ts` / `booking.service.ts` / `branches.service.ts`. Territory is a hard prerequisite consumer of this phase.
- **Phase 2** (customer-web domain resolution + theming) — required before a Territorial Partner is operable end-to-end on the web; verify `apps/customer-web/src/middleware.ts` before onboarding a new partner.
- **Phase 3** (customer-mobile per-partner EAS builds) — independent of Territory; deferred for the 3D Laundry Hub pilot.
- **Phase 4** (admin branding CRUD UI) — Territory's own admin CRUD (`partners-admin.controller.ts` `/admin/partners/:id/territory`) follows the same controller pattern as Phase 4's branding endpoints.

## 6. Onboarding checklist for a new Territorial Partner

1. Confirm Multi-tenant.md Phase 1 is wired (header → `partnerContextId` → partner-scoped dispatch).
2. Create the `Partner` record (`ownerUserId`, `legalName`, `slug`, `brandConfig`).
3. Create its `PartnerTerritory` (`POST /admin/partners/:id/territory`): boundary + `isExclusive`.
4. Create at least one `Branch` (`partnerUserId`, `isMainShop: true`, location inside the territory).
5. Set `brandConfig.domain` and confirm Phase 2 renders the branded subdomain.
6. Verify end-to-end: a booking on the subdomain resolves to `SHOP_ASSIGNED` on this partner's branch and never appears in admin's `/dispatch` queue; an out-of-territory address fails checkout with a clear message.
7. Mobile build (Phase 3) — separate, later step.

### 3D Laundry Hub (pilot)

`partner-brands/3d-laundry-hub/manifest.json` already has brand colors/fonts and placeholder bundle IDs scaffolded. Remaining steps to make it operable: create its `Partner` record from that manifest, create its `PartnerTerritory`, create its first `Branch`, assign a domain, and run through the checklist above. Mobile build explicitly deferred — web + auto-dispatch is the minimum viable pilot.

## 7. Open risks

Carried from `Multi-tenant.md`: custom-domain DNS/SSL propagation, per-partner mobile store review overhead, developer account ownership for EAS/store credentials, restricting v1 to pre-approved fonts, confirming the asset upload/CDN pattern (Cloudinary, per `apps/api/src/common/storage/cloudinary-storage.service.ts`).

Territory-specific:
- **Polygon-drawing UX**: admin-web has no map-drawing component yet; `radius` boundaries are the simpler v1 path. `service-areas-board.tsx` is the natural place to add polygon drawing later.
- **Geofence query cost at scale**: the `$geoWithin`/haversine checks added to `buildDispatchEvaluations` run per dispatch call; negligible for a handful of territories, worth profiling once territory count grows.
- **Overlapping exclusive territories**: `PartnerTerritoriesService.upsertForPartner` does not currently validate against other territories' boundaries — recommend adding an overlap check before allowing two `isExclusive: true` territories to intersect.
- **UI note**: `apps/admin-web`'s existing "Partners" board (`partners-board.tsx`, backed by `/admin/shops`) manages the separate `User{role: PARTNER}` + `Branch` shop-account concept, distinct from the white-label `Partner` brand entity this document covers. A future admin UI for `Partner`/`PartnerTerritory` management should live under `/partners/branding` (already the branding entry point) rather than being bolted onto the shops board, to avoid conflating the two.
