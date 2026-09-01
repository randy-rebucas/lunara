import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from './status-badge';
import { colors, radius, spacing, typography } from '../../theme';
import type { ShiftStatus } from '../../lib/rider-types';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface ShiftPanelProps {
  shiftStatus: ShiftStatus;
  canGoOnline?: boolean;
  busy?: boolean;
  complianceHint?: string;
  onGoOnline: () => void;
  onGoOffline: () => void;
  onStartBreak?: () => void;
  onEndBreak?: () => void;
}

export function ShiftPanel({
  shiftStatus,
  canGoOnline = true,
  busy = false,
  complianceHint,
  onGoOnline,
  onGoOffline,
  onStartBreak,
  onEndBreak,
}: ShiftPanelProps) {
  const online = shiftStatus === 'online';
  const onBreak = shiftStatus === 'break';
  const active = online || onBreak;

  const shiftStartRef = useRef<Date | null>(null);
  const [shiftStartLabel, setShiftStartLabel] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(0);

  useEffect(() => {
    if (active && !shiftStartRef.current) {
      shiftStartRef.current = new Date();
      setShiftStartLabel(formatTime(shiftStartRef.current));
    } else if (!active) {
      shiftStartRef.current = null;
      setShiftStartLabel(null);
      setDurationMinutes(0);
    }
  }, [active]);

  useEffect(() => {
    if (!online) return;
    const tick = () => {
      if (shiftStartRef.current) {
        setDurationMinutes(Math.floor((Date.now() - shiftStartRef.current.getTime()) / 60000));
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [online]);

  const hint = online
    ? "You're visible to dispatch. New tasks will appear below."
    : onBreak
      ? 'On break — you will not receive new assignments until you resume.'
      : canGoOnline
        ? 'Go online to start receiving pickup and delivery assignments.'
        : complianceHint ?? 'Complete your profile and document verification before going online.';

  return (
    <View style={styles.panel}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionLabel}>SHIFT STATUS</Text>
          <StatusBadge shiftStatus={shiftStatus} />
        </View>
        {online ? (
          <Pressable
            style={[styles.goOfflineBtn, busy && styles.actionBtnDisabled]}
            onPress={onGoOffline}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Go offline"
          >
            <Text style={styles.goOfflineBtnText}>Go offline</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.hint}>{hint}</Text>

      {/* Metrics row */}
      {active && shiftStartLabel ? (
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>SHIFT STARTED</Text>
            <Text style={styles.metricValue}>{shiftStartLabel}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>ONLINE DURATION</Text>
            <Text style={styles.metricValue}>{formatDuration(durationMinutes)}</Text>
          </View>
        </View>
      ) : null}

      {/* Action buttons */}
      {online ? (
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.actionBtn}
            onPress={onStartBreak}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Take a break"
          >
            <Ionicons name="cafe-outline" size={17} color={colors.slate700} />
            <Text style={styles.actionBtnText}>Take a break</Text>
          </Pressable>
          <View style={styles.actionDivider} />
          <Pressable
            style={styles.actionBtn}
            onPress={onGoOffline}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="End shift"
          >
            <Ionicons name="stop-circle-outline" size={17} color={colors.destructive} />
            <Text style={[styles.actionBtnText, styles.actionBtnDanger]}>End shift</Text>
          </Pressable>
        </View>
      ) : onBreak ? (
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.actionBtn}
            onPress={onEndBreak}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Resume shift"
          >
            <Ionicons name="play-circle-outline" size={17} color={colors.accentDark} />
            <Text style={[styles.actionBtnText, { color: colors.accentDark }]}>Resume shift</Text>
          </Pressable>
          <View style={styles.actionDivider} />
          <Pressable
            style={styles.actionBtn}
            onPress={onGoOffline}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="End shift"
          >
            <Ionicons name="stop-circle-outline" size={17} color={colors.destructive} />
            <Text style={[styles.actionBtnText, styles.actionBtnDanger]}>End shift</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.startBtn, (!canGoOnline || busy) && styles.startBtnDisabled]}
          onPress={onGoOnline}
          disabled={!canGoOnline || busy}
          accessibilityRole="button"
          accessibilityLabel="Start shift"
        >
          <Ionicons name="power" size={18} color="#fff" />
          <Text style={styles.startBtnText}>Start shift</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionLabel: { ...typography.label, marginBottom: spacing.xs },
  goOfflineBtn: {
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  goOfflineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },

  // ── Hint ──
  hint: {
    ...typography.bodySm,
    marginTop: spacing.md,
    lineHeight: 20,
  },

  // ── Metrics ──
  metricsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  metric: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  metricLabel: { ...typography.label, marginBottom: spacing.xs },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },

  // ── Action buttons ──
  actionsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.md + 2,
  },
  actionDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate700,
  },
  actionBtnDanger: {
    color: colors.destructive,
  },

  // ── Start shift ──
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
  },
  startBtnDisabled: {
    opacity: 0.5,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
