import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { buildCustomerTimeline, formatOrderStatusLabel } from '@lunara/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
  formatEstimatedDelivery,
  formatOrderNumber,
} from '../lib/active-order';
import type { HomeOrderRow } from '../hooks/use-home-dashboard';
import { colors, radius, spacing, typography } from '../theme';

interface HomeActiveOrdersProps {
  orders: HomeOrderRow[];
  loading?: boolean;
}

export function HomeActiveOrders({ orders, loading }: HomeActiveOrdersProps) {
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>Active orders</Text>
        <Card muted style={styles.loadingCard}>
          <Text style={styles.muted}>Loading orders…</Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Active orders</Text>
        {orders.length > 0 ? (
          <Pressable onPress={() => router.push('/(tabs)/orders')} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        ) : null}
      </View>

      {orders.length === 0 ? (
        <Card muted style={styles.emptyCard}>
          <Ionicons name="shirt-outline" size={28} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No active orders</Text>
          <Text style={styles.muted}>Book laundry to see live status here.</Text>
          <Button label="Book laundry" onPress={() => router.push('/book')} style={styles.emptyBtn} />
        </Card>
      ) : (
        <View style={styles.list}>
          {orders.slice(0, 3).map((order) => {
            const { currentStepLabel } = buildCustomerTimeline(order.status);
            return (
              <Card key={order._id} style={styles.orderCard}>
                <View style={styles.orderRow}>
                  <View style={styles.orderThumb}>
                    <Ionicons name="shirt-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.orderMain}>
                    <View style={styles.orderTop}>
                      <Text style={styles.orderNumber}>{formatOrderNumber(order._id)}</Text>
                      <Text style={styles.orderType}>{order.bookingType.replace(/_/g, ' ')}</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Ionicons name="car-outline" size={11} color={colors.primary} />
                      <Text style={styles.status}>{currentStepLabel}</Text>
                    </View>
                    <Text style={styles.meta}>
                      {formatOrderStatusLabel(order.status)} ·{' '}
                      {formatEstimatedDelivery(order.scheduledDeliveryAt)}
                    </Text>
                  </View>
                </View>
                <Button
                  label="Track order"
                  variant="outline"
                  onPress={() => router.push(`/orders/${order._id}` as Href)}
                  style={styles.trackBtn}
                />
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...typography.subheading, fontSize: 17 },
  seeAll: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  list: { gap: spacing.sm },
  orderCard: { gap: spacing.sm },
  orderRow: { flexDirection: 'row', gap: spacing.md },
  orderThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderMain: { flex: 1, gap: spacing.xs - 2 },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  orderNumber: { fontFamily: 'monospace', fontWeight: '700', color: colors.primary },
  orderType: { ...typography.caption, textTransform: 'capitalize', flex: 1, textAlign: 'right' },
  statusPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  status: { fontSize: 12, fontWeight: '700', color: colors.primary },
  meta: { ...typography.caption, textTransform: 'capitalize' },
  trackBtn: { marginTop: spacing.sm },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyTitle: { fontWeight: '600', fontSize: 16 },
  emptyBtn: { marginTop: spacing.sm, alignSelf: 'stretch' },
  loadingCard: { padding: spacing.lg, alignItems: 'center' },
  muted: { ...typography.bodySm, textAlign: 'center', color: colors.muted },
});
