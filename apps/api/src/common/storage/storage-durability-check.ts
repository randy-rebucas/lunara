import { Logger } from '@nestjs/common';
import { UPLOAD_ROOT } from '../uploads/upload-paths';

const logger = new Logger('StorageDurability');

/**
 * Local disk storage (LocalStorageService) only survives redeploys if UPLOAD_ROOT points at a
 * mounted persistent volume (e.g. a Render disk), and only works correctly with exactly one API
 * instance — a second instance would see a different filesystem and 404 on uploads the first
 * instance wrote. This can't be verified from Node (no reliable "is this a mounted volume" check
 * cross-platform), so it just surfaces the risk loudly at boot rather than failing silently later.
 */
export function warnIfUploadStorageNotPersistent(): void {
  if (process.env.NODE_ENV !== 'production') return;

  if (!process.env.UPLOAD_ROOT?.trim()) {
    logger.warn(
      'UPLOAD_ROOT is not set — uploads default to a path inside the app directory (process.cwd()/uploads), ' +
        'which is almost always wiped on redeploy. Set UPLOAD_ROOT to a mounted persistent volume path.',
    );
  } else {
    logger.log(
      `Uploads are stored at UPLOAD_ROOT=${UPLOAD_ROOT}. Confirm this path is a mounted persistent volume ` +
        '(not ephemeral container storage) and that only one API instance runs at a time — local disk storage ' +
        'does not support horizontal scaling (a second instance cannot see files written by the first).',
    );
  }
}
