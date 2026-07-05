import { join } from 'path';

export const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? join(process.cwd(), 'uploads');

/** Local dir still used by writeCatalogAddonImages() to generate default SVG placeholder icons. */
export const CATALOG_ADDON_UPLOAD_DIR = join(UPLOAD_ROOT, 'public', 'catalog-addons');
export const CATALOG_ADDON_PUBLIC_PREFIX = '/api/v1/uploads/public/catalog-addons';

export function catalogAddonPublicPath(filename: string) {
  return `${CATALOG_ADDON_PUBLIC_PREFIX}/${filename}`;
}

// Task photos, rider documents, and remittance proofs are stored privately on local disk and are
// only fetchable via the JWT-gated MediaController, using this virtual `/api/v1/uploads/...` path shape.
export const TASK_PHOTO_PUBLIC_PREFIX = '/api/v1/uploads/task-photos';
export const RIDER_DOCUMENT_PUBLIC_PREFIX = '/api/v1/uploads/rider-documents';
export const REMITTANCE_PROOF_PUBLIC_PREFIX = '/api/v1/uploads/remittance-proofs';

export function taskPhotoPublicPath(filename: string) {
  return `${TASK_PHOTO_PUBLIC_PREFIX}/${filename}`;
}

export function riderDocumentPublicPath(filename: string) {
  return `${RIDER_DOCUMENT_PUBLIC_PREFIX}/${filename}`;
}

export function remittanceProofPublicPath(filename: string) {
  return `${REMITTANCE_PROOF_PUBLIC_PREFIX}/${filename}`;
}
