import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
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
    resourceType: 'image' | 'raw' | 'auto' = 'image',
  ): Promise<UploadApiResponse> {
    return this.upload(buffer, folder, publicId, { resource_type: resourceType });
  }

  /** Uploads with `type: authenticated` — the resulting asset is not publicly fetchable
   * without a signed URL, for sensitive uploads (KYC docs, task photos, remittance proofs). */
  uploadPrivateBuffer(
    buffer: Buffer,
    folder: string,
    publicId?: string,
    resourceType: 'image' | 'raw' | 'auto' = 'image',
  ): Promise<UploadApiResponse> {
    return this.upload(buffer, folder, publicId, { type: 'authenticated', resource_type: resourceType });
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
          reject(
            new InternalServerErrorException(
              err?.message ?? 'Cloudinary upload failed',
            ),
          );
          return;
        }
        resolve(result);
      });

      stream.end(buffer);
    });
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
}
