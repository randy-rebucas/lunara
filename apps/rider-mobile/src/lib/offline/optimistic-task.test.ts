import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDeliveryStep,
  applyPickupStep,
  inferStepKey,
  isDeliveryStepDone,
  isPickupStepDone,
} from './optimistic-task';

test('inferStepKey maps pickup arrive', () => {
  assert.equal(inferStepKey('/riders/pickup-tasks/abc/arrive', 'POST'), 'pickup:arrive');
});

test('applyPickupStep sets arrivedAt', () => {
  const task = applyPickupStep(
    { _id: 'abc', status: 'rider_assigned_pickup', pickup: { acceptedAt: '2024-01-01' } },
    'pickup:arrive',
  );
  assert.ok(task.pickup?.arrivedAt);
});

test('applyDeliveryStep enables photo capture after customer received', () => {
  const task = applyDeliveryStep(
    { _id: 'abc', status: 'out_for_delivery', delivery: { pickedUpFromShopAt: 'x' } },
    'delivery:customer-received',
  );
  assert.equal(task.customerReceived, true);
  assert.equal(task.canCapturePhoto, true);
});

test('isPickupStepDone detects completed steps', () => {
  const task = { _id: 'a', status: 'picked_up', pickup: { collectedAt: 't' } };
  assert.equal(isPickupStepDone(task, 'pickup:collect'), true);
  assert.equal(isPickupStepDone(task, 'pickup:arrive'), false);
});

test('isDeliveryStepDone detects complete', () => {
  const task = { _id: 'a', status: 'delivered', delivery: { receiptCode: 'DL-1' } };
  assert.equal(isDeliveryStepDone(task, 'delivery:complete'), true);
});
