# Partner Brands Workflow

End-to-end process for onboarding a white-label partner brand, from public application to a live, custom-branded partner deployment.

## Overview

```
[1] Application  →  [2] Review  →  [3] Onboarding  →  [4] Brand Setup  →  [5] Domain & Assets  →  [6] Go Live
   (public form)      (admin)        (admin)             (admin)            (admin + DNS)          (status flip)
```

Two data models drive this, linked but distinct:

- **PartnerApplication** (`apps/api/src/modules/partner-applications/`) — the intake record. Tracks the review decision only (`pending` → `reviewed`/`approved`/`rejected`). Never becomes a partner by itself.
- **Partner** (`apps/api/src/modules/partners/`) — the actual brand/tenant record, created during onboarding. Holds `brandConfig` (colors, fonts, domain, assets, status).

`PartnerApplication.onboardedPartnerId` links the two once onboarding happens — it's set independently of `status`, since an application can sit "approved" for a while before anyone completes onboarding.

---

## 1. Application (public)

`POST /partner-applications` — no auth required.

Prospective partner submits business details plus required identity/business documents (`partner-application-documents.ts` defines the required types). Documents upload to Cloudinary under `lunara/partner-application-documents` as **private** assets. Status starts at `PENDING`. Admin gets a best-effort email notification.

## 2. Review (admin/staff)

`GET /partner-applications`, `GET /partner-applications/:id`, `PATCH /partner-applications/:id/status`

Admin/staff (`Roles: ADMIN, STAFF`) review documents and move status to `reviewed` → `approved` or `rejected` (with `rejectionReason`). This is a paper-decision step — no account or branch is created yet.

## 3. Onboarding (admin only)

`POST /admin/partners/onboard` → `AdminService.onboardPartner()` (`OnboardPartnerDto`)

One call creates both the **user account** and the **first branch** for the partner:

- Account: email/phone/password → hashed, checked for duplicates
- Branch: `branchCode`, `branchName`, `branchType` (`franchise` | `partner_shop`), `parentBranchId`, address + coordinates, optional commission rate / capacity limits
- Optional `sourceApplicationId` — if present, links back and sets `PartnerApplication.onboardedPartnerId` + `onboardedAt` (best-effort; failure here doesn't roll back onboarding)

This step does **not** create the `Partner` brand record — that's separate (step 4). An application can also be onboarded manually without a source application at all.

## 4. Brand record + config (admin only)

`POST /admin/partners` → `PartnersService.createByOwnerEmail()`

Creates the `Partner` document: `ownerUserId` (resolved from the onboarded account's email), `legalName`, unique `slug`. `brandConfig` starts with defaults (`status: 'draft'`, Lunara-branded colors/fonts).

`PATCH /admin/partners/:id/branding` → `updateBrandConfig()`

Admin sets:
- `appDisplayName`
- `colors` (primary/secondary/accent/background/foreground/muted/border/destructive)
- `fonts` (sans/heading)
- `domain` (must be globally unique — duplicate throws 400)

## 5. Domain & assets (admin only)

- **Assets**: `POST /admin/partners/:id/branding/assets/:field` (`field` ∈ `logoUrl`/`iconUrl`/`splashUrl`/`faviconUrl`) — uploads to Cloudinary `lunara/partner-brands`, replaces and deletes the previous file.
- **Domain verification**: `customDomainVerified` flips once DNS/CNAME ownership is confirmed (manual/ops step outside the API today — treat as a checklist item before go-live if a custom domain is used).
- Mobile bundle IDs (`mobileBundleId.ios`/`.android`) if the partner gets a native app build.

`brandConfig.status` moves `draft` → `pending_review` while this is being assembled.

## 6. Go live (admin only)

`PATCH /admin/partners/:id/branding` with `status: 'live'`, and `PATCH /admin/partners/:id/active` to ensure `isActive: true`.

Once live:
- `findByDomain()` is what customer-facing apps use to resolve a partner by custom domain — only returns `isActive: true` partners.
- Orders placed against the partner's branch(es) stamp `order.partnerId = branch.partnerUserId` (`branches.service.ts:1566`), and pipeline updates emit over the partner's tracking channel.

To take a partner down: `PATCH /admin/partners/:id/active` with `isActive: false` (soft — keeps config/history, just stops resolving/serving).

---

## Reference: key files

| Concern | File |
|---|---|
| Application intake | `apps/api/src/modules/partner-applications/partner-applications.{controller,service}.ts` |
| Application schema/status | `apps/api/src/modules/partner-applications/schemas/partner-application.schema.ts` |
| Onboarding (account + branch) | `apps/api/src/modules/admin/admin.service.ts` (`onboardPartner`), `dto/onboard-partner.dto.ts` |
| Partner brand CRUD | `apps/api/src/modules/partners/partners.{controller,service}.ts` (admin controller: `partners-admin.controller.ts`) |
| Brand schema | `apps/api/src/modules/partners/schemas/partner.schema.ts` |
| Asset upload constraints | `apps/api/src/modules/partners/partner-brand-upload.options.ts` |
| Domain resolution at request time | `PartnersService.findByDomain()` |

## Notes / gaps to be aware of

- There is no single "convert this application into a live partner" endpoint — steps 3–6 are separate admin calls today. If you're building an admin UI for this, wire them together as a wizard rather than assuming one API call does it all.
- Custom domain DNS verification isn't automated in the API (`customDomainVerified` is just a boolean flag) — confirm the ops process for actually checking DNS before flipping it.
- `Partner.slug` and `brandConfig.domain` are both unique — plan slug/domain collisions into any partner self-service signup flow.
