import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AttendanceCorrectionRequestView, AttendanceRecordView } from '@lunara/types';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { riderFetch } from '../../src/api';
import { getBestEffortLocation } from '../../src/lib/attendance-location';
import {
  clearPendingAttendanceAction,
  getPendingAttendanceAction,
  setPendingAttendanceAction,
  type PendingAttendanceAction,
} from '../../src/lib/attendance-queue';
import { isOnline } from '../../src/lib/offline/network';
import { colors, radius, spacing, typography } from '../../src/theme';

const TIME_HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(clockInAt: string, clockOutAt?: string) {
  const start = new Date(clockInAt).getTime();
  const end = clockOutAt ? new Date(clockOutAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatHoursShort(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Fallback used only until /attendance/me/target resolves — the real target is set by the
 * partner owner/admin per shop (Branch.portalSettings.dailyAttendanceTargetHours). */
const FALLBACK_TARGET_HOURS = 8;

/** Sums ms worked across all records for `workDate`, counting an open session up to `now`. */
function sumMsForWorkDate(records: AttendanceRecordView[], workDate: string, now: number) {
  return records
    .filter((r) => r.workDate === workDate)
    .reduce((total, r) => {
      const start = new Date(r.clockInAt).getTime();
      const end = r.clockOutAt ? new Date(r.clockOutAt).getTime() : now;
      return total + Math.max(0, end - start);
    }, 0);
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

// ── Current status card ──────────────────────────────────────────────────────

interface StatusCardProps {
  current: AttendanceRecordView | null;
  loading: boolean;
  busy: boolean;
  pending: boolean;
  now: number;
  onClockIn: () => void;
  onClockOut: () => void;
}

function StatusCard({ current, loading, busy, pending, now, onClockIn, onClockOut }: StatusCardProps) {
  return (
    <Card style={styles.statusCard}>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: current ? colors.accent : colors.mutedForeground },
              ]}
            />
            <Text style={styles.statusText}>{current ? 'Clocked in' : 'Not clocked in'}</Text>
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
            disabled={busy || pending}
            onPress={current ? onClockOut : onClockIn}
            style={styles.statusButton}
          />
        </>
      )}
    </Card>
  );
}

// ── Daily total card ─────────────────────────────────────────────────────────

function DailyTotalCard({ todayMs, targetHours }: { todayMs: number; targetHours: number }) {
  const targetMs = targetHours * 3_600_000;
  const progress = Math.min(1, todayMs / targetMs);

  return (
    <Card style={styles.totalCard}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TODAY&apos;S TOTAL</Text>
        <Text style={styles.totalTarget}>Target {targetHours}h</Text>
      </View>
      <Text style={styles.totalValue}>{formatHoursShort(todayMs)}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </Card>
  );
}

// ── History row ───────────────────────────────────────────────────────────────

function timeFromIso(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Combines a shift's calendar `workDate` (YYYY-MM-DD) with a rider-entered "HH:mm" into an ISO
 * instant. Requests are same-day edits, so this is enough without a full date picker. */
function isoFromWorkDateAndTime(workDate: string, hhmm: string): string {
  return new Date(`${workDate}T${hhmm}:00`).toISOString();
}

interface HistoryRowProps {
  record: AttendanceRecordView;
  request?: AttendanceCorrectionRequestView;
  expanded: boolean;
  submitting: boolean;
  onToggle: () => void;
  onSubmit: (clockIn: string, clockOut: string, reason: string) => Promise<boolean>;
}

function RequestStatusPill({ status }: { status: AttendanceCorrectionRequestView['status'] }) {
  const label = status === 'pending' ? 'Adjustment pending' : status === 'approved' ? 'Adjustment approved' : 'Adjustment rejected';
  const color = status === 'pending' ? colors.warning : status === 'approved' ? colors.accentDark : colors.destructive;
  return <Text style={[styles.requestPill, { color }]}>{label}</Text>;
}

function HistoryRow({ record, request, expanded, submitting, onToggle, onSubmit }: HistoryRowProps) {
  const isActive = record.status === 'active';
  const [clockIn, setClockIn] = useState(timeFromIso(record.clockInAt));
  const [clockOut, setClockOut] = useState(record.clockOutAt ? timeFromIso(record.clockOutAt) : '');
  const [reason, setReason] = useState('');
  const canRequest = !isActive && !request;

  async function handleSubmit() {
    const ok = await onSubmit(clockIn, clockOut, reason);
    if (ok) setReason('');
  }

  return (
    <View>
      <View style={styles.historyRow}>
        <View style={[styles.historyIcon, isActive && styles.historyIconActive]}>
          <Ionicons
            name={isActive ? 'time' : 'checkmark-circle'}
            size={16}
            color={isActive ? colors.accentDark : colors.primary}
          />
        </View>
        <View style={styles.historyText}>
          <Text style={styles.historyDay}>{formatDay(record.workDate)}</Text>
          <Text style={styles.historyRange}>
            {formatTime(record.clockInAt)} – {record.clockOutAt ? formatTime(record.clockOutAt) : 'now'}
          </Text>
          {request ? <RequestStatusPill status={request.status} /> : null}
        </View>
        <Text style={styles.historyDuration}>{formatDuration(record.clockInAt, record.clockOutAt)}</Text>
        {canRequest ? (
          <Ionicons
            name={expanded ? 'chevron-up' : 'create-outline'}
            size={18}
            color={colors.mutedForeground}
            onPress={onToggle}
            style={styles.historyRequestIcon}
          />
        ) : null}
      </View>

      {expanded && canRequest ? (
        <View style={styles.requestForm}>
          <View style={styles.requestFormRow}>
            <View style={styles.requestFormField}>
              <Text style={styles.requestFormLabel}>Clock in</Text>
              <TextInput
                value={clockIn}
                onChangeText={setClockIn}
                placeholder="HH:mm"
                placeholderTextColor={colors.mutedForeground}
                style={styles.requestFormInput}
                maxLength={5}
              />
            </View>
            <View style={styles.requestFormField}>
              <Text style={styles.requestFormLabel}>Clock out</Text>
              <TextInput
                value={clockOut}
                onChangeText={setClockOut}
                placeholder="HH:mm"
                placeholderTextColor={colors.mutedForeground}
                style={styles.requestFormInput}
                maxLength={5}
              />
            </View>
          </View>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (e.g. forgot to clock out)"
            placeholderTextColor={colors.mutedForeground}
            style={styles.requestFormReason}
            multiline
          />
          <View style={styles.requestFormActions}>
            <Button label="Cancel" variant="ghost" onPress={onToggle} disabled={submitting} />
            <Button label="Submit request" onPress={handleSubmit} disabled={submitting} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ── Attendance screen ─────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const tabPadding = useTabScreenPadding();
  const [current, setCurrent] = useState<AttendanceRecordView | null>(null);
  const [history, setHistory] = useState<AttendanceRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [targetHours, setTargetHours] = useState(FALLBACK_TARGET_HOURS);
  const [myRequests, setMyRequests] = useState<AttendanceCorrectionRequestView[]>([]);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [pending, setPending] = useState<PendingAttendanceAction | null>(null);

  const load = useCallback(async () => {
    try {
      const [currentRes, historyRes, targetRes, requestsRes] = await Promise.all([
        riderFetch<AttendanceRecordView | null>('/attendance/me/current'),
        riderFetch<AttendanceRecordView[]>('/attendance/me/history?limit=20'),
        riderFetch<{ dailyTargetHours: number }>('/attendance/me/target').catch(() => null),
        riderFetch<AttendanceCorrectionRequestView[]>('/attendance/me/correction-requests').catch(() => []),
      ]);
      setCurrent(currentRes);
      setHistory(historyRes ?? []);
      if (targetRes) setTargetHours(targetRes.dailyTargetHours);
      setMyRequests(requestsRes ?? []);
    } catch {
      setCurrent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Attempts to resend a clock action queued while offline. Left in place (and retried on every
   * load/refresh) until it actually reaches the server — never dropped silently, per the skill's
   * offline-rider-behavior rule. */
  const flushPending = useCallback(async () => {
    const action = await getPendingAttendanceAction();
    if (!action) {
      setPending(null);
      return;
    }
    setPending(action);
    if (!(await isOnline())) return;
    try {
      const path = action.type === 'clock-in' ? '/attendance/clock-in' : '/attendance/clock-out';
      await riderFetch(path, {
        method: 'POST',
        body: JSON.stringify(action.location ? { location: action.location } : {}),
      });
      await clearPendingAttendanceAction();
      setPending(null);
    } catch {
      // Server rejected the queued action (e.g. already clocked in from another device) — drop
      // it rather than retrying forever; the next load() shows the real server state. A network
      // failure (still offline) leaves it queued for the next flush attempt.
      if (await isOnline()) {
        await clearPendingAttendanceAction();
        setPending(null);
      }
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
    await flushPending();
    await load();
    setRefreshing(false);
  }

  async function clockIn() {
    setBusy(true);
    const location = await getBestEffortLocation();
    try {
      if (!(await isOnline())) throw new Error('offline');
      await riderFetch('/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify(location ? { location } : {}),
      });
      await load();
    } catch (e) {
      if (!(await isOnline())) {
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

  const todayWorkDate = current?.workDate ?? new Date().toISOString().slice(0, 10);
  const todayMs = sumMsForWorkDate(history, todayWorkDate, now);

  async function clockOut() {
    setBusy(true);
    const location = await getBestEffortLocation();
    try {
      if (!(await isOnline())) throw new Error('offline');
      await riderFetch('/attendance/clock-out', {
        method: 'POST',
        body: JSON.stringify(location ? { location } : {}),
      });
      await load();
    } catch (e) {
      if (!(await isOnline())) {
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

  const requestByRecordId = new Map(myRequests.map((r) => [r.recordId, r]));

  async function submitCorrectionRequest(
    record: AttendanceRecordView,
    clockIn: string,
    clockOut: string,
    reason: string,
  ): Promise<boolean> {
    if (!TIME_HH_MM.test(clockIn) || (clockOut && !TIME_HH_MM.test(clockOut))) {
      Alert.alert('Invalid time', 'Enter times as HH:mm, e.g. 08:30.');
      return false;
    }
    if (!reason.trim()) {
      Alert.alert('Reason required', 'Let your shop know why this shift needs adjusting.');
      return false;
    }

    setSubmittingRequest(true);
    try {
      await riderFetch('/attendance/me/correction-requests', {
        method: 'POST',
        body: JSON.stringify({
          recordId: record._id,
          requestedClockInAt: isoFromWorkDateAndTime(record.workDate, clockIn),
          requestedClockOutAt: clockOut ? isoFromWorkDateAndTime(record.workDate, clockOut) : undefined,
          reason: reason.trim(),
        }),
      });
      setExpandedRecordId(null);
      await load();
      return true;
    } catch (e) {
      Alert.alert(
        'Could not submit request',
        e instanceof Error ? e.message : 'Please try again.',
      );
      return false;
    } finally {
      setSubmittingRequest(false);
    }
  }

  return (
    <Screen
      inTab
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentStyle={{ paddingBottom: tabPadding }}
    >
      {pending ? (
        <Card style={styles.pendingCard}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.mutedForeground} />
          <Text style={styles.pendingText}>
            {pending.type === 'clock-in' ? 'Clock-in' : 'Clock-out'} queued — will sync once
            you&apos;re back online.
          </Text>
        </Card>
      ) : null}

      <StatusCard
        current={current}
        loading={loading}
        busy={busy}
        pending={!!pending}
        now={now}
        onClockIn={clockIn}
        onClockOut={clockOut}
      />

      {!loading ? <DailyTotalCard todayMs={todayMs} targetHours={targetHours} /> : null}

      <View style={styles.historySection}>
        <Text style={styles.historyLabel}>RECENT SHIFTS</Text>
        {!loading && history.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={22} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No shifts recorded yet.</Text>
          </Card>
        ) : (
          <View style={styles.historyCard}>
            {history.map((record, i) => (
              <View key={record._id}>
                <HistoryRow
                  record={record}
                  request={requestByRecordId.get(record._id)}
                  expanded={expandedRecordId === record._id}
                  submitting={submittingRequest}
                  onToggle={() =>
                    setExpandedRecordId((id) => (id === record._id ? null : record._id))
                  }
                  onSubmit={(clockIn, clockOut, reason) =>
                    submitCorrectionRequest(record, clockIn, clockOut, reason)
                  }
                />
                {i < history.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>
        )}
      </View>
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
  pendingText: { ...typography.caption, flex: 1 },
  statusCard: { alignItems: 'flex-start', marginBottom: spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  timer: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: 1,
    marginTop: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  statusHint: { ...typography.caption, marginTop: spacing.xs, marginBottom: spacing.md },
  statusButton: { alignSelf: 'stretch' },

  totalCard: { marginBottom: spacing.lg },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { ...typography.label },
  totalTarget: { ...typography.caption },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.foreground,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },

  historySection: { marginBottom: spacing.lg },
  historyLabel: { ...typography.label, marginBottom: spacing.sm },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  historyIconActive: { backgroundColor: colors.accentLight },
  historyText: { flex: 1 },
  historyDay: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  historyRange: { ...typography.caption, marginTop: 1 },
  historyDuration: { fontSize: 13, fontWeight: '700', color: colors.mutedForeground },
  historyRequestIcon: { padding: spacing.xs, marginLeft: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 44 },

  requestPill: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  requestForm: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  requestFormRow: { flexDirection: 'row', gap: spacing.md },
  requestFormField: { flex: 1 },
  requestFormLabel: { ...typography.caption, marginBottom: spacing.xs },
  requestFormInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.foreground,
  },
  requestFormReason: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.foreground,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  requestFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },

  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { ...typography.caption },
});
