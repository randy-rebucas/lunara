import { existsSync, mkdirSync } from 'fs';
import { AVATAR_UPLOAD_DIR, UPLOADS_ROOT } from './upload-paths';

export function ensureUploadDirectories() {
  if (!existsSync(UPLOADS_ROOT)) {
    mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
  if (!existsSync(AVATAR_UPLOAD_DIR)) {
    mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
  }
}
