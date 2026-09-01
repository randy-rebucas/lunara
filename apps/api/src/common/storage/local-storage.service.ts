import { existsSync, mkdirSync, promises as fs } from 'fs';
import { join } from 'path';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UPLOAD_ROOT } from '../uploads/upload-paths';

export interface UploadResult {
  /** Fully-qualified URL — only populated for public uploads. */
  secure_url: string;
  /** Storage key (folder/filename, no extension) the file was stored under — mirrors Cloudinary's
   * public_id shape so callers written against that interface don't need to change. */
  public_id: string;
}

type ResourceType = 'image' | 'raw' | 'auto';

const EXTENSION_BY_MIMETYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

function extensionFor(mimetype?: string): string {
  if (!mimetype) return 'bin';
  if (EXTENSION_BY_MIMETYPE[mimetype]) return EXTENSION_BY_MIMETYPE[mimetype];
  const subtype = mimetype.split('/')[1];
  return subtype?.replace(/[^a-z0-9]/gi, '') || 'bin';
}

function apiOrigin(): string {
  return process.env.API_URL ?? 'http://localhost:3001';
}

/** Local-disk counterpart of the (now retired) CloudinaryStorageService, backed by
 * apps/api/uploads. Public files live under UPLOAD_ROOT/public and are served by the
 * ServeStaticModule mounted at /api/v1/uploads/public in app.module.ts. Private files live under
 * UPLOAD_ROOT/private, outside that static root, and are only ever reachable through
 * MediaController after an explicit access check. */
@Injectable()
export class LocalStorageService {
  uploadBuffer(
    buffer: Buffer,
    folder: string,
    publicId?: string,
    _resourceType: ResourceType = 'image',
    mimetype?: string,
  ): Promise<UploadResult> {
    return this.write(buffer, 'public', folder, publicId, mimetype).then(({ key, filename }) => ({
      public_id: key,
      secure_url: `${apiOrigin()}/api/v1/uploads/public/${folder}/${filename}`,
    }));
  }

  /** Writes to UPLOAD_ROOT/private instead of the publicly-served tree — the resulting file is
   * only reachable via MediaController's JWT-gated routes, not a bare URL. */
  uploadPrivateBuffer(
    buffer: Buffer,
    folder: string,
    publicId?: string,
    _resourceType: ResourceType = 'image',
    mimetype?: string,
  ): Promise<UploadResult> {
    return this.write(buffer, 'private', folder, publicId, mimetype).then(({ key }) => ({
      public_id: key,
      secure_url: '',
    }));
  }

  /**
   * Deletes a previously uploaded file so replacing/clearing an upload doesn't leak orphaned
   * files on disk. `filenameOrUrl` may be a bare filename/public_id or a full URL returned by
   * uploadBuffer — both are accepted since callers store either depending on the field.
   * Missing files are ignored; this is best-effort cleanup, not something that should fail the request.
   */
  async deleteFile(
    folder: string,
    filenameOrUrl: string | undefined | null,
    visibility: 'public' | 'private' = 'public',
  ): Promise<void> {
    if (!filenameOrUrl) return;
    const filename = this.resolveFilename(folder, filenameOrUrl);
    const path = join(UPLOAD_ROOT, visibility, folder, filename);
    try {
      await fs.unlink(path);
    } catch {
      // best-effort: ignore missing files or fs issues
    }
  }

  /** Returns the absolute path of a file previously stored via uploadPrivateBuffer(), for
   * MediaController to stream directly after its own JWT/ownership check — there is no meaningful
   * "signed URL" concept for local disk, unlike Cloudinary's authenticated delivery. */
  resolvePrivatePath(folder: string, filename: string): string {
    return join(UPLOAD_ROOT, 'private', folder, filename);
  }

  private resolveFilename(folder: string, filenameOrUrl: string): string {
    const afterUploadsPrefix = filenameOrUrl.match(/\/uploads\/(?:public|private)\/(.+)$/);
    const withoutOrigin = afterUploadsPrefix ? afterUploadsPrefix[1] : filenameOrUrl;
    const withoutFolder = withoutOrigin.startsWith(`${folder}/`)
      ? withoutOrigin.slice(folder.length + 1)
      : withoutOrigin;
    return withoutFolder.split('/').pop() ?? withoutFolder;
  }

  private async write(
    buffer: Buffer,
    visibility: 'public' | 'private',
    folder: string,
    publicId: string | undefined,
    mimetype: string | undefined,
  ): Promise<{ key: string; filename: string }> {
    const dir = join(UPLOAD_ROOT, visibility, folder);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const ext = extensionFor(mimetype);
    const stem = publicId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const filename = `${stem}.${ext}`;
    try {
      await fs.writeFile(join(dir, filename), buffer);
    } catch (err) {
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Local upload failed',
      );
    }
    return { key: `${folder}/${stem}`, filename };
  }
}
