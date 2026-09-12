import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lunara_rider_pending_attendance';

export interface PendingAttendanceAction {
  type: 'clock-in' | 'clock-out';
  location?: { lat: number; lng: number };
  queuedAt: string;
}

/** A rider can only ever have one clock action in flight at a time (you can't clock in twice, or
 * clock out before clocking in), so the queue is a single slot rather than a list. Attendance
 * isn't part of the order-workflow offline queue in lib/offline/ (that one is keyed by orderId +
 * WorkflowStepKey), so it gets its own small AsyncStorage slot, mirroring partner-mobile's. */
export async function getPendingAttendanceAction(): Promise<PendingAttendanceAction | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingAttendanceAction) : null;
  } catch {
    return null;
  }
}

export async function setPendingAttendanceAction(action: PendingAttendanceAction): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(action));
}

export async function clearPendingAttendanceAction(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
