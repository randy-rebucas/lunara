# Lunara API uploads

All user uploads are stored on local disk under `UPLOAD_ROOT` via `LocalStorageService` (`common/storage/`). Public categories write to `UPLOAD_ROOT/public/<folder>/<filename>` and are served directly by the `ServeStaticModule` mounted at `/api/v1/uploads/public` in `app.module.ts`. Private categories write to `UPLOAD_ROOT/private/<folder>/<filename>`, outside that static root, and are only ever reachable through the JWT-gated `MediaController`, which streams the file via `res.sendFile()` after its own access check.

`UPLOAD_ROOT` defaults to `<repo>/apps/api/uploads` if unset (see `common/uploads/upload-paths.ts`). In production (Render), it's set to `/app/uploads`, backed by a persistent Render Disk — see `render.yaml`'s `disk:` block. A Render Disk attaches to exactly one instance, so **the API cannot horizontally scale while uploads live on local disk** — this is a deliberate, accepted tradeoff (see git history around the Cloudinary migration and back).

## Categories

| Category | Local folder (under `UPLOAD_ROOT`) | Delivery | Upload endpoint |
|----------|--------------|----------|-----------------|
| Customer avatar | `public/lunara/avatars` | Public URL | `POST /customers/me/avatar` |
| Partner brand assets | `public/lunara/partner-brands` | Public URL | `POST /admin/partners/:id/branding/assets/:field` |
| Message attachments | `public/lunara/message-attachments` | Public URL | `POST /partner/messages/:id/upload`, `POST /admin/messages/:id/upload` |
| Catalog addon images | `public/lunara/catalog-addons` | Public URL | `POST /admin/addons/:id/image` |
| Partner/branch avatars, logos | `public/lunara/user-avatars`, `public/lunara/branch-logos` | Public URL | partner profile/settings endpoints |
| Rider KYC document | `private/lunara/rider-documents` | Streamed via `GET /uploads/rider-documents/:filename` (JWT) | `POST /riders/me/documents/:type` |
| Task / processing photo | `private/lunara/task-photos` | Streamed via `GET /uploads/task-photos/:filename` (JWT) | See below |
| Remittance proof | `private/lunara/remittance-proofs` | Streamed via `GET /uploads/remittance-proofs/:filename` (JWT) | `POST /riders/remit-cash` |
| Rider/partner application documents | `private/lunara/rider-application-documents`, `private/lunara/partner-application-documents` | Private, no viewer route yet (unchanged from before) | application submission endpoints |

### Task photo upload endpoints

- `POST /riders/pickup-tasks/:orderId/photo-upload` (rider)
- `POST /riders/delivery-tasks/:orderId/photo-upload` (rider)
- `POST /partner/orders/:orderId/processing/photo-upload` (partner / staff / admin)

Legacy JSON body endpoints (`/photo` with `photoUrl`) remain for integrations; mobile apps use multipart upload.

### Private-category delivery

Rider documents, task photos, and remittance proofs are written to `UPLOAD_ROOT/private/...`, which sits outside the `ServeStaticModule` root and is never directly web-reachable. `MediaController` (`GET /uploads/:category/:filename`) checks the caller's JWT against `MediaService.assertAccess()`, then calls `res.sendFile()` against the resolved local path (`MediaService.resolveFilePath()` → `LocalStorageService.resolvePrivatePath()`). There's no signed-URL redirect here (unlike the old Cloudinary "authenticated" delivery) — the controller itself is the access gate, and it streams the bytes directly. The stored DB value keeps the same virtual `/api/v1/uploads/<category>/<filename>` path shape it always has — that's the API route the JWT check runs against.

### Filename conventions

Filenames are always server-generated (never derived from client `originalname`), and include the real file extension resolved from the upload's MIME type:

- Rider documents: `{userId}-{docType}-{timestamp}.ext`
- Task photos: `{uploaderUserId}-{orderId}-{timestamp}.ext`
- Remittance proofs: `{riderUserId}-remittance-{timestamp}.ext`

### Access control

- **Avatars, partner brand assets, message attachments, catalog addons**: public (bare URL, no JWT needed to view).
- **Rider documents / remittance proofs**: owning rider or admin.
- **Task photos**: uploader, assigned pickup/delivery rider, order customer, partner/staff with portal access to the order branch, or admin.

Allowed MIME types: JPEG, PNG, WebP (message attachments also accept PDF, Word, Excel).

### Cleanup on replace

`LocalStorageService.deleteFile(folder, filenameOrUrl, visibility)` `fs.unlink()`s the file and is wired into every replace flow that overwrites an existing asset (avatar re-upload, partner branding, branch logos, rider-document replacement, catalog addon image). It accepts either a bare filename or a full URL and resolves the on-disk filename from either form. Best-effort — missing files are ignored, not treated as an error.

### Not yet migrated / caveats

- Partner and rider application documents are uploaded once at submission time; there's no resubmit/replace flow, so there's nothing to clean up on replace for that category.
- **Mixed-URL caveat**: records written while the API ran on Cloudinary (roughly 2026-07-16 through this revert) hold Cloudinary `secure_url`s that will keep working as long as the Cloudinary account stays active, but won't be cleaned up by `deleteFile()` (it only unlinks local paths now) and won't benefit from the local persistent-disk backup. Treat any such lingering references as a known, small-scope follow-up (re-upload, or a one-off migration script to fetch-and-rehost).
