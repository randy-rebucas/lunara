# Lunara API uploads

All uploads go to Cloudinary (`CloudinaryService` in `common/cloudinary/`). Nothing is written to local disk except default catalog-addon placeholder SVGs.

## Categories

| Category | Cloudinary folder | Delivery | Upload endpoint |
|----------|--------------------|----------|-----------------|
| Customer avatar | `lunara/avatars` | Public `secure_url` | `POST /customers/me/avatar` |
| Partner brand assets | `lunara/partner-brands` | Public `secure_url` | `POST /admin/partners/:id/branding/assets/:field` |
| Message attachments | `lunara/message-attachments` | Public `secure_url` | `POST /partner/messages/:id/upload`, `POST /admin/messages/:id/upload` |
| Catalog addon images | `lunara/catalog-addons` | Public `secure_url` | `POST /admin/addons/:id/image` |
| Rider KYC document | `lunara/rider-documents` | Private, signed URL via `GET /uploads/rider-documents/:filename` (JWT) | `POST /riders/me/documents/:type` |
| Task / processing photo | `lunara/task-photos` | Private, signed URL via `GET /uploads/task-photos/:filename` (JWT) | See below |
| Remittance proof | `lunara/remittance-proofs` | Private, signed URL via `GET /uploads/remittance-proofs/:filename` (JWT) | `POST /riders/remit-cash` |

### Task photo upload endpoints

- `POST /riders/pickup-tasks/:orderId/photo-upload` (rider)
- `POST /riders/delivery-tasks/:orderId/photo-upload` (rider)
- `POST /partner/orders/:orderId/processing/photo-upload` (partner / staff / admin)

Legacy JSON body endpoints (`/photo` with `photoUrl`) remain for integrations; mobile apps use multipart upload.

### Private-category delivery

Rider documents, task photos, and remittance proofs are uploaded with Cloudinary's `type: authenticated`, so they are not fetchable by URL alone. `MediaController` (`GET /uploads/:category/:filename`) checks the caller's JWT against `MediaService.assertAccess()`, then 302-redirects to a short-lived (5 min) signed Cloudinary URL built by `CloudinaryService.getSignedUrl()`. Clients that `fetch()` these paths (e.g. `AuthenticatedImage`) follow the redirect transparently and receive the image bytes.

### Filename conventions (Cloudinary `public_id`, no extension)

- Rider documents: `{userId}-{docType}-{timestamp}`
- Task photos: `{uploaderUserId}-{orderId}-{timestamp}`
- Remittance proofs: `{riderUserId}-remittance-{timestamp}`

### Access control

- **Avatars, partner brand assets, message attachments, catalog addons**: public (Cloudinary `secure_url`, no JWT needed to view).
- **Rider documents / remittance proofs**: owning rider or admin.
- **Task photos**: uploader, assigned pickup/delivery rider, order customer, partner/staff with portal access to the order branch, or admin.

Allowed MIME types: JPEG, PNG, WebP (message attachments also accept PDF, Word, Excel).
