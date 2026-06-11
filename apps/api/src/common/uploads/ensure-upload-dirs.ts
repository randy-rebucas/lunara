import { existsSync, mkdirSync } from 'fs';
import {
  AVATAR_UPLOAD_DIR,
  CATALOG_ADDON_UPLOAD_DIR,
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
}
