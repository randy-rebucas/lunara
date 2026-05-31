import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { formatCurrency, RIDER_DELIVERY_PAYOUT, RIDER_PICKUP_PAYOUT } from '@lunara/utils';
import { Card } from '../src/components/ui/card';
import { Screen } from '../src/components/ui/screen';
import { SectionHeader } from '../src/components/ui/section-header';
import { TaskTypeBadge } from '../src/components/ui/task-type-badge';
import { riderFetch } from '../src/api';
import { colors, spacing, typography } from '../src/theme';

interface EarningsData {
  totalEarnings: number;
  todayEarnings: number;
  todayPickups: number;
  todayDeliveries: number;
  recentEarnings: {
    type: 'pickup' | 'delivery';
    amount: number;
    orderId: string;
    earnedAt: string;
  }[];
}

export default function EarningsScreen() {
  const [data, setData] = useState<EarningsData>({
    totalEarnings: 0,
    todayEarnings: 0,
    todayPickups: 0,
    todayDeliveries: 0,
    recentEarnings: [],
  });

  useEffect(() => {
    riderFetch<EarningsData>('/riders/earnings')
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <Screen inStack>
      <View style={styles.hero}>
        <Text style={styles.amount}>{formatCurrency(data.todayEarnings)}</Text>
        <Text style={styles.label}>Today&apos;s earnings</Text>
        <Text style={styles.total}>Total: {formatCurrency(data.totalEarnings)}</Text>
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

      <SectionHeader title="Recent earnings" />
      <FlatList
        style={styles.list}
        data={data.recentEarnings}
        keyExtractor={(item, i) => `${item.orderId}-${i}`}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowLeft}>
              <TaskTypeBadge type={item.type === 'pickup' ? 'pickup' : 'delivery'} />
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
  hero: { marginTop: spacing.lg, marginBottom: spacing.sm },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: -0.5,
  },
  label: { ...typography.bodySm, marginTop: spacing.sm },
  total: { marginTop: spacing.xs, color: colors.primary, fontWeight: '600', fontSize: 15 },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
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
  rowLeft: { gap: spacing.xs },
  rowDate: { ...typography.caption, marginTop: 2 },
  rowAmount: { fontWeight: '700', color: colors.accent, fontSize: 16 },
  empty: { ...typography.caption, textAlign: 'center', marginTop: spacing.xxl },
  list: { flex: 1 },
});
