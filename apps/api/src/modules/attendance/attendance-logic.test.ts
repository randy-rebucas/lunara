import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidCorrection,
  computeSessionHours,
  InvalidAttendanceCorrectionError,
  workDateFor,
} from './attendance-logic';

test('workDateFor anchors to Asia/Manila (UTC+8), not UTC', () => {
  // 2026-03-04T17:30:00Z is 2026-03-05 01:30 in Manila — should roll to the next workday.
  const utcLateNight = new Date('2026-03-04T17:30:00Z');
  assert.equal(workDateFor(utcLateNight), '2026-03-05');

  // 2026-03-04T10:00:00Z is 2026-03-04 18:00 in Manila — same day.
  const utcAfternoon = new Date('2026-03-04T10:00:00Z');
  assert.equal(workDateFor(utcAfternoon), '2026-03-04');
});

test('computeSessionHours rounds to 1 decimal for a completed session', () => {
  const clockIn = new Date('2026-03-04T08:00:00Z');
  const clockOut = new Date('2026-03-04T12:15:00Z'); // 4h15m = 4.25h -> 4.3 (banker-ish rounding via Math.round)
  assert.equal(computeSessionHours(clockIn, clockOut), 4.3);
});

test('computeSessionHours handles an active (no clock-out) session against "now"', () => {
  const now = Date.now();
  const clockIn = new Date(now - 2 * 3_600_000); // 2 hours ago
  const hours = computeSessionHours(clockIn);
  assert.ok(hours >= 1.9 && hours <= 2.1, `expected ~2h, got ${hours}`);
});

test('assertValidCorrection accepts clock-out after clock-in', () => {
  const clockIn = new Date('2026-03-04T08:00:00Z');
  const clockOut = new Date('2026-03-04T16:00:00Z');
  assert.doesNotThrow(() => assertValidCorrection(clockIn, clockOut));
});

test('assertValidCorrection accepts an undefined clock-out (still-active session)', () => {
  const clockIn = new Date('2026-03-04T08:00:00Z');
  assert.doesNotThrow(() => assertValidCorrection(clockIn, undefined));
});

test('assertValidCorrection rejects clock-out before clock-in', () => {
  const clockIn = new Date('2026-03-04T16:00:00Z');
  const clockOut = new Date('2026-03-04T08:00:00Z');
  assert.throws(() => assertValidCorrection(clockIn, clockOut), InvalidAttendanceCorrectionError);
});

test('assertValidCorrection rejects clock-out exactly equal to clock-in only when strictly earlier', () => {
  const same = new Date('2026-03-04T08:00:00Z');
  // Equal timestamps are a degenerate (zero-length) session, not an inverted one — allowed.
  assert.doesNotThrow(() => assertValidCorrection(same, new Date(same)));
});
