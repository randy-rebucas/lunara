import { useAuthStore } from './store/auth';
import {
  loadTaskWithCache,
  offlineFetch,
  offlineUpload,
  queueGps,
} from './lib/offline/offline-api';
import { isQueuedResponse } from './lib/offline/types';

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
  formData: FormData,
  orderId?: string,
): Promise<T> {
  const result = await offlineUpload<T>(path, formData, orderId);
  if (isQueuedResponse(result)) {
    return result as unknown as T;
  }
  return result;
}

export { loadTaskWithCache, queueGps, isQueuedResponse };

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
