import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInvalidFcmTokenError, stringifyPushData } from './push-utils';

test('stringifyPushData converts values to strings', () => {
  const result = stringifyPushData({
    type: 'pickup_offer',
    orderId: 'abc123',
    count: 2,
    skipped: undefined,
  });
  assert.equal(result.type, 'pickup_offer');
  assert.equal(result.orderId, 'abc123');
  assert.equal(result.count, '2');
  assert.equal(result.skipped, undefined);
});

test('isInvalidFcmTokenError detects prune-worthy codes', () => {
  assert.equal(isInvalidFcmTokenError('messaging/registration-token-not-registered'), true);
  assert.equal(isInvalidFcmTokenError('messaging/internal-error'), false);
});
