import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus } from '@lunara/types';
import { buildTaskListRows, classifyTask } from './task-list-filters.js';
import type { Task } from './rider-types.js';

test('classifyTask maps pickup offer stage to assigned/accepted/in_progress', () => {
  const assigned: Task = {
    _id: '1',
    status: OrderStatus.RIDER_ASSIGNED_PICKUP,
    bookingType: 'wash_fold',
    leg: 'pickup',
    pickup: {},
  };
  assert.equal(classifyTask(assigned), 'assigned');

  const accepted: Task = {
    ...assigned,
    pickup: { acceptedAt: '2026-05-31T10:00:00.000Z' },
  };
  assert.equal(classifyTask(accepted), 'accepted');

  const active: Task = {
    ...accepted,
    pickup: { ...accepted.pickup, arrivedAt: '2026-05-31T10:05:00.000Z' },
  };
  assert.equal(classifyTask(active), 'in_progress');
});

test('buildTaskListRows groups assigned pickup offers and delivery queue', () => {
  const rows = buildTaskListRows(
    'assigned',
    [{ _id: 'p1', status: 'shop_assigned', bookingType: 'wash_fold' }],
    [{ _id: 'd1', status: 'ready_for_delivery', bookingType: 'wash_fold' }],
    [],
    [],
    [],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.kind, 'pickup_offer');
  assert.equal(rows[1]?.kind, 'delivery_offer');
});
