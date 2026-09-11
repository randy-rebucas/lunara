/** Pure attendance domain logic — kept free of Mongoose/Nest so it's cheaply unit-testable.
 * AttendanceService wraps these for DB-backed operations. */

/** Attendance's workday is anchored to Asia/Manila (UTC+8) regardless of device timezone,
 * since every partner in this system currently operates in that timezone. */
export const WORKDAY_OFFSET_MS = 8 * 60 * 60 * 1000;

export function workDateFor(at: Date): string {
  const shifted = new Date(at.getTime() + WORKDAY_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/** Hours between clock-in and clock-out (or now, for an active session), rounded to 1 decimal. */
export function computeSessionHours(clockInAt: Date, clockOutAt?: Date): number {
  const end = clockOutAt ?? new Date();
  const hours = (end.getTime() - clockInAt.getTime()) / 3_600_000;
  return Math.round(hours * 10) / 10;
}

export class InvalidAttendanceCorrectionError extends Error {}

/** Validates a partner correction against the invariant "clock-out cannot occur before
 * clock-in" before it reaches the database. Throws InvalidAttendanceCorrectionError, which the
 * controller/service layer maps to a 400 — kept independent of any HTTP framework so it stays
 * testable in isolation. */
export function assertValidCorrection(clockInAt: Date, clockOutAt: Date | undefined): void {
  if (clockOutAt && clockOutAt.getTime() < clockInAt.getTime()) {
    throw new InvalidAttendanceCorrectionError('Clock-out cannot be before clock-in');
  }
}
