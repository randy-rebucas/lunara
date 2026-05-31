import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEarningReference, taskEarningReference } from './rider-ops.js';

test('builds and parses task earning references', () => {
  const ref = taskEarningReference('abc123', 'pickup');
  assert.equal(ref, 'earning:pickup:abc123');
  assert.deepEqual(parseEarningReference(ref), { type: 'pickup', id: 'abc123' });
});

test('parses bonus and adjustment references', () => {
  assert.deepEqual(parseEarningReference('earning:bonus:manual-1'), {
    type: 'bonus',
    id: 'manual-1',
  });
  assert.deepEqual(parseEarningReference('earning:adjustment:manual-2'), {
    type: 'adjustment',
    id: 'manual-2',
  });
});

test('rejects invalid earning references', () => {
  assert.equal(parseEarningReference('withdrawal:abc'), null);
  assert.equal(parseEarningReference('earning:invalid:1'), null);
});
