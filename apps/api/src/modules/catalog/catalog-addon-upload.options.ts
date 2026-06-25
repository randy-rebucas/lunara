import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CATALOG_ADDON_UPLOAD_DIR } from '../../common/uploads/upload-paths';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

export const catalogAddonImageUploadOptions = {
  storage: diskStorage({
    destination: CATALOG_ADDON_UPLOAD_DIR,
    filename: (req, file, cb) => {
      const request = req as { params?: { id?: string } };
      const addonId = request.params?.id ?? 'addon';
      const ext = extname(file.originalname).toLowerCase() || '.png';
      cb(null, `${addonId}-${Date.now()}${ext}`);
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
