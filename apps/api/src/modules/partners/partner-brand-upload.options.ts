import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PARTNER_BRAND_UPLOAD_DIR } from '../../common/uploads/upload-paths';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/svg+xml']);

export const partnerBrandAssetUploadOptions = {
  storage: diskStorage({
    destination: PARTNER_BRAND_UPLOAD_DIR,
    filename: (req, file, cb) => {
      const request = req as { params?: { id?: string; field?: string } };
      const partnerId = request.params?.id ?? 'partner';
      const field = request.params?.field ?? 'asset';
      const ext = extname(file.originalname).toLowerCase() || '.png';
      cb(null, `${partnerId}-${field}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, ok: boolean) => void,
  ) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, WebP, or SVG images are allowed'), false);
      return;
    }
    cb(null, true);
  },
};
