import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lunara/config';
import { formatCurrency, RIDER_DELIVERY_PAYOUT, RIDER_PICKUP_PAYOUT } from '@lunara/utils';
import { riderFetch } from '../src/api';

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
    <View style={styles.container}>
      <Text style={styles.amount}>{formatCurrency(data.todayEarnings)}</Text>
      <Text style={styles.label}>Today&apos;s earnings</Text>
      <Text style={styles.total}>Total: {formatCurrency(data.totalEarnings)}</Text>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{data.todayPickups}</Text>
          <Text style={styles.statLabel}>Pickups today</Text>
          <Text style={styles.rate}>₱{RIDER_PICKUP_PAYOUT} each</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{data.todayDeliveries}</Text>
          <Text style={styles.statLabel}>Deliveries today</Text>
          <Text style={styles.rate}>₱{RIDER_DELIVERY_PAYOUT} each</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent earnings</Text>
      <FlatList
        data={data.recentEarnings}
        keyExtractor={(item, i) => `${item.orderId}-${i}`}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.rowType}>
                {item.type === 'pickup' ? 'Pickup' : 'Delivery'}
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
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Complete tasks to see earnings here</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  amount: { fontSize: 36, fontWeight: '700', color: theme.colors.accent, marginTop: 20 },
  label: { color: '#64748b', marginTop: 8 },
  total: { marginTop: 4, color: theme.colors.primary, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 12, marginTop: 28 },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { marginTop: 4, color: '#64748b', fontSize: 12, textAlign: 'center' },
  rate: { marginTop: 4, fontSize: 11, color: theme.colors.primary },
  sectionTitle: { marginTop: 28, fontWeight: '700', fontSize: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowType: { fontWeight: '600', textTransform: 'capitalize' },
  rowDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  rowAmount: { fontWeight: '700', color: theme.colors.accent },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
});
