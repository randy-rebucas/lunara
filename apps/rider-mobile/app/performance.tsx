import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DataLoadState } from '../src/components/data-load-state';
import { Screen } from '../src/components/ui/screen';
import { riderFetch } from '../src/api';
import type { RiderPerformanceData } from '../src/lib/rider-types';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Ring meter ────────────────────────────────────────────────────────────────

function RingMeter({
  value,
  label,
  icon,
  iconBg,
  iconColor,
  valueColor,
  hint,
}: {
  value: string;
  label: string;
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
  valueColor: string;
  hint?: string;
}) {
  return (
    <View style={ringStyles.card}>
      <View style={[ringStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[ringStyles.value, { color: valueColor }]}>{value}</Text>
      <Text style={ringStyles.label}>{label}</Text>
      {hint ? <Text style={ringStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

const ringStyles = StyleSheet.create({
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'flex-start',
    gap: spacing.xs,
    ...shadow.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: { ...typography.label },
  hint: { ...typography.caption },
});

// ── Stat row ──────────────────────────────────────────────────────────────────

function StatRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: IoniconName;
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <View style={statStyles.row}>
      <Ionicons name={icon} size={16} color={colors.mutedForeground} style={statStyles.icon} />
      <Text style={statStyles.label}>{label}</Text>
      <Text style={[statStyles.value, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  icon: { marginRight: spacing.md },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});

function StatDivider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 36 }} />;
}

// ── Performance screen ────────────────────────────────────────────────────────

export default function PerformanceScreen() {
  const [data, setData] = useState<RiderPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const next = await riderFetch<RiderPerformanceData>('/riders/performance');
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load performance');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !data) {
    return (
      <Screen inStack>
        <DataLoadState loading error="" loadingMessage="Loading performance…" />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen inStack>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  const rating = data?.customerRating;
  const ratingDisplay = rating != null ? `${rating.toFixed(1)} / 5` : '—';
  const ratedCount = data?.ratedDeliveries ?? 0;

  // The backend reports 100% for a zero-denominator rate (e.g. a brand-new rider with no
  // completed/cancelled tasks yet, or no assignments offered yet) so "no data" doesn't read as
  // a failing score — but showing that 100% at face value here would misleadingly look like an
  // earned rate. Fall back to "—" client-side using the counts we already have.
  const hasCompletionData = (data?.completedTasks ?? 0) + (data?.cancelledTasks ?? 0) > 0;
  const completionRateDisplay = hasCompletionData ? `${data?.completionRate ?? 0}%` : '—';
  const hasAssignmentData = (data?.totalAssignments ?? 0) > 0;
  const acceptanceRateDisplay = hasAssignmentData ? `${data?.acceptanceRate ?? 0}%` : '—';

  return (
    <Screen
      inStack
      scroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Performance</Text>
        <Text style={styles.pageSubtitle}>
          Track your completion, acceptance, and on-time delivery rates.
        </Text>
      </View>

      {/* ── Key metrics grid ── */}
      <View style={styles.grid}>
        <RingMeter
          icon="checkmark-circle-outline"
          iconBg={colors.accentLight}
          iconColor={colors.accentDark}
          value={completionRateDisplay}
          valueColor={colors.accentDark}
          label="Completion rate"
        />
        <RingMeter
          icon="hand-right-outline"
          iconBg={colors.primaryLight}
          iconColor={colors.primary}
          value={acceptanceRateDisplay}
          valueColor={colors.primary}
          label="Acceptance rate"
        />
        <RingMeter
          icon="timer-outline"
          iconBg={colors.secondaryLight}
          iconColor={colors.secondaryDark}
          value={`${data?.onTimeDeliveryRate ?? 0}%`}
          valueColor={colors.secondaryDark}
          label="On-time delivery"
        />
        <RingMeter
          icon="star-outline"
          iconBg={colors.warningBg}
          iconColor={colors.warning}
          value={ratingDisplay}
          valueColor={colors.warning}
          label="Customer rating"
          hint={ratedCount > 0 ? `${ratedCount} rated deliveries` : 'No ratings yet'}
        />
      </View>

      {/* ── Activity summary ── */}
      <Text style={styles.sectionLabel}>ACTIVITY SUMMARY</Text>
      <View style={styles.summaryCard}>
        <StatRow
          icon="bicycle-outline"
          label="Completed tasks"
          value={data?.completedTasks ?? 0}
          valueColor={colors.accentDark}
        />
        <StatDivider />
        <StatRow
          icon="close-circle-outline"
          label="Cancelled tasks"
          value={data?.cancelledTasks ?? 0}
          valueColor={data?.cancelledTasks ? colors.destructive : colors.mutedForeground}
        />
        <StatDivider />
        <StatRow
          icon="checkmark-done-outline"
          label="Accepted assignments"
          value={`${data?.acceptedAssignments ?? 0} of ${data?.totalAssignments ?? 0}`}
        />
        <StatDivider />
        <StatRow
          icon="time-outline"
          label="On-time deliveries"
          value={data?.onTimeDeliveries ?? 0}
          valueColor={colors.secondaryDark}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: spacing.xl,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    ...typography.bodySm,
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
});
