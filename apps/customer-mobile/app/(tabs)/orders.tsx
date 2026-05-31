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
import { buildCustomerTimeline, formatCurrency } from '@lunara/utils';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { colors, spacing, typography } from '../../src/theme';
import { DataLoadState } from '../../src/components/data-load-state';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { useOrderRealtimeStore } from '../../src/store/order-realtime';
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
  const tabPadding = useTabScreenPadding();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const realtimeTick = useOrderRealtimeStore((s) => s.tick);
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

  useEffect(() => {
    if (realtimeTick === 0) return;
    load().catch(() => {});
  }, [realtimeTick, load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen inTab padded={false}>
      <View style={styles.header}>
        <Text style={styles.heading}>Order history</Text>
        <Text style={styles.sub}>Track active and past laundry orders</Text>
      </View>

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
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.empty}>Book laundry from Home to get started</Text>
        </Card>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        style={styles.listContainer}
        contentContainerStyle={[styles.list, { paddingBottom: tabPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const { currentStepLabel } = buildCustomerTimeline(item.status);
          return (
          <Pressable onPress={() => router.push(`/orders/${item._id}`)}>
            <Card muted style={styles.card}>
              <View style={styles.cardMain}>
                <Text style={styles.status}>{currentStepLabel}</Text>
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
            </Card>
          </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  heading: { ...typography.title },
  sub: { ...typography.bodySm, marginTop: spacing.xs },
  listContainer: { flex: 1 },
  list: { paddingHorizontal: spacing.xl, gap: spacing.sm, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardMain: { flex: 1, marginRight: spacing.md },
  status: { ...typography.heading, textTransform: 'capitalize' },
  type: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.muted,
    textTransform: 'capitalize',
  },
  branch: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.primaryDark, fontWeight: '500' },
  branchPending: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.warning, fontStyle: 'italic' },
  total: { fontWeight: '700', color: colors.foreground, fontSize: 15 },
  emptyCard: { marginHorizontal: spacing.xl, alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: { ...typography.subheading, marginBottom: spacing.xs },
  empty: { ...typography.bodySm, textAlign: 'center' },
});
