import { useAuthStore } from './store/auth';
import {
  loadTaskWithCache,
  offlineFetch,
  offlineUpload,
  queueGps,
} from './lib/offline/offline-api';
import { isQueuedResponse, type UploadFile } from './lib/offline/types';

export async function riderFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET';
  if (method === 'GET') {
    return useAuthStore.getState().apiFetch<T>(path, init);
  }
  const result = await offlineFetch<T>(path, init);
  if (isQueuedResponse(result)) {
    return result as unknown as T;
  }
  return result;
}

export async function riderUpload<T>(
  path: string,
  file: UploadFile,
  orderId?: string,
): Promise<T> {
  const result = await offlineUpload<T>(path, file, orderId);
  if (isQueuedResponse(result)) {
    return result as unknown as T;
  }
  return result;
}

export { loadTaskWithCache, queueGps, isQueuedResponse };

/** Chat sends/reads bypass the offline queue used by riderFetch/riderUpload above — a queued
 * message would silently "send" while offline and only actually land on next sync, which is
 * confusing for a live chat. Fail fast instead, same as partner-mobile's partnerFetch/partnerUpload. */
export async function riderMessagingFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return useAuthStore.getState().apiFetch<T>(path, init);
}

export async function riderMessagingUpload<T>(path: string, file: UploadFile): Promise<T> {
  return useAuthStore.getState().apiUpload<T>(path, file);
}

export async function triggerSosNotify(orderId: string, lat?: number, lng?: number) {
  return useAuthStore.getState().apiFetch<{
    incidentId: string;
    dispatchNotified: boolean;
  }>('/riders/sos/notify', {
    method: 'POST',
    body: JSON.stringify({ orderId, lat, lng }),
  });
}

export async function startSosLocationSharing(orderId: string, lat?: number, lng?: number) {
  return useAuthStore.getState().apiFetch<{
    incidentId: string;
    sharingActive: boolean;
  }>('/riders/sos/location/start', {
    method: 'POST',
    body: JSON.stringify({ orderId, lat, lng }),
  });
}

export async function stopSosLocationSharing(orderId: string) {
  return useAuthStore.getState().apiFetch<{
    incidentId: string;
    sharingActive: boolean;
  }>('/riders/sos/location/stop', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  });
}
