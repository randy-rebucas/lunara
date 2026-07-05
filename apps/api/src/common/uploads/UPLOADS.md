# Lunara API uploads

All uploads are stored on local disk via `LocalStorageService` (`common/storage/`), under `UPLOAD_ROOT` (defaults to `<cwd>/uploads`; set to `/app/uploads` in production, backed by a persistent Render disk). Files split into `UPLOAD_ROOT/public/<category>` (served directly via static hosting) and `UPLOAD_ROOT/private/<category>` (only fetchable through the JWT-gated `MediaController`).

## Categories

| Category | Local folder | Delivery | Upload endpoint |
|----------|--------------|----------|-----------------|
| Customer avatar | `public/avatars` | Public URL (`API_URL/api/v1/uploads/public/avatars/...`) | `POST /customers/me/avatar` |
| Partner brand assets | `public/partner-brands` | Public URL | `POST /admin/partners/:id/branding/assets/:field` |
| Message attachments | `public/message-attachments` | Public URL | `POST /partner/messages/:id/upload`, `POST /admin/messages/:id/upload` |
| Catalog addon images | `public/catalog-addons` | Public URL | `POST /admin/addons/:id/image` |
| Rider KYC document | `private/rider-documents` | Streamed via `GET /uploads/rider-documents/:filename` (JWT) | `POST /riders/me/documents/:type` |
| Task / processing photo | `private/task-photos` | Streamed via `GET /uploads/task-photos/:filename` (JWT) | See below |
| Remittance proof | `private/remittance-proofs` | Streamed via `GET /uploads/remittance-proofs/:filename` (JWT) | `POST /riders/remit-cash` |

### Task photo upload endpoints

- `POST /riders/pickup-tasks/:orderId/photo-upload` (rider)
- `POST /riders/delivery-tasks/:orderId/photo-upload` (rider)
- `POST /partner/orders/:orderId/processing/photo-upload` (partner / staff / admin)

Legacy JSON body endpoints (`/photo` with `photoUrl`) remain for integrations; mobile apps use multipart upload.

### Private-category delivery

Rider documents, task photos, and remittance proofs are written under `UPLOAD_ROOT/private/...` and are not reachable via static hosting. `MediaController` (`GET /uploads/:category/:filename`) checks the caller's JWT against `MediaService.assertAccess()`, then streams the file directly from disk via `res.sendFile()`.

### Filename conventions

Filenames include the real file extension (derived from the upload's MIME type) so `res.sendFile()` can content-type them automatically:

- Rider documents: `{userId}-{docType}-{timestamp}.ext`
- Task photos: `{uploaderUserId}-{orderId}-{timestamp}.ext`
- Remittance proofs: `{riderUserId}-remittance-{timestamp}.ext`

### Access control

- **Avatars, partner brand assets, message attachments, catalog addons**: public (static file URL, no JWT needed to view).
- **Rider documents / remittance proofs**: owning rider or admin.
- **Task photos**: uploader, assigned pickup/delivery rider, order customer, partner/staff with portal access to the order branch, or admin.

Allowed MIME types: JPEG, PNG, WebP (message attachments also accept PDF, Word, Excel).

### Not yet migrated / caveats

- Partner and rider application documents (`partner-applications`, `rider-applications`) are written to `private/partner-application-documents` and `private/rider-application-documents`, but — as under the previous Cloudinary setup — there is no viewer/download route for them yet.
- Assets uploaded before this migration (Cloudinary URLs already stored in Mongo) are not automatically migrated to local disk; those records will keep pointing at Cloudinary until a separate data migration is run.
