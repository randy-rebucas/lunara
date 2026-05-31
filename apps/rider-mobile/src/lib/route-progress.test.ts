import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRouteProgressIndex } from './route-progress';

test('getRouteProgressIndex returns 1 when offline with no work', () => {
  assert.equal(getRouteProgressIndex(false, [], [], []), 1);
});

test('getRouteProgressIndex returns 2 when online with no work', () => {
  assert.equal(getRouteProgressIndex(true, [], [], []), 2);
});

test('getRouteProgressIndex returns 3 when offers exist', () => {
  assert.equal(
    getRouteProgressIndex(true, [{ _id: '1', status: 'x', bookingType: 'standard' }], [], []),
    3,
  );
});

test('getRouteProgressIndex returns 4 when active tasks exist', () => {
  assert.equal(
    getRouteProgressIndex(true, [{ _id: '1', status: 'x', bookingType: 'standard' }], [], [
      { _id: '2', status: 'y', bookingType: 'standard' },
    ]),
    4,
  );
});
