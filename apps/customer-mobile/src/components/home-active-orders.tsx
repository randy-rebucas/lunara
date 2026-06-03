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
                <View style={styles.orderTop}>
                  <Text style={styles.orderNumber}>{formatOrderNumber(order._id)}</Text>
                  <Text style={styles.orderType}>{order.bookingType.replace(/_/g, ' ')}</Text>
                </View>
                <Text style={styles.status}>{currentStepLabel}</Text>
                <Text style={styles.meta}>
                  {formatOrderStatusLabel(order.status)} ·{' '}
                  {formatEstimatedDelivery(order.scheduledDeliveryAt)}
                </Text>
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
  orderCard: { gap: spacing.xs },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  orderNumber: { fontFamily: 'monospace', fontWeight: '700', color: colors.primary },
  orderType: { ...typography.caption, textTransform: 'capitalize', flex: 1, textAlign: 'right' },
  status: { ...typography.heading, fontSize: 16, marginTop: spacing.xs },
  meta: { ...typography.caption, textTransform: 'capitalize' },
  trackBtn: { marginTop: spacing.sm },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyTitle: { fontWeight: '600', fontSize: 16 },
  emptyBtn: { marginTop: spacing.sm, alignSelf: 'stretch' },
  loadingCard: { padding: spacing.lg, alignItems: 'center' },
  muted: { ...typography.bodySm, textAlign: 'center', color: colors.muted },
});
