# Lunara API uploads

All uploads are stored under `uploads/` at the API working directory. Directories are created on boot via `ensureUploadDirectories()`.

## Categories

| Category | Directory | Upload endpoint | Max size | Field name | View endpoint |
|----------|-----------|-----------------|----------|------------|---------------|
| Customer avatar | `uploads/avatars/` | `POST /customers/me/avatar` | 5 MB | `avatar` | Public static `/api/v1/uploads/avatars/:file` |
| Rider KYC document | `uploads/rider-documents/` | `POST /riders/me/documents/:type` | 5 MB | `document` | `GET /uploads/rider-documents/:file` (JWT) |
| Task / processing photo | `uploads/task-photos/` | See below | 8 MB | `photo` | `GET /uploads/task-photos/:file` (JWT) |

### Task photo upload endpoints

- `POST /riders/pickup-tasks/:orderId/photo-upload` (rider)
- `POST /riders/delivery-tasks/:orderId/photo-upload` (rider)
- `POST /partner/orders/:orderId/processing/photo-upload` (partner / staff / admin)

Legacy JSON body endpoints (`/photo` with `photoUrl`) remain for integrations; mobile apps use multipart upload.

### Filename conventions

- Avatars: `{userId}-{timestamp}.ext`
- Rider documents: `{userId}-{docType}-{timestamp}.ext`
- Task photos: `{uploaderUserId}-{orderId}-{timestamp}.ext`

### Access control

- **Avatars**: public (no JWT).
- **Rider documents**: uploader rider or admin.
- **Task photos**: uploader, assigned pickup/delivery rider, order customer, partner/staff with portal access to the order branch, or admin.

Clients must not use raw `<img src>` for protected paths; fetch with `Authorization: Bearer` (see admin/partner `AuthenticatedImage` and rider `AuthenticatedImage`).

Allowed MIME types: JPEG, PNG, WebP.
