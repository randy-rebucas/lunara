import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@lunara/types';
import {
  buildCustomerTimeline,
  formatCashTimingLabel,
  formatCurrency,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
  formatPaymentStatusLabel,
} from '@lunara/utils';
import { Button } from '../../src/components/ui/button';
import { colors, radius, spacing, typography } from '../../src/theme';
import { useOrderTrackingSocket } from '../../src/hooks/use-order-tracking-socket';
import { DataLoadState } from '../../src/components/data-load-state';
import { OrderTimeline } from '../../src/components/order-timeline';
import { HandoffQrCard } from '../../src/components/handoff-qr-card';
import { branchTypeLabel } from '../../src/components/nearest-branches';
import { useAuthStore } from '../../src/store/auth';

interface OrderDetail {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
  estimatedWeightKg?: number;
  scheduledPickupAt?: string;
  branchName?: string;
  branchCode?: string;
  pickup?: { receiptCode?: string };
  delivery?: { receiptCode?: string; signatureName?: string };
  statusHistory: { status: string; timestamp: string; note?: string }[];
  paymentMethod?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentReceiptCode?: string;
  cashTiming?: 'pickup' | 'delivery';
}

interface DeliveryUiState {
  needsVerify: boolean;
  needsSign: boolean;
}

interface LiveNotification {
  id: string;
  message: string;
  at: string;
}

function openMaps(lat: number, lng: number) {
  const url = Platform.select({
    ios: `http://maps.apple.com/?ll=${lat},${lng}`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  });
  if (url) void Linking.openURL(url);
}

export default function OrderTrackScreen() {
  const router = useRouter();
  const { id, booked } = useLocalSearchParams<{ id: string; booked?: string }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [deliveryUi, setDeliveryUi] = useState<DeliveryUiState | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [deliveryError, setDeliveryError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const justBooked = booked === '1';

  const notificationSeq = useRef(0);
  const bookedBannerShown = useRef(false);

  const pushNotification = useCallback((message: string) => {
    notificationSeq.current += 1;
    const notifId = `${Date.now()}-${notificationSeq.current}`;
    setNotifications((prev) => [
      { id: notifId, message, at: new Date().toISOString() },
      ...prev.slice(0, 14),
    ]);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError('');
    try {
      const data = await apiFetch<OrderDetail>(`/orders/${id}`);
      setOrder(data);

      if (
        data.status === OrderStatus.OUT_FOR_DELIVERY ||
        data.status === OrderStatus.RIDER_ASSIGNED_DELIVERY
      ) {
        try {
          const ui = await apiFetch<DeliveryUiState>(`/orders/${id}/delivery`);
          setDeliveryUi(ui);
        } catch {
          setDeliveryUi(null);
        }
      } else {
        setDeliveryUi(null);
      }

      try {
        const reviewRes = await apiFetch<{ canReview: boolean; review: { _id: string } | null }>(
          `/reviews/orders/${id}`,
        );
        setCanReview(reviewRes.canReview);
        setHasReview(Boolean(reviewRes.review));
      } catch {
        setCanReview(false);
        setHasReview(false);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load order');
      setOrder(null);
    } finally {
      setPageLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => {
    setPageLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (justBooked && !bookedBannerShown.current) {
      bookedBannerShown.current = true;
      pushNotification(
        'Payment received — Lunara is assigning your laundry partner. Pickup starts after dispatch.',
      );
    }
  }, [justBooked, pushNotification]);

  const { connected: socketLive } = useOrderTrackingSocket(id, {
    onStatusUpdate: (data) => {
      setOrder((prev) => (prev ? { ...prev, status: data.status } : prev));
      pushNotification(`Status: ${formatOrderStatusLabel(data.status)}`);
      void load();
    },
    onOrderEvent: (data) => {
      if (data.message) pushNotification(data.message);
      void load();
    },
    onLocationUpdate: (data) => {
      setLocation({ lat: data.lat, lng: data.lng });
    },
  });

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleVerify() {
    if (!id) return;
    setDeliveryError('');
    try {
      await apiFetch(`/orders/${id}/delivery/verify`, {
        method: 'POST',
        body: JSON.stringify({ code: verifyCode }),
      });
      setVerifyCode('');
      await load();
      pushNotification('Delivery verified');
    } catch (e) {
      setDeliveryError(e instanceof Error ? e.message : 'Verification failed');
    }
  }

  async function handleSign() {
    if (!id) return;
    setDeliveryError('');
    try {
      await apiFetch(`/orders/${id}/delivery/sign`, {
        method: 'POST',
        body: JSON.stringify({ signatureName }),
      });
      await load();
      pushNotification('Delivery signed');
    } catch (e) {
      setDeliveryError(e instanceof Error ? e.message : 'Sign failed');
    }
  }

  if (pageLoading || loadError || !order) {
    return (
      <View style={styles.centered}>
        <DataLoadState
          loading={pageLoading}
          error={loadError}
          loadingMessage="Loading order…"
          onRetry={() => {
            setPageLoading(true);
            load();
          }}
        />
      </View>
    );
  }

  const timeline = buildCustomerTimeline(order.status, order.statusHistory);
  const awaitingBranch =
    order.status === OrderStatus.PENDING_DISPATCH && !order.branchName;
  const hasBranch = Boolean(order.branchName);
  const showDeliveryActions =
    order.status === OrderStatus.OUT_FOR_DELIVERY ||
    order.status === OrderStatus.RIDER_ASSIGNED_DELIVERY;
  const showPickupQr =
    order.status === OrderStatus.RIDER_ASSIGNED_PICKUP ||
    order.status === OrderStatus.RIDER_ASSIGNED;
  const showDeliveryQr = order.status === OrderStatus.OUT_FOR_DELIVERY;
  const isTerminalCompleted =
    timeline.isTerminal && order.status === OrderStatus.COMPLETED;
  const showLostItemHint =
    order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED;
  const isCashPending =
    order.paymentMethod === PaymentMethod.CASH &&
    order.paymentStatus === PaymentStatus.PENDING;

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.statusRow}>
        <Text style={styles.status}>{timeline.currentStepLabel}</Text>
        {socketLive ? <Text style={styles.live}>● Live</Text> : null}
      </View>
      <Text style={styles.meta}>
        {order.bookingType.replace(/_/g, ' ')} · {formatCurrency(order.total)}
        {order.estimatedWeightKg ? ` · ~${order.estimatedWeightKg} kg` : ''}
      </Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${timeline.progressPercent}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{timeline.progressPercent}% complete</Text>

      {order.status === OrderStatus.PENDING && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>Payment required</Text>
          <Text style={styles.pendingText}>
            Complete payment to move your order to pending dispatch.
          </Text>
          <Button
            label="Go to checkout"
            onPress={() => router.push(`/checkout/${id}` as Href)}
            style={styles.pendingBtn}
          />
        </View>
      )}

      {awaitingBranch && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Assigning partner branch</Text>
          <Text style={styles.bannerText}>
            {isCashPending
              ? `Booking confirmed. Pay ${formatCurrency(order.total)} in cash on ${order.cashTiming === 'delivery' ? 'delivery' : 'pickup'}. Lunara is assigning your partner branch.`
              : 'Payment received. Lunara HQ is dispatching your order to the best partner laundry shop.'}
          </Text>
        </View>
      )}

      {order.paymentMethod ? (
        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Payment</Text>
          <Text style={styles.paymentLine}>
            {formatPaymentMethodLabel(order.paymentMethod)}
            {order.cashTiming ? ` · ${formatCashTimingLabel(order.cashTiming)}` : ''}
          </Text>
          {order.paymentStatus ? (
            <Text style={styles.paymentLine}>
              {formatPaymentStatusLabel(order.paymentStatus)}
            </Text>
          ) : null}
          {order.paymentReceiptCode ? (
            <Text style={styles.paymentRef}>Ref {order.paymentReceiptCode}</Text>
          ) : null}
        </View>
      ) : null}

      {hasBranch && (
        <View style={styles.branchCard}>
          <Text style={styles.branchLabel}>Assigned partner branch</Text>
          <Text style={styles.branchName}>{order.branchName}</Text>
          {order.branchCode ? <Text style={styles.branchCode}>{order.branchCode}</Text> : null}
          <Text style={styles.branchHint}>{branchTypeLabel('partner_shop')}</Text>
        </View>
      )}

      {notifications.length > 0 && (
        <View style={styles.notifCard}>
          <Text style={styles.sectionTitle}>Updates</Text>
          {notifications.slice(0, 5).map((n) => (
            <Text key={n.id} style={styles.notifLine}>
              · {n.message}
            </Text>
          ))}
        </View>
      )}

      {location && (
        <View style={styles.locationCard}>
          <Text style={styles.sectionTitle}>Rider location</Text>
          <Text style={styles.locationText}>
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </Text>
          <Pressable onPress={() => openMaps(location.lat, location.lng)} style={styles.mapsLink}>
            <Text style={styles.mapsLinkText}>Open in maps →</Text>
          </Pressable>
        </View>
      )}

      {showPickupQr && id ? (
        <HandoffQrCard orderId={id} context="pickup" apiFetch={apiFetch} />
      ) : null}

      {showDeliveryQr && id ? (
        <HandoffQrCard orderId={id} context="delivery" apiFetch={apiFetch} />
      ) : null}

      {showDeliveryActions && deliveryUi?.needsVerify && (
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Confirm you received laundry</Text>
          <Text style={styles.actionHint}>Last 4 digits of your mobile number</Text>
          <TextInput
            style={styles.input}
            placeholder="4-digit code"
            keyboardType="number-pad"
            maxLength={4}
            value={verifyCode}
            onChangeText={setVerifyCode}
          />
          <Pressable style={styles.actionBtn} onPress={handleVerify}>
            <Text style={styles.actionBtnText}>Verify</Text>
          </Pressable>
        </View>
      )}

      {showDeliveryActions && deliveryUi?.needsSign && (
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Sign for delivery</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            value={signatureName}
            onChangeText={setSignatureName}
          />
          <Pressable style={styles.actionBtn} onPress={handleSign}>
            <Text style={styles.actionBtnText}>Sign</Text>
          </Pressable>
        </View>
      )}

      {deliveryError ? <Text style={styles.error}>{deliveryError}</Text> : null}

      {(order.pickup?.receiptCode || order.delivery?.receiptCode) && (
        <View style={styles.receiptRow}>
          {order.pickup?.receiptCode ? (
            <View style={styles.receiptCard}>
              <Text style={styles.receiptLabel}>Pickup receipt</Text>
              <Text style={styles.receiptCode}>{order.pickup.receiptCode}</Text>
            </View>
          ) : null}
          {order.delivery?.receiptCode ? (
            <View style={styles.receiptCard}>
              <Text style={styles.receiptLabel}>Delivery receipt</Text>
              <Text style={styles.receiptCode}>{order.delivery.receiptCode}</Text>
              {order.delivery.signatureName ? (
                <Text style={styles.receiptSigned}>Signed: {order.delivery.signatureName}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {isTerminalCompleted && (
        <View style={styles.doneCard}>
          <Text style={styles.doneTitle}>All done!</Text>
          <Text style={styles.doneSub}>Thanks for using Lunara.</Text>
          {canReview ? (
            <Button label="Rate your experience" onPress={() => router.push(`/review/${id}`)} />
          ) : null}
          {hasReview && !canReview ? (
            <Pressable onPress={() => router.push(`/review/${id}`)}>
              <Text style={styles.viewReviewLink}>View your published review →</Text>
            </Pressable>
          ) : null}
          <Button
            label="Report missing item"
            variant="outline"
            onPress={() => router.push(`/orders/${id}/lost-item` as Href)}
            style={styles.doneAction}
          />
          <Button
            label="Request refund"
            variant="outline"
            onPress={() => router.push(`/orders/${id}/refund` as Href)}
            style={styles.doneAction}
          />
        </View>
      )}

      {showLostItemHint && !isTerminalCompleted ? (
        <Pressable onPress={() => router.push(`/orders/${id}/lost-item` as Href)}>
          <Text style={styles.lostItemHint}>
            Something missing? File a lost-item complaint →
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionTitle}>Progress</Text>
      <OrderTimeline status={order.status} statusHistory={order.statusHistory} />
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + spacing.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { ...typography.title, flex: 1, letterSpacing: -0.3, textTransform: 'capitalize' },
  live: { fontSize: 12, fontWeight: '600', color: colors.accent },
  meta: { marginTop: spacing.sm - 2, color: colors.muted, fontSize: 15, textTransform: 'capitalize' },
  progressTrack: {
    marginTop: spacing.lg,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  progressLabel: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.muted },
  pendingCard: {
    marginTop: spacing.lg,
    padding: spacing.lg - 2,
    borderRadius: radius.lg,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  pendingTitle: { fontWeight: '600', color: colors.warning },
  pendingText: { marginTop: spacing.sm - 2, fontSize: 13, color: colors.warning, lineHeight: 20 },
  pendingBtn: { marginTop: spacing.md },
  banner: {
    marginTop: spacing.lg,
    padding: spacing.lg - 2,
    borderRadius: radius.lg,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  bannerTitle: { fontWeight: '600', color: colors.warning },
  bannerText: { marginTop: spacing.sm - 2, fontSize: 13, color: colors.warning, lineHeight: 20, opacity: 0.9 },
  bannerText: { marginTop: spacing.xs, fontSize: 13, color: colors.muted, lineHeight: 20 },
  paymentCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  paymentLine: { marginTop: spacing.xs, fontSize: 13, color: colors.muted },
  paymentRef: {
    marginTop: spacing.sm,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentDark,
  },
  branchCard: {
    marginTop: spacing.lg,
    padding: spacing.lg - 2,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  branchLabel: { ...typography.label, color: colors.primaryDark },
  branchName: { marginTop: spacing.xs, fontSize: 18, fontWeight: '700', color: colors.slate800 },
  branchCode: { fontFamily: 'monospace', fontSize: 12, color: colors.primary, marginTop: 2 },
  branchHint: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.muted },
  notifCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifLine: { fontSize: 13, color: colors.slate700, marginTop: spacing.xs },
  locationCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationText: { marginTop: spacing.xs, fontSize: 13, color: colors.slate700 },
  mapsLink: { marginTop: spacing.sm },
  mapsLinkText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  actionCard: {
    marginTop: spacing.lg,
    padding: spacing.lg - 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  actionTitle: { fontWeight: '600', fontSize: 16, color: colors.foreground },
  actionHint: { marginTop: spacing.xs, fontSize: 13, color: colors.muted },
  input: {
    marginTop: spacing.md - 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    fontSize: 16,
    color: colors.foreground,
  },
  actionBtn: {
    marginTop: spacing.md - 2,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  actionBtnText: { color: colors.onPrimary, fontWeight: '600' },
  error: { marginTop: spacing.sm, color: colors.destructive, fontSize: 13 },
  receiptRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, flexWrap: 'wrap' },
  receiptCard: {
    flex: 1,
    minWidth: 140,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent + '11',
    borderWidth: 1,
    borderColor: colors.accent + '33',
  },
  receiptLabel: { fontSize: 11, fontWeight: '600', color: colors.muted },
  receiptCode: { marginTop: spacing.xs, fontFamily: 'monospace', fontSize: 14, fontWeight: '600' },
  receiptSigned: { marginTop: spacing.xs, fontSize: 11, color: colors.muted },
  doneCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    gap: spacing.sm,
  },
  doneTitle: { fontSize: 18, fontWeight: '700', color: colors.primary },
  doneSub: { ...typography.bodySm, textAlign: 'center', marginBottom: spacing.sm },
  doneAction: { width: '100%' },
  viewReviewLink: { color: colors.primary, fontWeight: '600', fontSize: 14, marginVertical: spacing.sm },
  lostItemHint: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  sectionTitle: { marginTop: spacing.xxl, ...typography.subheading, marginBottom: spacing.sm },
});
