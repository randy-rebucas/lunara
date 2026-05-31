import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  notificationRouteToPath,
  resolveNotificationRoute,
} from './notification-types';
import { nextStep, prevStep, BOOKING_STEPS } from './booking-flow';

test('resolveNotificationRoute maps review requests to review screen', () => {
  const route = resolveNotificationRoute({
    _id: '1',
    title: 'Review',
    body: 'Rate your order',
    read: false,
    createdAt: new Date().toISOString(),
    data: { type: 'review_request', orderId: 'ord-1' },
  });
  assert.deepEqual(route, { kind: 'review', orderId: 'ord-1' });
  assert.equal(notificationRouteToPath(route!), '/review/ord-1');
});

test('resolveNotificationRoute prefers refund detail when refundId present', () => {
  const route = resolveNotificationRoute({
    _id: '2',
    title: 'Refund',
    body: 'Update',
    read: false,
    createdAt: new Date().toISOString(),
    data: { type: 'refund_update', refundId: 'ref-9', orderId: 'ord-1' },
  });
  assert.deepEqual(route, { kind: 'refund', refundId: 'ref-9' });
  assert.equal(notificationRouteToPath(route!), '/refunds/ref-9');
});

test('booking-flow steps advance and retreat', () => {
  assert.equal(nextStep('service'), 'address');
  assert.equal(prevStep('address'), 'service');
  assert.equal(nextStep('confirm'), null);
  assert.equal(prevStep('service'), null);
  assert.equal(BOOKING_STEPS.length, 7);
});
