import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import type { UploadFile } from './types';

const PHOTO_DIR = `${documentDirectory ?? ''}offline-photos/`;

async function ensureDir() {
  if (!documentDirectory) return;
  const info = await getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

export async function persistPhoto(sourceUri: string, orderId: string): Promise<string> {
  await ensureDir();
  const ext = sourceUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const dest = `${PHOTO_DIR}${orderId}-${Date.now()}.${ext}`;
  await copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function deletePhoto(localUri: string): Promise<void> {
  try {
    const info = await getInfoAsync(localUri);
    if (info.exists) {
      await deleteAsync(localUri, { idempotent: true });
    }
  } catch {
    /* ignore */
  }
}

export function buildPhotoUpload(localUri: string, orderId: string): UploadFile {
  const ext = localUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  return {
    uri: localUri,
    name: `${orderId}-${Date.now()}.${ext}`,
    type: ext === 'png' ? 'image/png' : 'image/jpeg',
    fieldName: 'photo',
  };
}
