import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearQueueForTests,
  collapseGpsItems,
  createQueueId,
  enqueueItem,
  getQueueItems,
  groupQueueByKind,
  resetQueueCacheForTests,
  setQueueStorageForTests,
} from './queue-store';
import type { GpsQueueItem, QueueItem } from './types';

test('collapseGpsItems keeps latest per orderId', () => {
  const items: GpsQueueItem[] = [
    {
      id: '1',
      kind: 'gps',
      orderId: 'o1',
      lat: 1,
      lng: 2,
      recordedAt: '2024-01-01T10:00:00Z',
      createdAt: '2024-01-01T10:00:00Z',
      retries: 0,
    },
    {
      id: '2',
      kind: 'gps',
      orderId: 'o1',
      lat: 3,
      lng: 4,
      recordedAt: '2024-01-01T10:05:00Z',
      createdAt: '2024-01-01T10:05:00Z',
      retries: 0,
    },
  ];
  const collapsed = collapseGpsItems(items);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0]?.lat, 3);
});

test('groupQueueByKind separates item types', () => {
  const items: QueueItem[] = [
    {
      id: '1',
      kind: 'status',
      orderId: 'o1',
      path: '/x',
      method: 'POST',
      stepKey: 'pickup:arrive',
      createdAt: 't',
      retries: 0,
    },
    {
      id: '2',
      kind: 'gps',
      lat: 1,
      lng: 2,
      recordedAt: 't',
      createdAt: 't',
      retries: 0,
    },
  ];
  const grouped = groupQueueByKind(items);
  assert.equal(grouped.status.length, 1);
  assert.equal(grouped.gps.length, 1);
});

test('enqueue persists queue across cache reset', async () => {
  const memory = new Map<string, string>();
  setQueueStorageForTests({
    getItem: async (key) => memory.get(key) ?? null,
    setItem: async (key, value) => {
      memory.set(key, value);
    },
    removeItem: async (key) => {
      memory.delete(key);
    },
  });

  await clearQueueForTests();

  const item: QueueItem = {
    id: createQueueId(),
    kind: 'status',
    orderId: 'order-1',
    path: '/riders/pickup/order-1/arrive',
    method: 'POST',
    stepKey: 'pickup:arrive',
    createdAt: new Date().toISOString(),
    retries: 0,
  };

  await enqueueItem(item);
  assert.equal((await getQueueItems()).length, 1);

  resetQueueCacheForTests();
  const reloaded = await getQueueItems();
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0]?.id, item.id);
  assert.equal(reloaded[0]?.orderId, 'order-1');

  await clearQueueForTests();
  setQueueStorageForTests(null);
});
