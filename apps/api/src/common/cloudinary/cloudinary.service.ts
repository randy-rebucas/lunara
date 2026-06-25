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
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const opts = publicId
        ? { folder, public_id: publicId, overwrite: true }
        : { folder };

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
}
