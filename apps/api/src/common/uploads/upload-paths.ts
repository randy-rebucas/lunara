import { join } from 'path';

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
export const AVATAR_UPLOAD_DIR = join(UPLOADS_ROOT, 'avatars');
export const AVATAR_PUBLIC_PREFIX = '/api/v1/uploads/avatars';

export function avatarPublicPath(filename: string) {
  return `${AVATAR_PUBLIC_PREFIX}/${filename}`;
}

export function avatarFilePath(filename: string) {
  return join(AVATAR_UPLOAD_DIR, filename);
}
