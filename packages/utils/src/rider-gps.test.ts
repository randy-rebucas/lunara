import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRiderLocationPayload,
  riderLocationWirePayload,
  RIDER_GPS_UPDATE_INTERVAL_MS,
} from './rider-ops.js';

test('RIDER_GPS_UPDATE_INTERVAL_MS is 15 seconds', () => {
  assert.equal(RIDER_GPS_UPDATE_INTERVAL_MS, 15000);
});

test('normalizeRiderLocationPayload accepts lat/lng aliases', () => {
  const payload = normalizeRiderLocationPayload({
    lat: 14.55,
    lng: 121.02,
    speed: 5.2,
    heading: 90,
    timestamp: '2026-05-31T10:00:00.000Z',
  });
  assert.equal(payload.latitude, 14.55);
  assert.equal(payload.longitude, 121.02);
  assert.equal(payload.speed, 5.2);
  assert.equal(payload.heading, 90);
  assert.equal(payload.timestamp, '2026-05-31T10:00:00.000Z');
});

test('normalizeRiderLocationPayload defaults timestamp and omits invalid heading', () => {
  const payload = normalizeRiderLocationPayload({
    latitude: 1,
    longitude: 2,
    heading: -1,
  });
  assert.ok(payload.timestamp);
  assert.equal(payload.heading, undefined);
});

test('normalizeRiderLocationPayload rejects missing coordinates', () => {
  assert.throws(() => normalizeRiderLocationPayload({ lat: 1 }), /latitude and longitude/);
});

test('riderLocationWirePayload includes aliases', () => {
  const wire = riderLocationWirePayload({
    latitude: 14,
    longitude: 121,
    timestamp: '2026-05-31T10:00:00.000Z',
  });
  assert.equal(wire.lat, 14);
  assert.equal(wire.lng, 121);
  assert.equal(wire.latitude, 14);
  assert.equal(wire.longitude, 121);
});
