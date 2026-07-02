import { join } from 'path';

/** Local dir still used by writeCatalogAddonImages() to generate default SVG placeholder icons. */
export const CATALOG_ADDON_UPLOAD_DIR = join(process.cwd(), 'uploads', 'catalog-addons');
export const CATALOG_ADDON_PUBLIC_PREFIX = '/api/v1/uploads/catalog-addons';

export function catalogAddonPublicPath(filename: string) {
  return `${CATALOG_ADDON_PUBLIC_PREFIX}/${filename}`;
}

// Task photos, rider documents, and remittance proofs are stored on Cloudinary (authenticated
// delivery), but keep the same virtual `/api/v1/uploads/...` path shape so JWT-gated access via
// MediaController is unchanged for callers.
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
