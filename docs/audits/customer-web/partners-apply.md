# Audit: Customer-web — Partners apply

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/partners/apply/page.tsx` (`'use client'`)
- Component(s): `MarketingContentPage`, `Card`/`CardBody`/`CardSectionHeader`, `DocumentUploadField`, `FormLabel`/`Input`, `FormError`, `MarketingBackLink`, `Button`

## Sub-pages
None — no outbound navigation into a dynamic detail route. `/partners` is a sibling page (back-link only).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Submit application | POST | `{apiBase}/partner-applications` (multipart `FormData`) | untyped `body.success`/`body.message` check only — no response type consumed | `PartnerApplicationsController.create` -> `PartnerApplicationsService.create` |

## Backend trace
`POST /partner-applications` is intentionally public (no `@UseGuards` — GET/`:id`/PATCH are all `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN, STAFF)`, only `create` is open, which is correct for a public application form). Files arrive via `FileFieldsInterceptor` into memory storage, filtered server-side to `image/jpeg|png|webp` and 5 MB max (`partner-applications.controller.ts:25-41`) — confirmed these limits exactly match the client-side `DocumentUploadField` checks (`document-upload-field.tsx:7-8, 28-35`), so a rejected file fails fast client-side before ever reaching the network. `CreatePartnerApplicationDto` validates every field server-side with matching bounds to the frontend's `maxLength`/`min`/`max` attributes (e.g. `businessName` 160, `dailyCapacityKg` 1-100000, `serviceRadiusKm` 1-100) — no gaps found. The service requires all 5 document types present (`service.ts:29-33`) before creating the Mongo doc, then uploads each buffer to Cloudinary as a **private** buffer (`uploadPrivateBuffer`, not public) under `lunara/partner-application-documents/<appId>-<docType>-<timestamp>` — correct, since these are ID/permit photos and should not be publicly reachable by URL guessing. The endpoint sits behind the app's global `ThrottlerGuard` (`app.module.ts:54,94` — 120 req/min per IP, applied via `APP_GUARD`), so it isn't fully unrate-limited despite having no per-route guard of its own.

The create response echoes back the full serialized application (`service.ts:65-69`, including `email`/`phone`/`documents` with signed-looking `fileUrl`s) to the caller who just submitted it — this is the applicant's own just-submitted data, not exposed to any other party, and the frontend doesn't even read `body.data` (it only checks `body.success`/`body.message`), so no PII round-trips into the browser beyond what the user typed themselves. Not a finding.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Business Information | `businessName`, `ownerFullName`, `businessType` (`BUSINESS_TYPES`, static), `phone`, `email` | |
| Shop Address | `address.street/barangay/cityMunicipality/province/postalCode` | |
| Operations | `operations.dailyCapacityKg/serviceRadiusKm/operatingHours` | |
| Documents | `files[businessPermit/dtiSecRegistration/birCertificate/ownerValidId/shopPhoto]` (`DOCUMENT_FIELDS`, static, matches `PARTNER_APPLICATION_DOCUMENT_TYPES` on the backend exactly) | client validates type/size per-file before allowing selection |
| Additional Notes | `message` (optional), `declarationAccepted` (required checkbox) | |
| Success state (post-submit) | none — static confirmation copy | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Submit partner application | no (create-only, no undo needed) | n/a | yes (`disabled={submitting}` on the submit button) | yes (`error` -> `FormError`) |

## Authorization
`POST /partner-applications` is deliberately public/unauthenticated — appropriate for an inbound lead-gen form from prospective partners who have no account yet. The read/update endpoints on the same controller (`list`, `findOne`, `updateStatus`) are correctly locked to `ADMIN`/`STAFF` via `RolesGuard`, and none of those are reachable from this page. No `[authz]` issues.

## Findings
No issues found. Client-side and server-side validation bounds match exactly
(file type/size, all text field lengths, numeric ranges), documents are
uploaded as private Cloudinary assets rather than public, and the public
create endpoint is still covered by the app-wide rate limiter despite having
no route-specific guard.

## Unused/dead fields
Not applicable — the frontend doesn't consume the create response body at all (only checks `success`/`message`), so there's no payload to diff for dead fields.

## Loading/error/realtime behavior
`submitting` is set synchronously around the fetch call with try/catch/finally; a failed submission surfaces `error` via `FormError` and re-enables the button. No loading state needed before submission (nothing to fetch on page load — the form starts empty). No polling or realtime subscription.
