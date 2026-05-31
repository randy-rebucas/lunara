import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';

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

export function buildPhotoFormData(localUri: string, orderId: string): FormData {
  const ext = localUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const formData = new FormData();
  formData.append('photo', {
    uri: localUri,
    name: `${orderId}-${Date.now()}.${ext}`,
    type: ext === 'png' ? 'image/png' : 'image/jpeg',
  } as unknown as Blob);
  return formData;
}
