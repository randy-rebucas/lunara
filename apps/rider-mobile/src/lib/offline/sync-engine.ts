import { useAuthStore } from '../../store/auth';
import {
  isAlreadyDoneError,
  isDeliveryStepDone,
  isPickupStepDone,
  type DeliveryTaskLike,
  type PickupTaskLike,
} from './optimistic-task';
import { buildPhotoFormData, deletePhoto } from './photo-store';
import {
  collapseGpsItems,
  getQueueItems,
  groupQueueByKind,
  incrementRetry,
  removeItems,
} from './queue-store';
import { removeTaskCache } from './task-cache';
import type { GpsQueueItem, PhotoQueueItem, QueueItem, StatusQueueItem } from './types';

let syncing = false;
let syncListeners = new Set<(syncing: boolean) => void>();

function setSyncing(value: boolean) {
  syncing = value;
  syncListeners.forEach((fn) => fn(value));
}

export function subscribeSyncing(listener: (syncing: boolean) => void) {
  syncListeners.add(listener);
  listener(syncing);
  return () => {
    syncListeners.delete(listener);
  };
}

export function isSyncing(): boolean {
  return syncing;
}

async function fetchTaskState(orderId: string): Promise<PickupTaskLike | DeliveryTaskLike | null> {
  try {
    const pickup = await useAuthStore.getState().apiFetch<PickupTaskLike>(
      `/riders/pickup-tasks/${orderId}`,
    );
    return pickup;
  } catch {
    /* not pickup */
  }
  try {
    const delivery = await useAuthStore.getState().apiFetch<DeliveryTaskLike>(
      `/riders/delivery-tasks/${orderId}`,
    );
    return delivery;
  } catch {
    return null;
  }
}

function isStepDoneOnServer(
  task: PickupTaskLike | DeliveryTaskLike,
  stepKey: StatusQueueItem['stepKey'] | PhotoQueueItem['stepKey'],
): boolean {
  if ('pickup' in task && task.pickup !== undefined) {
    return isPickupStepDone(task as PickupTaskLike, stepKey);
  }
  return isDeliveryStepDone(task as DeliveryTaskLike, stepKey);
}

async function processStatusItem(item: StatusQueueItem): Promise<'done' | 'retry' | 'stop'> {
  const task = await fetchTaskState(item.orderId);
  if (task && isStepDoneOnServer(task, item.stepKey)) {
    return 'done';
  }

  try {
    await useAuthStore.getState().apiFetch(item.path, {
      method: item.method,
      body: item.body,
    });
    await removeTaskCache(item.orderId);
    return 'done';
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (isAlreadyDoneError(message)) {
      return 'done';
    }
    if (message.includes('Cannot reach API')) {
      return 'stop';
    }
    await incrementRetry(item.id);
    return 'retry';
  }
}

async function processPhotoItem(item: PhotoQueueItem): Promise<'done' | 'retry' | 'stop'> {
  const task = await fetchTaskState(item.orderId);
  if (task && isStepDoneOnServer(task, item.stepKey)) {
    await deletePhoto(item.localUri);
    return 'done';
  }

  try {
    const formData = buildPhotoFormData(item.localUri, item.orderId);
    await useAuthStore.getState().apiUpload(item.path, formData);
    await deletePhoto(item.localUri);
    await removeTaskCache(item.orderId);
    return 'done';
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (isAlreadyDoneError(message)) {
      await deletePhoto(item.localUri);
      return 'done';
    }
    if (message.includes('Cannot reach API')) {
      return 'stop';
    }
    await incrementRetry(item.id);
    return 'retry';
  }
}

async function processGpsBatch(items: GpsQueueItem[]): Promise<'done' | 'stop'> {
  const collapsed = collapseGpsItems(items);
  try {
    for (const point of collapsed) {
      await useAuthStore.getState().apiFetch('/riders/location', {
        method: 'PATCH',
        body: JSON.stringify({
          lat: point.lat,
          lng: point.lng,
          latitude: point.lat,
          longitude: point.lng,
          speed: point.speed,
          heading: point.heading,
          timestamp: point.recordedAt,
        }),
      });
    }
    return 'done';
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message.includes('Cannot reach API')) {
      return 'stop';
    }
    return 'done';
  }
}

export async function runSync(): Promise<{ synced: number; remaining: number }> {
  if (syncing) {
    return { synced: 0, remaining: await getQueueItems().then((q) => q.length) };
  }

  setSyncing(true);
  let synced = 0;

  try {
    const items = await getQueueItems();
    const gpsItems = items.filter((i): i is GpsQueueItem => i.kind === 'gps');
    const nonGps = items.filter((i) => i.kind !== 'gps');

    if (gpsItems.length > 0) {
      const gpsResult = await processGpsBatch(gpsItems);
      if (gpsResult === 'done') {
        await removeItems(gpsItems.map((i) => i.id));
        synced += gpsItems.length;
      } else {
        return { synced, remaining: items.length };
      }
    }

    for (const item of nonGps) {
      let result: 'done' | 'retry' | 'stop';
      if (item.kind === 'status') {
        result = await processStatusItem(item);
      } else {
        result = await processPhotoItem(item);
      }

      if (result === 'stop') {
        break;
      }
      if (result === 'done') {
        await removeItems([item.id]);
        synced += 1;
      }
    }
  } finally {
    setSyncing(false);
  }

  const remaining = await getQueueItems().then((q) => q.length);
  return { synced, remaining };
}

/** Test export */
export function resetSyncListenersForTests() {
  syncListeners = new Set();
  syncing = false;
}
