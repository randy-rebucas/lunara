import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsyncResource } from '../../src/hooks/use-async-resource';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';
import { OrderStatus } from '@lunara/types';
import { buildCustomerTimeline, formatCurrency } from '@lunara/utils';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { colors, radius, spacing, typography } from '../../src/theme';
import { DataLoadState } from '../../src/components/data-load-state';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { useOrderRealtimeStore } from '../../src/store/order-realtime';
import { useAuthStore } from '../../src/store/auth';
import { formatOrderNumber, isActiveOrderStatus } from '../../src/lib/active-order';

interface OrderRow {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
  branchName?: string;
  branchCode?: string;
  estimatedWeightKg?: number;
  items?: { serviceType: string; quantity: number }[];
  scheduledPickupAt?: string;
  scheduledDeliveryAt?: string;
  statusHistory?: { status: string; timestamp: string; note?: string }[];
}

type FilterTab = 'all' | 'ongoing' | 'completed' | 'cancelled';

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const COMPACT_STEPS: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'picked_up', label: 'Picked Up', icon: 'home-outline' },
  { id: 'in_transit_to_shop', label: 'In Transit', icon: 'business-outline' },
  { id: 'received_at_shop', label: 'Received', icon: 'archive-outline' },
  { id: 'processing', label: 'Processing', icon: 'shirt-outline' },
  { id: 'ready_for_delivery', label: 'Ready for\nDelivery', icon: 'bicycle-outline' },
  { id: 'delivered', label: 'Delivered', icon: 'checkmark' },
];

const RIDER_VISIBLE_STATUSES = new Set<string>([
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.RIDER_ASSIGNED_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
]);

function isCompletedStatus(status: string) {
  return status === OrderStatus.COMPLETED || status === OrderStatus.DELIVERED;
}

function isCancelledStatus(status: string) {
  return status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED;
}

function formatItemsSummary(order: OrderRow): string {
  const type = order.bookingType.replace(/_/g, ' ');
  if (order.bookingType === 'dry_cleaning') {
    const pcs = order.items?.reduce((sum, i) => sum + i.quantity, 0);
    return pcs ? `${type} • ${pcs} pcs` : type;
  }
  if (order.estimatedWeightKg) return `${type} • ~${order.estimatedWeightKg} kg`;
  return type;
}

function formatWindow(iso?: string): string {
  if (!iso) return 'TBD';
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
  const start = date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  const end = new Date(date.getTime() + 60 * 60 * 1000).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${day} • ${start} – ${end}`;
}

function formatStamp(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) +
    ', ' +
    new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function OrderStepper({ order }: { order: OrderRow }) {
  const { steps: fullSteps } = buildCustomerTimeline(order.status, order.statusHistory);
  const byId = new Map(fullSteps.map((s) => [s.id, s]));
  const steps = COMPACT_STEPS.map((def) => {
    const match = byId.get(def.id) ?? (def.id === 'received_at_shop' ? byId.get('laundry_received') : undefined);
    return { ...def, state: match?.state ?? 'upcoming', timestamp: match?.timestamp };
  });
  const inset = `${100 / (steps.length * 2)}%` as DimensionValue;
  const doneCount = steps.filter((s) => s.state === 'done' || s.state === 'current').length;
  const fillPercent = steps.length > 1 ? ((doneCount - 1) / (steps.length - 1)) * 100 : 0;
  const fillWidth = `${Math.max(0, Math.min(100, fillPercent))}%` as DimensionValue;

  return (
    <View style={styles.stepperWrap}>
      <View style={[styles.stepperLineTrack, { left: inset, right: inset }]} />
      <View
        style={[
          styles.stepperLineFill,
          { left: inset, width: fillWidth },
        ]}
      />
      <View style={styles.stepperRow}>
        {steps.map((step) => (
          <View key={step.id} style={styles.stepperItem}>
            <View
              style={[
                styles.stepperDot,
                step.state === 'done' && styles.stepperDotDone,
                step.state === 'current' && styles.stepperDotCurrent,
              ]}
            >
              <Ionicons
                name={step.icon}
                size={14}
                color={
                  step.state === 'current'
                    ? colors.onPrimary
                    : step.state === 'done'
                      ? colors.accentDark
                      : colors.mutedForeground
                }
              />
            </View>
            <Text
              style={[
                styles.stepperLabel,
                step.state !== 'upcoming' && styles.stepperLabelActive,
              ]}
            >
              {step.label}
            </Text>
            {step.state === 'current' && step.timestamp ? (
              <Text style={styles.stepperTime}>{formatStamp(step.timestamp)}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const tabPadding = useTabScreenPadding();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const realtimeTick = useOrderRealtimeStore((s) => s.tick);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const fetchOrders = useCallback(
    async () => (await apiFetch<{ items: OrderRow[] }>('/orders')).items,
    [apiFetch],
  );
  const {
    data: ordersData,
    loading,
    error,
    refreshing,
    reload: load,
    onRefresh,
  } = useAsyncResource(fetchOrders, { errorFallback: 'Failed to load orders' });
  const orders = ordersData ?? [];

  useEffect(() => {
    if (realtimeTick === 0) return;
    load().catch(() => {});
  }, [realtimeTick, load]);

  const ongoingOrders = useMemo(() => orders.filter((o) => isActiveOrderStatus(o.status)), [orders]);
  const pastOrders = useMemo(
    () => orders.filter((o) => !isActiveOrderStatus(o.status)),
    [orders],
  );

  const showOngoing = activeTab === 'all' || activeTab === 'ongoing';
  const showPast = activeTab === 'all' || activeTab === 'completed' || activeTab === 'cancelled';
  const pastFiltered = useMemo(() => {
    if (activeTab === 'completed') return pastOrders.filter((o) => isCompletedStatus(o.status));
    if (activeTab === 'cancelled') return pastOrders.filter((o) => isCancelledStatus(o.status));
    return pastOrders;
  }, [pastOrders, activeTab]);

  const spendTowardFreePickup = useMemo(
    () => orders.reduce((sum, o) => sum + (isCancelledStatus(o.status) ? 0 : o.total), 0) % 150,
    [orders],
  );
  const freePickupProgress = Math.min(1, spendTowardFreePickup / 150);
  const freePickupRemaining = Math.max(0, 150 - spendTowardFreePickup);

  const isEmpty =
    !loading &&
    !error &&
    ((showOngoing ? ongoingOrders.length : 0) + (showPast ? pastFiltered.length : 0) === 0);

  return (
    <Screen inTab padded={false}>
      <View style={styles.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {FILTER_TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                accessibilityRole="button"
                accessibilityLabel={`Filter: ${tab.label}`}
                accessibilityState={{ selected }}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.tabChip,
                  selected && styles.tabChipSelected,
                  pressed && styles.tabChipPressed,
                ]}
              >
                <Text style={[styles.tabChipText, selected && styles.tabChipTextSelected]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <DataLoadState
          loading={loading && !refreshing}
          error={error}
          loadingMessage="Loading orders…"
          onRetry={() => {
            load();
          }}
        />

        {isEmpty ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.empty}>Book laundry from Home to get started</Text>
          </Card>
        ) : null}

        {!loading && !error && showOngoing && ongoingOrders.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Ongoing orders</Text>
            <View style={styles.sectionList}>
              {ongoingOrders.map((order) => {
                const { currentStepLabel } = buildCustomerTimeline(order.status, order.statusHistory);
                const showRiderActions = RIDER_VISIBLE_STATUSES.has(order.status as OrderStatus);
                return (
                  <Pressable
                    key={order._id}
                    onPress={() => router.push(`/orders/${order._id}` as Href)}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatOrderNumber(order._id)}, ${currentStepLabel}`}
                    style={({ pressed }) => pressed && styles.cardPressed}
                  >
                    <Card elevated style={styles.ongoingCard}>
                      <View style={styles.ongoingTop}>
                        <View style={styles.thumb}>
                          <Ionicons name="shirt-outline" size={22} color={colors.primary} />
                        </View>
                        <View style={styles.ongoingTopText}>
                          <Text style={styles.orderNumber}>{formatOrderNumber(order._id)}</Text>
                          <View style={styles.statusPill}>
                            <Ionicons name="car-outline" size={12} color={colors.primary} />
                            <Text style={styles.statusPillText}>{currentStepLabel}</Text>
                          </View>
                          <Text style={styles.itemsSummary}>{formatItemsSummary(order)}</Text>
                          <Text style={styles.windowText}>
                            Pickup: {formatWindow(order.scheduledPickupAt)}
                          </Text>
                          <Text style={styles.windowText}>
                            Est. delivery: {formatWindow(order.scheduledDeliveryAt)}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                      </View>

                      <OrderStepper order={order} />

                      {showRiderActions ? (
                        <View style={styles.actionsRow}>
                          <Pressable
                            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                            onPress={() => router.push('/support' as Href)}
                            accessibilityRole="button"
                            accessibilityLabel="Contact rider"
                            hitSlop={4}
                          >
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                            <Text style={styles.actionBtnText}>Contact rider</Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                            onPress={() => router.push(`/orders/${order._id}` as Href)}
                            accessibilityRole="button"
                            accessibilityLabel="View map"
                            hitSlop={4}
                          >
                            <Ionicons name="location-outline" size={16} color={colors.primary} />
                            <Text style={styles.actionBtnText}>View map</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {!loading && !error && showPast && pastFiltered.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Past orders</Text>
            <View style={styles.sectionList}>
              {pastFiltered.map((order) => {
                const cancelled = isCancelledStatus(order.status);
                const delivered = isCompletedStatus(order.status);
                const stampLabel = cancelled ? 'Cancelled' : 'Delivered';
                const stampIso = order.statusHistory?.find((h) =>
                  cancelled ? h.status === OrderStatus.CANCELLED : h.status === OrderStatus.DELIVERED,
                )?.timestamp;

                return (
                  <Pressable
                    key={order._id}
                    onPress={() => router.push(`/orders/${order._id}` as Href)}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatOrderNumber(order._id)}, ${cancelled ? 'Cancelled' : 'Delivered'}`}
                    style={({ pressed }) => pressed && styles.cardPressed}
                  >
                    <Card style={styles.pastCard}>
                      <View
                        style={[
                          styles.thumb,
                          { backgroundColor: cancelled ? colors.surfaceMuted : colors.accentLight },
                        ]}
                      >
                        <Ionicons
                          name="shirt-outline"
                          size={22}
                          color={cancelled ? colors.mutedForeground : colors.accentDark}
                        />
                        {!cancelled ? (
                          <View style={styles.thumbCheck}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.pastMain}>
                        <Text style={styles.orderNumber}>{formatOrderNumber(order._id)}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: cancelled ? colors.surfaceMuted : colors.accentLight },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: cancelled ? colors.mutedForeground : colors.accentDark },
                            ]}
                          >
                            {cancelled ? 'Cancelled' : 'Delivered'}
                          </Text>
                        </View>
                        <Text style={styles.itemsSummary}>{formatItemsSummary(order)}</Text>
                        {stampIso ? (
                          <Text style={styles.windowText}>
                            {stampLabel}: {formatStamp(stampIso)}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.pastRight}>
                        {delivered ? (
                          <Pressable
                            style={({ pressed }) => [styles.reorderBtn, pressed && styles.reorderBtnPressed]}
                            onPress={() => router.push({ pathname: '/book', params: { reorder: order._id } })}
                            accessibilityRole="button"
                            accessibilityLabel="Reorder"
                            hitSlop={4}
                          >
                            <Text style={styles.reorderBtnText}>Reorder</Text>
                          </Pressable>
                        ) : null}
                        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>

            {activeTab === 'all' ? (
              <Pressable
                onPress={() => router.push('/book' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Enjoy free pickup on your next order"
              >
                {({ pressed }) => (
                  <Card style={[styles.promoBanner, pressed && styles.cardPressed]}>
                    <View style={styles.promoIcon}>
                      <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
                    </View>
                    <View style={styles.promoTextCol}>
                      <Text style={styles.promoTitle}>Enjoy free pickup on your next order!</Text>
                      <Text style={styles.promoHint}>
                        You&apos;re only {formatCurrency(freePickupRemaining)} away from unlocking free pickup.
                      </Text>
                      <View style={styles.promoTrack}>
                        <View style={[styles.promoFill, { width: `${freePickupProgress * 100}%` }]} />
                      </View>
                      <Text style={styles.promoAmounts}>
                        {formatCurrency(spendTowardFreePickup)} / {formatCurrency(150)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                  </Card>
                )}
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsRow: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  tabChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabChipPressed: { opacity: 0.85 },
  tabChipText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
  tabChipTextSelected: { color: colors.onPrimary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  sectionTitle: { ...typography.subheading, marginBottom: spacing.md },
  sectionList: { gap: spacing.md, marginBottom: spacing.xl },
  ongoingCard: { borderWidth: 0 },
  ongoingTop: { flexDirection: 'row', gap: spacing.md },
  ongoingTopText: { flex: 1, gap: spacing.xs - 2 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
  },
  orderNumber: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  statusPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 2,
  },
  statusPillText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  itemsSummary: { ...typography.bodySm, textTransform: 'capitalize', marginTop: 2 },
  windowText: { ...typography.caption, marginTop: 1 },
  stepperWrap: { marginTop: spacing.lg, position: 'relative' },
  stepperLineTrack: {
    position: 'absolute',
    top: 16,
    height: 2,
    backgroundColor: colors.border,
  },
  stepperLineFill: {
    position: 'absolute',
    top: 16,
    height: 2,
    backgroundColor: colors.accent,
  },
  stepperRow: { flexDirection: 'row' },
  stepperItem: { flex: 1, alignItems: 'center' },
  stepperDot: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDotDone: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  stepperDotCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepperLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  stepperLabelActive: { color: colors.foreground, fontWeight: '600' },
  stepperTime: { fontSize: 9, color: colors.mutedForeground, marginTop: 1 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
  },
  actionBtnPressed: { opacity: 0.85 },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  cardPressed: { opacity: 0.92 },
  pastCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pastMain: { flex: 1, gap: 2 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  pastRight: { alignItems: 'flex-end', gap: spacing.sm },
  reorderBtn: {
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  reorderBtnPressed: { opacity: 0.85 },
  reorderBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    marginBottom: spacing.lg,
  },
  promoIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTextCol: { flex: 1 },
  promoTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  promoHint: { ...typography.caption, marginTop: 2, marginBottom: spacing.sm },
  promoTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  promoFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  promoAmounts: { ...typography.caption, marginTop: spacing.xs, textAlign: 'right' },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxxl, borderWidth: 0 },
  emptyTitle: { ...typography.subheading, marginBottom: spacing.xs },
  empty: { ...typography.bodySm, textAlign: 'center' },
});
