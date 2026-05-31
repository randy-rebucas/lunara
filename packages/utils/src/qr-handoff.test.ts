import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHandoffQrPayload,
  HANDOFF_QR_KIND,
  parseHandoffQrPayload,
} from './qr-handoff.js';

test('builds and parses customer pickup QR payload', () => {
  const raw = buildHandoffQrPayload(HANDOFF_QR_KIND.CUSTOMER_PICKUP, 'abc123', '5678');
  assert.equal(raw, 'lunara|v1|customer_pickup|abc123|5678');
  assert.deepEqual(parseHandoffQrPayload(raw), {
    version: 'v1',
    kind: 'customer_pickup',
    orderId: 'abc123',
    secret: '5678',
  });
});

test('parses order handover payload', () => {
  const raw = buildHandoffQrPayload(HANDOFF_QR_KIND.ORDER_HANDOVER, 'order1', 'PU-ABC-1234');
  const parsed = parseHandoffQrPayload(raw);
  assert.equal(parsed?.kind, 'order_handover');
  assert.equal(parsed?.secret, 'PU-ABC-1234');
});

test('rejects invalid payloads', () => {
  assert.equal(parseHandoffQrPayload(''), null);
  assert.equal(parseHandoffQrPayload('lunara|v1|unknown|id|code'), null);
  assert.equal(parseHandoffQrPayload('not-lunara|v1|customer_pickup|id|code'), null);
});
