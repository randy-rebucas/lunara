import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DataLoadState } from '../src/components/data-load-state';
import { Card } from '../src/components/ui/card';
import { Screen } from '../src/components/ui/screen';
import { SectionHeader } from '../src/components/ui/section-header';
import { riderFetch } from '../src/api';
import type { RiderPerformanceData } from '../src/lib/rider-types';
import { colors, spacing, typography } from '../src/theme';

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </Card>
  );
}

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

  return (
    <Screen
      inStack
      scroll
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <SectionHeader
        title="Performance"
        hint="Track completion, acceptance, on-time delivery, and customer ratings."
      />

      <View style={styles.grid}>
        <MetricCard label="Completion rate" value={`${data?.completionRate ?? 0}%`} />
        <MetricCard label="Acceptance rate" value={`${data?.acceptanceRate ?? 0}%`} />
        <MetricCard label="On-time delivery" value={`${data?.onTimeDeliveryRate ?? 0}%`} />
        <MetricCard
          label="Customer rating"
          value={data?.customerRating != null ? `${data.customerRating} / 5.0` : '—'}
          hint={
            data?.ratedDeliveries
              ? `${data.ratedDeliveries} rated deliveries`
              : 'No ratings yet'
          }
        />
      </View>

      <Card style={styles.summary}>
        <Text style={styles.summaryTitle}>Activity summary</Text>
        <Text style={styles.summaryLine}>
          Completed tasks: {data?.completedTasks ?? 0} · Cancelled: {data?.cancelledTasks ?? 0}
        </Text>
        <Text style={styles.summaryLine}>
          Accepted assignments: {data?.acceptedAssignments ?? 0} of{' '}
          {data?.totalAssignments ?? 0}
        </Text>
        <Text style={styles.summaryLine}>
          On-time deliveries: {data?.onTimeDeliveries ?? 0}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
    marginTop: spacing.md,
  },
  metricCard: {
    width: '48%',
    flexGrow: 1,
    gap: spacing.xs,
  },
  metricLabel: { ...typography.label },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  metricHint: { ...typography.caption },
  summary: { marginTop: spacing.lg, gap: spacing.sm },
  summaryTitle: { ...typography.subheading, fontSize: 16 },
  summaryLine: { ...typography.bodySm },
});
