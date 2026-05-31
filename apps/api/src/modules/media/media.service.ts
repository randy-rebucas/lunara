import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { createReadStream, existsSync } from 'fs';
import { extname } from 'path';
import {
  riderDocumentFilePath,
  taskPhotoFilePath,
} from '../../common/uploads/upload-paths';

type MediaCategory = 'rider-documents' | 'task-photos';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

@Injectable()
export class MediaService {
  resolveFile(category: MediaCategory, filename: string) {
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new NotFoundException('File not found');
    }

    const filePath =
      category === 'rider-documents'
        ? riderDocumentFilePath(filename)
        : taskPhotoFilePath(filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    const ext = extname(filename).toLowerCase();
    return {
      stream: createReadStream(filePath),
      contentType: MIME_BY_EXT[ext] ?? 'application/octet-stream',
    };
  }

  assertAccess(
    category: MediaCategory,
    filename: string,
    user: { sub: string; role: UserRole },
  ) {
    if (user.role === UserRole.ADMIN) return;

    const ownerPrefix = `${user.sub}-`;
    if (!filename.startsWith(ownerPrefix)) {
      throw new ForbiddenException('Access denied');
    }

    if (category === 'rider-documents' && user.role !== UserRole.RIDER) {
      throw new ForbiddenException('Access denied');
    }

    if (
      category === 'task-photos' &&
      user.role !== UserRole.RIDER &&
      user.role !== UserRole.PARTNER &&
      user.role !== UserRole.STAFF
    ) {
      throw new ForbiddenException('Access denied');
    }
  }
}
