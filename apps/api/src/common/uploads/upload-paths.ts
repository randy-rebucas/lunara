import { join } from 'path';

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
export const AVATAR_UPLOAD_DIR = join(UPLOADS_ROOT, 'avatars');
export const AVATAR_PUBLIC_PREFIX = '/api/v1/uploads/avatars';
export const TASK_PHOTO_UPLOAD_DIR = join(UPLOADS_ROOT, 'task-photos');
export const TASK_PHOTO_PUBLIC_PREFIX = '/api/v1/uploads/task-photos';
export const RIDER_DOCUMENT_UPLOAD_DIR = join(UPLOADS_ROOT, 'rider-documents');
export const RIDER_DOCUMENT_PUBLIC_PREFIX = '/api/v1/uploads/rider-documents';
export const CATALOG_ADDON_UPLOAD_DIR = join(UPLOADS_ROOT, 'catalog-addons');
export const CATALOG_ADDON_PUBLIC_PREFIX = '/api/v1/uploads/catalog-addons';
export const PARTNER_BRAND_UPLOAD_DIR = join(UPLOADS_ROOT, 'partner-brands');
export const PARTNER_BRAND_PUBLIC_PREFIX = '/api/v1/uploads/partner-brands';

export function avatarPublicPath(filename: string) {
  return `${AVATAR_PUBLIC_PREFIX}/${filename}`;
}

export function avatarFilePath(filename: string) {
  return join(AVATAR_UPLOAD_DIR, filename);
}

export function taskPhotoPublicPath(filename: string) {
  return `${TASK_PHOTO_PUBLIC_PREFIX}/${filename}`;
}

export function taskPhotoFilePath(filename: string) {
  return join(TASK_PHOTO_UPLOAD_DIR, filename);
}

export function riderDocumentPublicPath(filename: string) {
  return `${RIDER_DOCUMENT_PUBLIC_PREFIX}/${filename}`;
}

export function riderDocumentFilePath(filename: string) {
  return join(RIDER_DOCUMENT_UPLOAD_DIR, filename);
}

export function catalogAddonPublicPath(filename: string) {
  return `${CATALOG_ADDON_PUBLIC_PREFIX}/${filename}`;
}

export function partnerBrandPublicPath(filename: string) {
  return `${PARTNER_BRAND_PUBLIC_PREFIX}/${filename}`;
}

export const REMITTANCE_PROOF_UPLOAD_DIR = join(UPLOADS_ROOT, 'remittance-proofs');
export const REMITTANCE_PROOF_PUBLIC_PREFIX = '/api/v1/uploads/remittance-proofs';

export function remittanceProofPublicPath(filename: string) {
  return `${REMITTANCE_PROOF_PUBLIC_PREFIX}/${filename}`;
}

export const MESSAGE_ATTACHMENT_UPLOAD_DIR = join(UPLOADS_ROOT, 'message-attachments');
export const MESSAGE_ATTACHMENT_PUBLIC_PREFIX = '/api/v1/uploads/message-attachments';

export function messageAttachmentPublicPath(filename: string) {
  return `${MESSAGE_ATTACHMENT_PUBLIC_PREFIX}/${filename}`;
}
