import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAdminRealtimeConnected } from './admin-realtime';

describe('admin-realtime', () => {
  it('starts disconnected before any subscriber', () => {
    assert.equal(isAdminRealtimeConnected(), false);
  });
});
