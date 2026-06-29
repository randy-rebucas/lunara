import { existsSync, mkdirSync } from 'fs';
import {
  AVATAR_UPLOAD_DIR,
  CATALOG_ADDON_UPLOAD_DIR,
  MESSAGE_ATTACHMENT_UPLOAD_DIR,
  PARTNER_BRAND_UPLOAD_DIR,
  REMITTANCE_PROOF_UPLOAD_DIR,
  RIDER_DOCUMENT_UPLOAD_DIR,
  TASK_PHOTO_UPLOAD_DIR,
  UPLOADS_ROOT,
} from './upload-paths';

export function ensureUploadDirectories() {
  if (!existsSync(UPLOADS_ROOT)) {
    mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
  if (!existsSync(AVATAR_UPLOAD_DIR)) {
    mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
  }
  if (!existsSync(TASK_PHOTO_UPLOAD_DIR)) {
    mkdirSync(TASK_PHOTO_UPLOAD_DIR, { recursive: true });
  }
  if (!existsSync(RIDER_DOCUMENT_UPLOAD_DIR)) {
    mkdirSync(RIDER_DOCUMENT_UPLOAD_DIR, { recursive: true });
  }
  if (!existsSync(CATALOG_ADDON_UPLOAD_DIR)) {
    mkdirSync(CATALOG_ADDON_UPLOAD_DIR, { recursive: true });
  }
  if (!existsSync(PARTNER_BRAND_UPLOAD_DIR)) {
    mkdirSync(PARTNER_BRAND_UPLOAD_DIR, { recursive: true });
  }
  if (!existsSync(REMITTANCE_PROOF_UPLOAD_DIR)) {
    mkdirSync(REMITTANCE_PROOF_UPLOAD_DIR, { recursive: true });
  }
  if (!existsSync(MESSAGE_ATTACHMENT_UPLOAD_DIR)) {
    mkdirSync(MESSAGE_ATTACHMENT_UPLOAD_DIR, { recursive: true });
  }
}
