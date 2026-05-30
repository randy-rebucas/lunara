import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { formatCurrency, formatOrderStatusLabel } from '@lunara/utils';
import { DataLoadState } from '../../src/components/data-load-state';
import { useAuthStore } from '../../src/store/auth';

interface OrderRow {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
  branchName?: string;
  branchCode?: string;
}

export default function OrdersScreen() {
  const router = useRouter();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiFetch<{ items: OrderRow[] }>('/orders');
      setOrders(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

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

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Order history</Text>
      <DataLoadState
        loading={loading && !refreshing}
        error={error}
        loadingMessage="Loading orders…"
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />
      {!loading && !error && orders.length === 0 ? (
        <Text style={styles.empty}>No orders yet — book laundry from Home</Text>
      ) : null}
      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/orders/${item._id}`)}
          >
            <View style={styles.cardMain}>
              <Text style={styles.status}>{formatOrderStatusLabel(item.status)}</Text>
              <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
              {item.branchName ? (
                <Text style={styles.branch}>
                  {item.branchName}
                  {item.branchCode ? ` (${item.branchCode})` : ''}
                </Text>
              ) : (
                <Text style={styles.branchPending}>Partner branch pending assignment</Text>
              )}
            </View>
            <Text style={styles.total}>{formatCurrency(item.total)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    marginBottom: 8,
  },
  cardMain: { flex: 1, marginRight: 12 },
  status: { fontWeight: '600' },
  type: { marginTop: 4, fontSize: 13, color: '#64748b' },
  branch: { marginTop: 6, fontSize: 12, color: '#4338ca' },
  branchPending: { marginTop: 6, fontSize: 12, color: '#b45309', fontStyle: 'italic' },
  total: { fontWeight: '600', color: '#0f172a' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});
