import { useAuthStore } from './store/auth';
import type { UploadFile } from './lib/upload-file';

/** Authenticated fetch against the API, bearer-token auth via the partner auth store. */
export async function partnerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return useAuthStore.getState().apiFetch<T>(path, init);
}

/** Authenticated multipart upload via expo-file-system's native uploadAsync — see the note on
 * authUpload in store/auth.ts for why this doesn't use fetch+FormData. */
export async function partnerUpload<T>(path: string, file: UploadFile): Promise<T> {
  return useAuthStore.getState().apiUpload<T>(path, file);
}
