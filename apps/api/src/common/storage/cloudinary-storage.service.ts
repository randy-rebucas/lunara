import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface UploadResult {
  /** Fully-qualified URL — only populated for public uploads. */
  secure_url: string;
  /** Cloudinary public_id (including folder prefix) the file was stored under. */
  public_id: string;
}

type ResourceType = 'image' | 'raw' | 'auto';

@Injectable()
export class CloudinaryStorageService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  uploadBuffer(
    buffer: Buffer,
    folder: string,
    publicId?: string,
    resourceType: ResourceType = 'image',
    _mimetype?: string,
  ): Promise<UploadResult> {
    return this.upload(buffer, folder, publicId, { resource_type: resourceType }).then(toUploadResult);
  }

  /** Uploads with `type: authenticated` — the resulting asset is only fetchable via a signed URL,
   * for sensitive uploads (KYC docs, task photos, remittance proofs, application documents). */
  uploadPrivateBuffer(
    buffer: Buffer,
    folder: string,
    publicId?: string,
    resourceType: ResourceType = 'image',
    _mimetype?: string,
  ): Promise<UploadResult> {
    return this.upload(buffer, folder, publicId, { type: 'authenticated', resource_type: resourceType }).then(
      (result) => ({ public_id: result.public_id, secure_url: '' }),
    );
  }

  /**
   * Deletes a previously uploaded asset so replacing/clearing an upload doesn't leak orphaned
   * assets on Cloudinary. `filenameOrUrl` may be a bare public_id or a full `secure_url` returned
   * by `uploadBuffer` — both are accepted since callers store either depending on the field.
   * Missing assets are ignored; this is best-effort cleanup, not something that should fail the request.
   */
  async deleteFile(
    folder: string,
    filenameOrUrl: string | undefined | null,
    visibility: 'public' | 'private' = 'public',
    resourceType: 'image' | 'raw' = 'image',
  ): Promise<void> {
    if (!filenameOrUrl) return;
    const publicId = this.resolvePublicId(folder, filenameOrUrl);
    try {
      await cloudinary.uploader.destroy(publicId, {
        type: visibility === 'private' ? 'authenticated' : 'upload',
        resource_type: resourceType,
      });
    } catch {
      // best-effort: ignore missing assets or API issues
    }
  }

  /** Builds a short-lived signed URL for an `authenticated`-type asset uploaded via uploadPrivateBuffer(). */
  getSignedUrl(publicId: string, resourceType: 'image' | 'raw' = 'image'): string {
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
    return cloudinary.url(publicId, {
      type: 'authenticated',
      sign_url: true,
      resource_type: resourceType,
      secure: true,
      expires_at: expiresAt,
    });
  }

  /**
   * A full `secure_url` embeds `<folder>/<public_id>.<ext>` after `/upload/vNNN/` (public assets)
   * or `/authenticated/vNNN/` (private assets). A bare filename/public_id is used as-is, prefixed
   * with `folder/` if it isn't already folder-qualified.
   */
  private resolvePublicId(folder: string, filenameOrUrl: string): string {
    const uploadMatch = filenameOrUrl.match(/\/(?:upload|authenticated)\/v\d+\/(.+)$/);
    const withoutVersionPrefix = uploadMatch ? uploadMatch[1] : filenameOrUrl;
    const withoutExtension = withoutVersionPrefix.replace(/\.[a-zA-Z0-9]+$/, '');
    if (withoutExtension.includes('/')) {
      return withoutExtension;
    }
    return `${folder}/${withoutExtension}`;
  }

  private upload(
    buffer: Buffer,
    folder: string,
    publicId?: string,
    extra?: Record<string, unknown>,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const opts = {
        folder,
        ...(publicId ? { public_id: publicId, overwrite: true } : {}),
        ...extra,
      };

      const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
        if (err || !result) {
          reject(new InternalServerErrorException(err?.message ?? 'Cloudinary upload failed'));
          return;
        }
        resolve(result);
      });

      stream.end(buffer);
    });
  }
}

function toUploadResult(result: UploadApiResponse): UploadResult {
  return { secure_url: result.secure_url, public_id: result.public_id };
}
