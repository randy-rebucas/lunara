import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { AttendanceRecordView } from '@lunara/types';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { StatusPill } from '../../src/components/ui/status-pill';
import { partnerFetch } from '../../src/api';
import { getBestEffortLocation } from '../../src/lib/attendance-location';
import {
  clearPendingAttendanceAction,
  getPendingAttendanceAction,
  setPendingAttendanceAction,
  type PendingAttendanceAction,
} from '../../src/lib/attendance-queue';
import { NetworkUnreachableError } from '../../src/lib/network-error';
import { colors, radius, spacing, typography } from '../../src/theme';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(clockInAt: string, clockOutAt?: string) {
  const end = clockOutAt ? new Date(clockOutAt) : new Date();
  const ms = end.getTime() - new Date(clockInAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** HH:MM:SS elapsed since clockInAt, against `now` — `now` is passed in so the caller's ticking
 * clock (not Date.now() read at render time) drives re-renders every second. */
function formatDurationHMS(clockInAt: string, now: number) {
  const ms = Math.max(0, now - new Date(clockInAt).getTime());
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export default function AttendanceScreen() {
  const [current, setCurrent] = useState<AttendanceRecordView | null>(null);
  const [history, setHistory] = useState<AttendanceRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState<PendingAttendanceAction | null>(null);

  const load = useCallback(async () => {
    try {
      const [currentRes, historyRes] = await Promise.all([
        partnerFetch<AttendanceRecordView | null>('/attendance/me/current'),
        partnerFetch<AttendanceRecordView[]>('/attendance/me/history?limit=20'),
      ]);
      setCurrent(currentRes);
      setHistory(historyRes);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Attempts to resend a clock action queued while offline. Left in place (and retried on
   * every load/refresh) until it actually reaches the server — never dropped silently. */
  const flushPending = useCallback(async () => {
    const action = await getPendingAttendanceAction();
    if (!action) {
      setPending(null);
      return false;
    }
    setPending(action);
    try {
      const path = action.type === 'clock-in' ? '/attendance/clock-in' : '/attendance/clock-out';
      await partnerFetch(path, {
        method: 'POST',
        body: JSON.stringify(action.location ? { location: action.location } : {}),
      });
      await clearPendingAttendanceAction();
      setPending(null);
      return true;
    } catch (e) {
      if (e instanceof NetworkUnreachableError) return false;
      // Server rejected the queued action (e.g. already clocked in from another device) —
      // drop it rather than retrying forever; the next load() shows the real server state.
      await clearPendingAttendanceAction();
      setPending(null);
      return false;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await flushPending();
      await load();
    })();
  }, [flushPending, load]);

  useEffect(() => {
    if (!current) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [current]);

  async function onRefresh() {
    setRefreshing(true);
    await flushPending().catch(() => {});
    await load().catch(() => {});
    setRefreshing(false);
  }

  async function clockIn() {
    setBusy(true);
    const location = await getBestEffortLocation();
    try {
      await partnerFetch('/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify(location ? { location } : {}),
      });
      await load();
    } catch (e) {
      if (e instanceof NetworkUnreachableError) {
        const action: PendingAttendanceAction = {
          type: 'clock-in',
          location,
          queuedAt: new Date().toISOString(),
        };
        await setPendingAttendanceAction(action);
        setPending(action);
      } else {
        Alert.alert('Could not clock in', e instanceof Error ? e.message : 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    setBusy(true);
    const location = await getBestEffortLocation();
    try {
      await partnerFetch('/attendance/clock-out', {
        method: 'POST',
        body: JSON.stringify(location ? { location } : {}),
      });
      await load();
    } catch (e) {
      if (e instanceof NetworkUnreachableError) {
        const action: PendingAttendanceAction = {
          type: 'clock-out',
          location,
          queuedAt: new Date().toISOString(),
        };
        await setPendingAttendanceAction(action);
        setPending(action);
      } else {
        Alert.alert('Could not clock out', e instanceof Error ? e.message : 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Screen inTab centered>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen
      inTab
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {pending ? (
        <Card muted style={styles.pendingCard}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.mutedForeground} />
          <Text style={styles.pendingText}>
            {pending.type === 'clock-in' ? 'Clock-in' : 'Clock-out'} queued — will sync once
            you&apos;re back online.
          </Text>
        </Card>
      ) : null}

      <Card elevated primary={!!current} style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: current ? colors.accent : colors.mutedForeground }]} />
          <Text style={styles.statusLabel}>{current ? 'Clocked in' : 'Not clocked in'}</Text>
        </View>
        {current ? (
          <>
            <Text style={styles.timer}>{formatDurationHMS(current.clockInAt, now)}</Text>
            <Text style={styles.statusHint}>Since {formatTime(current.clockInAt)}</Text>
          </>
        ) : (
          <Text style={styles.statusHint}>Clock in to start your shift.</Text>
        )}
        <Button
          label={current ? 'Clock out' : 'Clock in'}
          variant={current ? 'outline' : 'primary'}
          size="lg"
          icon={current ? 'log-out-outline' : 'log-in-outline'}
          disabled={busy || !!pending}
          onPress={current ? clockOut : clockIn}
          style={styles.actionButton}
        />
      </Card>

      <Text style={styles.sectionLabel}>RECENT SHIFTS</Text>
      {history.length === 0 ? (
        <Card muted>
          <Text style={styles.emptyText}>No attendance history yet.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {history.map((r) => (
            <Card key={r._id} style={styles.historyRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyDate}>{r.workDate}</Text>
                <Text style={styles.historyTime}>
                  {formatTime(r.clockInAt)} – {r.clockOutAt ? formatTime(r.clockOutAt) : 'now'}
                </Text>
              </View>
              <StatusPill
                label={r.status === 'active' ? 'Active' : formatDuration(r.clockInAt, r.clockOutAt)}
                kind={r.status === 'active' ? 'accent' : 'neutral'}
              />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pendingText: { ...typography.bodySm, flex: 1 },
  statusCard: { marginBottom: spacing.lg, alignItems: 'flex-start' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { ...typography.subheading, fontSize: 17 },
  timer: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: 1,
    marginTop: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  statusHint: { ...typography.bodySm, marginTop: spacing.xs, marginBottom: spacing.lg },
  actionButton: { alignSelf: 'stretch' },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },
  emptyText: { ...typography.bodySm },
  list: { gap: spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDate: { ...typography.subheading, fontSize: 14 },
  historyTime: { ...typography.caption, marginTop: 2 },
});
