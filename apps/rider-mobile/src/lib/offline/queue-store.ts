import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GpsQueueItem, PhotoQueueItem, QueueItem, StatusQueueItem } from './types';
import { GPS_QUEUE_CAP } from './types';

const STORAGE_KEY = 'lunara_rider_offline_queue';

type QueueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let storageOverride: QueueStorage | null = null;

function getStorage(): QueueStorage {
  return storageOverride ?? AsyncStorage;
}

type Listener = () => void;

let cache: QueueItem[] | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

async function loadQueue(): Promise<QueueItem[]> {
  if (cache) return cache;
  try {
    const raw = await getStorage().getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function saveQueue(items: QueueItem[]) {
  cache = items;
  await getStorage().setItem(STORAGE_KEY, JSON.stringify(items));
  notify();
}

export function subscribeQueue(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getQueueItems(): Promise<QueueItem[]> {
  return [...(await loadQueue())];
}

export async function getPendingCount(): Promise<number> {
  return (await loadQueue()).length;
}

export async function getPendingCountForOrder(orderId: string): Promise<number> {
  return (await loadQueue()).filter((item) => {
    if (item.kind === 'gps') return item.orderId === orderId;
    return item.orderId === orderId;
  }).length;
}

export async function enqueueItem(item: QueueItem): Promise<void> {
  const items = await loadQueue();
  let next = [...items, item];

  const gpsCount = next.filter((i) => i.kind === 'gps').length;
  if (gpsCount > GPS_QUEUE_CAP) {
    const nonGps = next.filter((i) => i.kind !== 'gps');
    const gps = next.filter((i) => i.kind === 'gps').slice(-GPS_QUEUE_CAP);
    next = [...nonGps, ...gps];
  }

  await saveQueue(next);
}

export async function removeItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const set = new Set(ids);
  const items = await loadQueue();
  await saveQueue(items.filter((item) => !set.has(item.id)));
}

export async function incrementRetry(id: string): Promise<void> {
  const items = await loadQueue();
  await saveQueue(
    items.map((item) => (item.id === id ? { ...item, retries: item.retries + 1 } : item)),
  );
}

export function createQueueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Test helper — reset in-memory cache. */
export function resetQueueCacheForTests() {
  cache = null;
}

export function setQueueStorageForTests(storage: QueueStorage | null) {
  storageOverride = storage;
  cache = null;
}

export async function clearQueueForTests() {
  cache = [];
  await getStorage().removeItem(STORAGE_KEY);
}

export function collapseGpsItems(items: GpsQueueItem[]): GpsQueueItem[] {
  const latestByOrder = new Map<string, GpsQueueItem>();
  const general: GpsQueueItem[] = [];

  for (const item of items) {
    const key = item.orderId ?? '__general__';
    if (key === '__general__') {
      general.push(item);
      continue;
    }
    const existing = latestByOrder.get(key);
    if (!existing || item.recordedAt > existing.recordedAt) {
      latestByOrder.set(key, item);
    }
  }

  return [...general.slice(-1), ...latestByOrder.values()];
}

export async function getGpsItems(): Promise<GpsQueueItem[]> {
  return (await loadQueue()).filter((i): i is GpsQueueItem => i.kind === 'gps');
}

export function groupQueueByKind(items: QueueItem[]) {
  return {
    status: items.filter((i): i is StatusQueueItem => i.kind === 'status'),
    photo: items.filter((i): i is PhotoQueueItem => i.kind === 'photo'),
    gps: items.filter((i): i is GpsQueueItem => i.kind === 'gps'),
  };
}
