import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

// SVG intentionally excluded: it can embed <script>/event-handler payloads and these
// assets are served publicly, so accepting it would be a stored-XSS vector.
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

export const userPhotoUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, ok: boolean) => void,
  ) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, or WebP images are allowed'), false);
      return;
    }
    cb(null, true);
  },
};
