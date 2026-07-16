# Lunara API uploads

All user uploads are stored on Cloudinary via `CloudinaryStorageService` (`common/storage/`). Public categories upload with default (`upload`) delivery type and return a fetchable `secure_url`. Private categories upload with `type: authenticated`, are never publicly fetchable, and are only reachable through the JWT-gated `MediaController`, which redirects to a short-lived signed URL.

`UPLOAD_ROOT` / local disk is still used, but only for generated catalog-addon placeholder SVG icons (`writeCatalogAddonImages()`) — not for any user-uploaded file.

## Categories

| Category | Cloudinary folder | Delivery | Upload endpoint |
|----------|--------------|----------|-----------------|
| Customer avatar | `lunara/avatars` | Public `secure_url` | `POST /customers/me/avatar` |
| Partner brand assets | `lunara/partner-brands` | Public `secure_url` | `POST /admin/partners/:id/branding/assets/:field` |
| Message attachments | `lunara/message-attachments` | Public `secure_url` | `POST /partner/messages/:id/upload`, `POST /admin/messages/:id/upload` |
| Catalog addon images | `lunara/catalog-addons` | Public `secure_url` | `POST /admin/addons/:id/image` |
| Partner/branch avatars, logos | `lunara/user-avatars`, `lunara/branch-logos` | Public `secure_url` | partner profile/settings endpoints |
| Rider KYC document | `lunara/rider-documents` | Signed URL via `GET /uploads/rider-documents/:filename` (JWT) | `POST /riders/me/documents/:type` |
| Task / processing photo | `lunara/task-photos` | Signed URL via `GET /uploads/task-photos/:filename` (JWT) | See below |
| Remittance proof | `lunara/remittance-proofs` | Signed URL via `GET /uploads/remittance-proofs/:filename` (JWT) | `POST /riders/remit-cash` |
| Rider/partner application documents | `lunara/rider-application-documents`, `lunara/partner-application-documents` | Private, no viewer route yet (unchanged from before) | application submission endpoints |

### Task photo upload endpoints

- `POST /riders/pickup-tasks/:orderId/photo-upload` (rider)
- `POST /riders/delivery-tasks/:orderId/photo-upload` (rider)
- `POST /partner/orders/:orderId/processing/photo-upload` (partner / staff / admin)

Legacy JSON body endpoints (`/photo` with `photoUrl`) remain for integrations; mobile apps use multipart upload.

### Private-category delivery

Rider documents, task photos, and remittance proofs are uploaded with `type: authenticated` on Cloudinary, so they're not fetchable from a bare `secure_url`. `MediaController` (`GET /uploads/:category/:filename`) checks the caller's JWT against `MediaService.assertAccess()`, then `res.redirect()`s to a short-lived signed URL (`CloudinaryStorageService.getSignedUrl()`, `sign_url: true`, `expires_at` ~5 minutes out). The stored DB value keeps the same virtual `/api/v1/uploads/<category>/<filename>` path shape it always has — that's the API route the JWT check runs against, not the Cloudinary URL itself.

### Filename / public_id conventions

Filenames (used as Cloudinary `public_id`s, joined with the folder) include the real file extension, and are always server-generated (never derived from client `originalname`):

- Rider documents: `{userId}-{docType}-{timestamp}.ext`
- Task photos: `{uploaderUserId}-{orderId}-{timestamp}.ext`
- Remittance proofs: `{riderUserId}-remittance-{timestamp}.ext`

### Access control

- **Avatars, partner brand assets, message attachments, catalog addons**: public (Cloudinary `secure_url`, no JWT needed to view).
- **Rider documents / remittance proofs**: owning rider or admin.
- **Task photos**: uploader, assigned pickup/delivery rider, order customer, partner/staff with portal access to the order branch, or admin.

Allowed MIME types: JPEG, PNG, WebP (message attachments also accept PDF, Word, Excel).

### Cleanup on replace

`CloudinaryStorageService.deleteFile(folder, filenameOrUrl, visibility, resourceType?)` calls `cloudinary.uploader.destroy()` and is wired into every replace flow that overwrites an existing asset (avatar re-upload, partner branding, branch logos, rider-document replacement, catalog addon image). It accepts either a bare `public_id`/filename or a full `secure_url` and resolves the Cloudinary `public_id` from either form. Best-effort — missing assets are ignored, not treated as an error.

### Not yet migrated / caveats

- Partner and rider application documents are uploaded once at submission time; there's no resubmit/replace flow, so there's nothing to clean up on replace for that category.
- **Mixed-URL caveat**: records written while the API ran on local disk (roughly 2026-07-05 through this migration) hold `API_URL/api/v1/uploads/...` URLs that will 404 once local storage is fully decommissioned. Older, pre-2026-07 Cloudinary URLs that were never data-migrated to local disk will start resolving again. No backfill script is included — treat any lingering broken images from that window as a known, small-scope follow-up (re-upload, or a one-off URL-shape-detection re-hosting script).
