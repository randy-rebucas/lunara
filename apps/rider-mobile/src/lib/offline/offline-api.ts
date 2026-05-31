import { useAuthStore } from '../../store/auth';
import {
  applyDeliveryStep,
  applyPickupStep,
  extractOrderId,
  inferStepKey,
} from './optimistic-task';
import { isOnline } from './network';
import { buildPhotoFormData, persistPhoto } from './photo-store';
import {
  createQueueId,
  enqueueItem,
  getQueueItems,
} from './queue-store';
import { loadTaskCache, saveTaskCache } from './task-cache';
import type { GpsQueueItem, QueuedResponse, QueueItem, WorkflowStepKey } from './types';
import type { RiderLocationPayload } from '@lunara/utils';
import { locationPatchBody } from '../rider-location';

async function applyOptimisticCache(
  orderId: string,
  stepKey: WorkflowStepKey,
  extras?: { photoLocalUri?: string },
) {
  const pickup = await loadTaskCache<Record<string, unknown>>(orderId);
  if (pickup && 'pickup' in pickup) {
    const next = applyPickupStep(pickup as unknown as Parameters<typeof applyPickupStep>[0], stepKey, extras);
    await saveTaskCache(orderId, next);
    return;
  }
  const delivery = await loadTaskCache<Record<string, unknown>>(orderId);
  if (delivery && ('delivery' in delivery || 'canPickupFromShop' in delivery)) {
    const next = applyDeliveryStep(
      delivery as unknown as Parameters<typeof applyDeliveryStep>[0],
      stepKey,
      extras,
    );
    await saveTaskCache(orderId, next);
  }
}

export async function offlineFetch<T>(path: string, init?: RequestInit): Promise<T | QueuedResponse> {
  const method = init?.method ?? 'GET';
  const online = await isOnline();

  if (method === 'GET' || online) {
    return useAuthStore.getState().apiFetch<T>(path, init);
  }

  const stepKey = inferStepKey(path, method);
  const orderId = extractOrderId(path);
  if (!stepKey || !orderId) {
    throw new Error('Cannot queue this request offline. Reconnect to continue.');
  }

  const item: QueueItem = {
    id: createQueueId(),
    kind: 'status',
    orderId,
    path,
    method,
    body: typeof init?.body === 'string' ? init.body : undefined,
    stepKey,
    createdAt: new Date().toISOString(),
    retries: 0,
  };

  await enqueueItem(item);
  await applyOptimisticCache(orderId, stepKey);
  return { queued: true, itemId: item.id };
}

export async function offlineUpload<T>(
  path: string,
  formData: FormData,
  orderId?: string,
): Promise<T | QueuedResponse> {
  const online = await isOnline();
  const resolvedOrderId = orderId ?? extractOrderId(path);

  if (online) {
    return useAuthStore.getState().apiUpload<T>(path, formData);
  }

  if (!resolvedOrderId) {
    throw new Error('Cannot queue photo offline without order id.');
  }

  const stepKey = inferStepKey(path, 'POST');
  if (!stepKey) {
    throw new Error('Cannot queue this photo offline.');
  }

  const photoPart = formData.get('photo') as { uri?: string } | null;
  const sourceUri = photoPart?.uri;
  if (!sourceUri) {
    throw new Error('Photo data missing.');
  }

  const localUri = await persistPhoto(sourceUri, resolvedOrderId);
  const item: QueueItem = {
    id: createQueueId(),
    kind: 'photo',
    orderId: resolvedOrderId,
    path,
    localUri,
    stepKey,
    createdAt: new Date().toISOString(),
    retries: 0,
  };

  await enqueueItem(item);
  await applyOptimisticCache(resolvedOrderId, stepKey, { photoLocalUri: localUri });
  return { queued: true, itemId: item.id };
}

export async function queueGps(payload: RiderLocationPayload, orderId?: string): Promise<void> {
  const online = await isOnline();
  const body = locationPatchBody(payload);
  const item: GpsQueueItem = {
    id: createQueueId(),
    kind: 'gps',
    orderId,
    lat: payload.latitude,
    lng: payload.longitude,
    speed: payload.speed,
    heading: payload.heading,
    recordedAt: payload.timestamp,
    retries: 0,
    createdAt: new Date().toISOString(),
  };

  if (online) {
    try {
      await useAuthStore.getState().apiFetch('/riders/location', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return;
    } catch {
      /* fall through to queue */
    }
  }

  await enqueueItem(item);
}

export async function loadTaskWithCache<T>(
  path: string,
  orderId: string,
): Promise<{ data: T; fromCache: boolean }> {
  try {
    const data = await useAuthStore.getState().apiFetch<T>(path);
    await saveTaskCache(orderId, data);
    return { data, fromCache: false };
  } catch (e) {
    const cached = await loadTaskCache<T>(orderId);
    if (cached) {
      return { data: cached, fromCache: true };
    }
    throw e;
  }
}

export { getQueueItems };
