import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { formatCurrency, RIDER_DELIVERY_PAYOUT, RIDER_PICKUP_PAYOUT, type RiderEarningType } from '@lunara/utils';
import { DataLoadState } from '../src/components/data-load-state';
import { EarningTypeBadge } from '../src/components/earning-type-badge';
import { Card } from '../src/components/ui/card';
import { Screen } from '../src/components/ui/screen';
import { SectionHeader } from '../src/components/ui/section-header';
import { riderFetch } from '../src/api';
import type { EarningsData } from '../src/lib/rider-types';
import { colors, spacing, typography } from '../src/theme';

const PERIOD_KEYS = [
  { key: 'todayEarnings' as const, label: 'Today' },
  { key: 'weekEarnings' as const, label: 'This Week' },
  { key: 'monthEarnings' as const, label: 'This Month' },
  { key: 'lifetimeEarnings' as const, label: 'Lifetime' },
];

export default function EarningsScreen() {
  const [data, setData] = useState<EarningsData>({
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    lifetimeEarnings: 0,
    totalEarnings: 0,
    todayPickups: 0,
    todayDeliveries: 0,
    recentEarnings: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const next = await riderFetch<EarningsData>('/riders/earnings');
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load earnings');
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

  if (loading && !error) {
    return (
      <Screen inStack>
        <DataLoadState loading error="" loadingMessage="Loading earnings…" />
      </Screen>
    );
  }

  if (error && data.recentEarnings.length === 0 && data.lifetimeEarnings === 0) {
    return (
      <Screen inStack>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen inStack>
      <FlatList
        style={styles.list}
        data={data.recentEarnings}
        keyExtractor={(item, i) => `${item.type}-${item.orderId ?? item.note ?? i}-${i}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            <SectionHeader title="Dashboard" hint="Earnings by period" />
            <View style={styles.periodGrid}>
              {PERIOD_KEYS.map((period) => (
                <Card key={period.key} elevated style={styles.periodCard}>
                  <Text style={styles.periodLabel}>{period.label}</Text>
                  <Text style={styles.periodValue}>{formatCurrency(data[period.key])}</Text>
                </Card>
              ))}
            </View>

            <View style={styles.stats}>
              <Card elevated style={styles.stat}>
                <Text style={styles.statValue}>{data.todayPickups}</Text>
                <Text style={styles.statLabel}>Pickups today</Text>
                <Text style={styles.rate}>₱{RIDER_PICKUP_PAYOUT} each</Text>
              </Card>
              <Card elevated style={styles.stat}>
                <Text style={styles.statValue}>{data.todayDeliveries}</Text>
                <Text style={styles.statLabel}>Deliveries today</Text>
                <Text style={styles.rate}>₱{RIDER_DELIVERY_PAYOUT} each</Text>
              </Card>
            </View>

            <SectionHeader title="Earnings breakdown" hint="Per task and adjustments" />
            {error ? <Text style={styles.inlineError}>{error}</Text> : null}
          </>
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowLeft}>
              <EarningTypeBadge type={item.type as RiderEarningType} />
              <Text style={styles.rowMeta}>
                {item.orderId ? `Order ${item.orderId.slice(-6).toUpperCase()}` : item.note ?? 'Manual credit'}
              </Text>
              <Text style={styles.rowDate}>
                {new Date(item.earnedAt).toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={styles.rowAmount}>+{formatCurrency(item.amount)}</Text>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Complete tasks to see earnings here</Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  periodCard: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  periodLabel: { ...typography.caption, textAlign: 'center' },
  periodValue: {
    marginTop: spacing.sm,
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  stats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.foreground },
  statLabel: { marginTop: spacing.xs, ...typography.caption, textAlign: 'center' },
  rate: { marginTop: spacing.xs, fontSize: 11, color: colors.primary, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  rowLeft: { flex: 1, gap: spacing.xs, paddingRight: spacing.md },
  rowMeta: { ...typography.bodySm, color: colors.foreground },
  rowDate: { ...typography.caption },
  rowAmount: { fontWeight: '700', color: colors.accent, fontSize: 16 },
  empty: { ...typography.caption, textAlign: 'center', marginTop: spacing.xxl },
  inlineError: { color: colors.destructive, marginBottom: spacing.sm, fontSize: 13 },
});
