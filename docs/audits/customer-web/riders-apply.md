# Audit: Customer-web — Riders apply

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(marketing)/riders/apply/page.tsx` (`'use client'`)
- Component(s): `MarketingContentPage`, `Card`/`CardBody`/`CardSectionHeader`, `DocumentUploadField`, `FormLabel`/`Input`, `FormError`, `MarketingBackLink`, `Button`

## Sub-pages
None — no outbound navigation into a dynamic detail route. `/riders` is a sibling page (back-link only).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Submit application | POST | `{apiBase}/rider-applications` (multipart `FormData`) | untyped `body.success`/`body.message` check only — no response type consumed | `RiderApplicationsController.create` -> `RiderApplicationsService.create` |

## Backend trace
Structurally identical to `docs/audits/customer-web/partners-apply.md`'s
trace, and confirmed field-for-field via a direct read: `POST
/rider-applications` is the only unguarded route on this controller (`list`,
`findOne`, `updateStatus` are all `JwtAuthGuard` + `RolesGuard` +
`@Roles(ADMIN, STAFF)`); files go through the same
`FileFieldsInterceptor`/memory-storage/5 MB/JPEG-PNG-WebP filter
(`rider-applications.controller.ts:25-41`), matching the client-side
`DocumentUploadField` checks exactly; `CreateRiderApplicationDto` validates
every field with bounds matching the frontend's `maxLength` attributes
(`create-rider-application.dto.ts`), including the 8-item document set
(`RIDER_APPLICATION_DOCUMENT_TYPES`) matching the frontend's
`DOCUMENT_FIELDS` key-for-key. The service requires all 8 documents present
before creating the record, then uploads each to Cloudinary as a **private**
buffer (`uploadPrivateBuffer`) — correct, since these are government ID,
license, and clearance documents. Same global `ThrottlerGuard` (120 req/min
per IP) applies as the app-wide default. The create response echoes the
full serialized application back to the caller, same as
`partner-applications` — the frontend doesn't read `body.data`, only
`body.success`/`body.message`, so no PII round-trips into the browser beyond
what the applicant typed themselves.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Personal Information | `firstName`, `lastName`, `gender` (`GENDERS`, static), `civilStatus` (`CIVIL_STATUSES`, static), `phone`, `email` | |
| Address | `address.street/barangay/cityMunicipality/province/postalCode` | |
| Emergency Contact | `emergencyContact.fullName/relationship/contactNumber/address` | |
| Vehicle Information | `vehicle.type` (`VEHICLE_TYPES`, static), `.make/.model/.color/.plateNumber/.yearModel` | |
| License Information | `license.number/.expirationDate/.restrictionCode` (optional) | |
| Documents | `files[governmentId/driversLicense/orReceipt/crCertificate/nbiPoliceClearance/brgyClearance/selfiePhoto/vehiclePhoto]` (`DOCUMENT_FIELDS`, matches `RIDER_APPLICATION_DOCUMENT_TYPES` exactly) | client validates type/size per-file (`document-upload-field.tsx`, shared with `partners/apply`) |
| Additional Notes | `message` (optional), `declarationAccepted` (required checkbox) | |
| Success state (post-submit) | none — static confirmation copy | |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Submit rider application | no (create-only) | n/a | yes (`disabled={submitting}`) | yes (`error` -> `FormError`) |

## Authorization
`POST /rider-applications` is deliberately public/unauthenticated, appropriate for an inbound applicant with no account yet. `list`/`findOne`/`updateStatus` are correctly locked to `ADMIN`/`STAFF`, none reachable from this page. No `[authz]` issues.

## Findings
No issues found. This page is a structural twin of `docs/audits/customer-web/partners-apply.md` — same validation-parity guarantees, same private-storage handling for sensitive documents (here even more sensitive: government ID, driver's license, NBI/police clearance), same rate-limiting coverage.

## Unused/dead fields
Not applicable — the frontend doesn't consume the create response body at all (only checks `success`/`message`).

## Loading/error/realtime behavior
`submitting` is set synchronously around the fetch call with try/catch/finally; a failed submission surfaces `error` via `FormError` and re-enables the button. No loading state needed before submission. No polling or realtime subscription.
