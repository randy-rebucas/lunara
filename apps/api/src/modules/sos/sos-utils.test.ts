import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMapsUrl,
  buildSosAlertPayload,
  isActiveSosOrderStatus,
} from './sos-utils';
import { OrderStatus } from '@lunara/types';

test('isActiveSosOrderStatus accepts in-progress rider statuses', () => {
  assert.equal(isActiveSosOrderStatus(OrderStatus.OUT_FOR_DELIVERY), true);
  assert.equal(isActiveSosOrderStatus(OrderStatus.COMPLETED), false);
});

test('buildSosAlertPayload includes rider_sos type and maps url', () => {
  const payload = buildSosAlertPayload({
    incidentId: 'inc1',
    orderId: 'ord1',
    riderUserId: 'user1',
    riderName: 'Alex',
    lat: 14.5,
    lng: 121.0,
  });
  assert.equal(payload.type, 'rider_sos');
  assert.equal(payload.riderName, 'Alex');
  assert.match(payload.mapsUrl ?? '', /14\.5,121/);
});

test('buildMapsUrl returns undefined without coordinates', () => {
  assert.equal(buildMapsUrl(undefined, 1), undefined);
});
