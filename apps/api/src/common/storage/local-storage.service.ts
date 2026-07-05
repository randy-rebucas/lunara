import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

export interface UploadResult {
  /** Fully-qualified URL — only populated for public uploads. */
  secure_url: string;
  /** Filename (including extension) the file was stored under. */
  public_id: string;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

@Injectable()
export class LocalStorageService {
  private readonly uploadRoot: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.uploadRoot = process.env.UPLOAD_ROOT ?? join(process.cwd(), 'uploads');
    this.publicBaseUrl = process.env.API_URL ?? 'http://localhost:3001';
  }

  uploadBuffer(
    buffer: Buffer,
    folder: string,
    publicId?: string,
    _resourceType: 'image' | 'raw' | 'auto' = 'image',
    mimetype?: string,
  ): Promise<UploadResult> {
    return this.write('public', folder, buffer, publicId, mimetype).then((filename) => {
      const category = this.stripFolderPrefix(folder);
      return {
        public_id: filename,
        secure_url: `${this.publicBaseUrl}/api/v1/uploads/public/${category}/${filename}`,
      };
    });
  }

  /** Stores the file under the private root — only fetchable via MediaController's access-gated stream. */
  uploadPrivateBuffer(
    buffer: Buffer,
    folder: string,
    publicId?: string,
    _resourceType: 'image' | 'raw' | 'auto' = 'image',
    mimetype?: string,
  ): Promise<UploadResult> {
    return this.write('private', folder, buffer, publicId, mimetype).then((filename) => ({
      public_id: filename,
      secure_url: '',
    }));
  }

  /** Resolves an absolute path for a private-category file, guarding against path traversal. */
  resolvePrivatePath(folder: string, filename: string): string {
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new NotFoundException('File not found');
    }
    const category = this.stripFolderPrefix(folder);
    const dir = resolve(join(this.uploadRoot, 'private', category));
    const filePath = resolve(join(dir, filename));
    if (!filePath.startsWith(dir)) {
      throw new NotFoundException('File not found');
    }
    return filePath;
  }

  private stripFolderPrefix(folder: string): string {
    return folder.startsWith('lunara/') ? folder.slice('lunara/'.length) : folder;
  }

  private async write(
    visibility: 'public' | 'private',
    folder: string,
    buffer: Buffer,
    publicId?: string,
    mimetype?: string,
  ): Promise<string> {
    const category = this.stripFolderPrefix(folder);
    const dir = join(this.uploadRoot, visibility, category);
    const id = publicId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = mimetype ? (MIME_EXTENSIONS[mimetype] ?? '') : '';
    const filename = `${id}${ext}`;

    try {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, filename), buffer);
    } catch (err) {
      throw new InternalServerErrorException((err as Error).message ?? 'Local upload failed');
    }

    return filename;
  }
}
