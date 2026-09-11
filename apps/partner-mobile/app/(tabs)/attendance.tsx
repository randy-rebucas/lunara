import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { AttendanceRecordView } from '@lunara/types';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { StatusPill } from '../../src/components/ui/status-pill';
import { partnerFetch } from '../../src/api';
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

export default function AttendanceScreen() {
  const [current, setCurrent] = useState<AttendanceRecordView | null>(null);
  const [history, setHistory] = useState<AttendanceRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }

  async function clockIn() {
    setBusy(true);
    try {
      await partnerFetch('/attendance/clock-in', { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (e) {
      Alert.alert('Could not clock in', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    setBusy(true);
    try {
      await partnerFetch('/attendance/clock-out', { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (e) {
      Alert.alert('Could not clock out', e instanceof Error ? e.message : 'Please try again.');
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
      <Card elevated primary={!!current} style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: current ? colors.accent : colors.mutedForeground }]} />
          <Text style={styles.statusLabel}>{current ? 'Clocked in' : 'Not clocked in'}</Text>
        </View>
        {current ? (
          <Text style={styles.statusHint}>
            Since {formatTime(current.clockInAt)} · {formatDuration(current.clockInAt)}
          </Text>
        ) : (
          <Text style={styles.statusHint}>Clock in to start your shift.</Text>
        )}
        <Button
          label={current ? 'Clock out' : 'Clock in'}
          variant={current ? 'outline' : 'primary'}
          size="lg"
          icon={current ? 'log-out-outline' : 'log-in-outline'}
          disabled={busy}
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
  statusCard: { marginBottom: spacing.lg, alignItems: 'flex-start' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { ...typography.subheading, fontSize: 17 },
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
