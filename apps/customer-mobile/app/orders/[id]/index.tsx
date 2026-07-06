import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardSafeScrollView } from '../../../src/components/ui/keyboard-safe-scroll-view';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@lunara/types';
import {
  buildCustomerTimeline,
  formatCashTimingLabel,
  formatCurrency,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
  formatPaymentStatusLabel,
} from '@lunara/utils';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { Input } from '../../../src/components/ui/input';
import { colors, radius, spacing, typography } from '../../../src/theme';
import { useOrderTrackingSocket } from '../../../src/hooks/use-order-tracking-socket';
import { DataLoadState } from '../../../src/components/data-load-state';
import { OrderTimeline } from '../../../src/components/order-timeline';
import { HandoffQrCard } from '../../../src/components/handoff-qr-card';
import { branchTypeLabel } from '../../../src/components/nearest-branches';
import { formatOrderNumber } from '../../../src/lib/active-order';
import { resolveMediaUrl } from '../../../src/lib/media-url';
import { useAuthStore } from '../../../src/store/auth';

interface OrderDetail {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
  estimatedWeightKg?: number;
  scheduledPickupAt?: string;
  branchName?: string;
  branchCode?: string;
  branchLogoUrl?: string;
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
  const [accountName, setAccountName] = useState('');
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
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [branchExpanded, setBranchExpanded] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
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
    apiFetch<{ firstName: string; lastName: string }>('/customers/me')
      .then((profile) => setAccountName(`${profile.firstName} ${profile.lastName}`.trim()))
      .catch(() => {});
  }, [apiFetch]);

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

  async function handleSign(nameOverride?: string) {
    if (!id) return;
    const name = (nameOverride ?? signatureName).trim();
    if (name.length < 2) {
      setDeliveryError('Enter your name (min 2 characters) to sign.');
      return;
    }
    setDeliveryError('');
    try {
      await apiFetch(`/orders/${id}/delivery/sign`, {
        method: 'POST',
        body: JSON.stringify({ signatureName: name }),
      });
      await load();
      pushNotification('Delivery signed');
    } catch (e) {
      setDeliveryError(e instanceof Error ? e.message : 'Sign failed');
    }
  }

  function openReviewModal() {
    setReviewRating(0);
    setReviewComment('');
    setReviewError('');
    setReviewModalOpen(true);
  }

  async function handleSubmitReview() {
    if (!id) return;
    if (reviewRating < 1) {
      setReviewError('Select a star rating before submitting.');
      return;
    }
    setReviewSubmitting(true);
    setReviewError('');
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          orderId: id,
          rating: reviewRating,
          comment: reviewComment.trim() || undefined,
        }),
      });
      setCanReview(false);
      setHasReview(true);
      setReviewModalOpen(false);
      pushNotification('Thanks for your review!');
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Could not submit review');
    } finally {
      setReviewSubmitting(false);
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
  const showDeliveryQr =
    order.status === OrderStatus.OUT_FOR_DELIVERY && !deliveryUi?.needsSign;
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
      <Card elevated style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.statusRow}>
          <View style={styles.statusIcon}>
            <Ionicons name="shirt-outline" size={20} color={colors.onPrimary} />
          </View>
          <View style={styles.statusTextCol}>
            <Text style={styles.orderNumber}>{formatOrderNumber(order._id)}</Text>
            <Text style={styles.status}>{timeline.currentStepLabel}</Text>
          </View>
          {socketLive ? (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.live}>Live</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="pricetag-outline" size={13} color={colors.mutedForeground} />
          <Text style={styles.meta}>
            {order.bookingType.replace(/_/g, ' ')} · {formatCurrency(order.total)}
            {order.estimatedWeightKg ? ` · ~${order.estimatedWeightKg} kg` : ''}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${timeline.progressPercent}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{timeline.progressPercent}% complete</Text>
      </Card>

      {order.status === OrderStatus.PENDING && (
        <Card style={styles.pendingCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="card-outline" size={18} color={colors.warning} />
            <Text style={styles.pendingTitle}>Payment required</Text>
          </View>
          <Text style={styles.pendingText}>
            Complete payment to move your order to pending dispatch.
          </Text>
          <Button
            label="Go to checkout"
            onPress={() => router.push(`/checkout/${id}` as Href)}
            style={styles.pendingBtn}
          />
        </Card>
      )}

      {awaitingBranch && (
        <Card style={styles.banner}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="sync-outline" size={18} color={colors.warning} />
            <Text style={styles.bannerTitle}>Assigning partner branch</Text>
          </View>
          <Text style={styles.bannerText}>
            {isCashPending
              ? `Booking confirmed. Pay ${formatCurrency(order.total)} in cash on ${order.cashTiming === 'delivery' ? 'delivery' : 'pickup'}. Lunara is assigning your partner branch.`
              : 'Payment received. Lunara HQ is dispatching your order to the best partner laundry shop.'}
          </Text>
        </Card>
      )}

      {order.paymentMethod ? (
        <Card style={styles.paymentCard}>
          <Pressable
            style={styles.toggleHeaderRow}
            onPress={() => setPaymentExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${paymentExpanded ? 'Collapse' : 'Expand'} payment details`}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons name="wallet-outline" size={16} color={colors.primary} />
              <Text style={styles.paymentTitle}>Payment</Text>
            </View>
            <Ionicons
              name={paymentExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.muted}
            />
          </Pressable>
          {paymentExpanded ? (
            <>
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
            </>
          ) : null}
        </Card>
      ) : null}

      {hasBranch && (
        <Card style={styles.branchCard}>
          <Pressable
            style={styles.toggleHeaderRow}
            onPress={() => setBranchExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${branchExpanded ? 'Collapse' : 'Expand'} assigned partner branch`}
          >
            <View style={styles.cardHeaderRow}>
              {order.branchLogoUrl ? (
                <Image
                  source={{ uri: resolveMediaUrl(order.branchLogoUrl) }}
                  style={styles.branchLogo}
                />
              ) : (
                <Ionicons name="storefront-outline" size={16} color={colors.primaryDark} />
              )}
              <Text style={styles.branchLabel}>Assigned partner branch</Text>
            </View>
            <Ionicons
              name={branchExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.primaryDark}
            />
          </Pressable>
          {branchExpanded ? (
            <>
              <Text style={styles.branchName}>{order.branchName}</Text>
              {order.branchCode ? <Text style={styles.branchCode}>{order.branchCode}</Text> : null}
              <Text style={styles.branchHint}>{branchTypeLabel('partner_shop')}</Text>
            </>
          ) : null}
        </Card>
      )}

      {location && (
        <Card muted style={styles.locationCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="navigate-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitleInline}>Rider location</Text>
          </View>
          <Text style={styles.locationText}>
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </Text>
          <Pressable
            onPress={() => openMaps(location.lat, location.lng)}
            style={styles.mapsLink}
            accessibilityRole="button"
            accessibilityLabel="Open rider location in maps"
          >
            <Text style={styles.mapsLinkText}>Open in maps</Text>
            <Ionicons name="open-outline" size={14} color={colors.primary} />
          </Pressable>
        </Card>
      )}

      {showPickupQr && id ? (
        <HandoffQrCard orderId={id} context="pickup" apiFetch={apiFetch} />
      ) : null}

      {showDeliveryQr && id ? (
        <HandoffQrCard orderId={id} context="delivery" apiFetch={apiFetch} />
      ) : null}

      {showDeliveryActions && deliveryUi?.needsVerify && (
        <Card style={styles.actionCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.actionTitle}>Confirm you received laundry</Text>
          </View>
          <Text style={styles.actionHint}>Last 4 digits of your mobile number</Text>
          <Input
            style={styles.input}
            placeholder="4-digit code"
            keyboardType="number-pad"
            maxLength={4}
            value={verifyCode}
            onChangeText={setVerifyCode}
          />
          <Button label="Verify" onPress={handleVerify} style={styles.actionBtn} />
        </Card>
      )}

      <Modal
        visible={Boolean(showDeliveryActions && deliveryUi?.needsSign)}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetPanel}>
            <View style={styles.sheetHandle} />
            <View style={styles.cardHeaderRow}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.actionTitle}>Sign for delivery</Text>
            </View>
            <Input
              style={styles.input}
              placeholder="Your name"
              value={signatureName}
              onChangeText={setSignatureName}
            />
            <Button label="Sign" onPress={() => handleSign()} style={styles.actionBtn} />

            {accountName ? (
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>Or</Text>
                <View style={styles.orLine} />
              </View>
            ) : null}

            {accountName ? (
              <Pressable
                style={styles.tapToSignRow}
                onPress={() => handleSign(accountName)}
                accessibilityRole="button"
                accessibilityLabel={`Tap to sign as ${accountName}`}
              >
                <Ionicons name="finger-print-outline" size={16} color={colors.primary} />
                <Text style={styles.tapToSignText}>Just click to sign as {accountName}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      {deliveryError ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
          <Text style={styles.error}>{deliveryError}</Text>
        </View>
      ) : null}

      {(order.pickup?.receiptCode || order.delivery?.receiptCode) && (
        <View style={styles.receiptRow}>
          {order.pickup?.receiptCode ? (
            <Card muted style={styles.receiptCard}>
              <Ionicons name="receipt-outline" size={16} color={colors.accentDark} />
              <Text style={styles.receiptLabel}>Pickup receipt</Text>
              <Text style={styles.receiptCode}>{order.pickup.receiptCode}</Text>
            </Card>
          ) : null}
          {order.delivery?.receiptCode ? (
            <Card muted style={styles.receiptCard}>
              <Ionicons name="receipt-outline" size={16} color={colors.accentDark} />
              <Text style={styles.receiptLabel}>Delivery receipt</Text>
              <Text style={styles.receiptCode}>{order.delivery.receiptCode}</Text>
              {order.delivery.signatureName ? (
                <Text style={styles.receiptSigned}>Signed: {order.delivery.signatureName}</Text>
              ) : null}
            </Card>
          ) : null}
        </View>
      )}

      {isTerminalCompleted && (
        <Card style={styles.doneCard}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={22} color={colors.onPrimary} />
          </View>
          <Text style={styles.doneTitle}>All done!</Text>
          <Text style={styles.doneSub}>Thanks for using Lunara.</Text>
          {canReview ? (
            <Button label="Rate your experience" onPress={openReviewModal} style={styles.doneAction} />
          ) : null}
          {hasReview && !canReview ? (
            <Pressable onPress={() => router.push(`/review/${id}`)} accessibilityRole="button">
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
        </Card>
      )}

      <Modal
        visible={reviewModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setReviewModalOpen(false)} />
          <View style={styles.sheetPanel}>
            <View style={styles.sheetHandle} />
            <View style={styles.cardHeaderRow}>
              <Ionicons name="star-outline" size={18} color={colors.primary} />
              <Text style={styles.actionTitle}>Rate your experience</Text>
            </View>

            <View style={styles.starsWrap}>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setReviewRating(value)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`${value} star${value > 1 ? 's' : ''}`}
                    accessibilityState={{ selected: value === reviewRating }}
                  >
                    <Ionicons
                      name={value <= reviewRating ? 'star' : 'star-outline'}
                      size={36}
                      color={value <= reviewRating ? '#F59E0B' : colors.border}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            <Input
              style={styles.input}
              placeholder="Comments (optional)"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {reviewError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                <Text style={styles.error}>{reviewError}</Text>
              </View>
            ) : null}

            <Button
              label={reviewSubmitting ? 'Submitting…' : 'Submit review'}
              onPress={handleSubmitReview}
              disabled={reviewSubmitting || reviewRating < 1}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </Modal>

      {showLostItemHint && !isTerminalCompleted ? (
        <Pressable
          onPress={() => router.push(`/orders/${id}/lost-item` as Href)}
          style={styles.lostItemPill}
          accessibilityRole="button"
        >
          <Ionicons name="help-buoy-outline" size={14} color={colors.primary} />
          <Text style={styles.lostItemHint}>Something missing? File a lost-item complaint</Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionTitle}>Progress</Text>
      <Card style={styles.timelineCard}>
        <OrderTimeline status={order.status} statusHistory={order.statusHistory} />
      </Card>
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + spacing.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: { borderWidth: 0, backgroundColor: colors.primaryLight, overflow: 'hidden' },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    top: -80,
    right: -50,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextCol: { flex: 1 },
  orderNumber: { fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  status: { ...typography.title, fontSize: 20, letterSpacing: -0.3, textTransform: 'capitalize', marginTop: 2 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  live: { fontSize: 11, fontWeight: '700', color: colors.accentDark },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg },
  meta: { color: colors.muted, fontSize: 13, textTransform: 'capitalize' },
  progressTrack: {
    marginTop: spacing.md,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  progressLabel: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.muted },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  pendingTitle: { fontWeight: '600', color: colors.warning },
  pendingText: { marginTop: spacing.sm, fontSize: 13, color: colors.warning, lineHeight: 20 },
  pendingBtn: { marginTop: spacing.md },
  banner: {
    marginTop: spacing.lg,
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  bannerTitle: { fontWeight: '600', color: colors.warning },
  bannerText: { marginTop: spacing.sm, fontSize: 13, color: colors.muted, lineHeight: 20 },
  paymentCard: { marginTop: spacing.lg },
  paymentTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  paymentLine: { marginTop: spacing.sm, fontSize: 13, color: colors.muted },
  paymentRef: {
    marginTop: spacing.sm,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentDark,
  },
  branchCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
  },
  branchLabel: { ...typography.label, color: colors.primaryDark },
  branchLogo: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.surface },
  branchName: { marginTop: spacing.sm, fontSize: 18, fontWeight: '700', color: colors.slate800 },
  branchCode: { fontFamily: 'monospace', fontSize: 12, color: colors.primary, marginTop: 2 },
  branchHint: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.muted },
  locationCard: { marginTop: spacing.lg, borderWidth: 0 },
  sectionTitleInline: { ...typography.subheading, fontSize: 15 },
  locationText: { marginTop: spacing.sm, fontSize: 13, color: colors.slate700 },
  mapsLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  mapsLinkText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  actionCard: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  actionTitle: { fontWeight: '600', fontSize: 16, color: colors.foreground },
  actionHint: { marginTop: spacing.xs, fontSize: 13, color: colors.muted },
  input: { marginTop: spacing.md },
  actionBtn: { marginTop: spacing.md },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheetBackdrop: { flex: 1 },
  starsWrap: { alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  starsRow: { flexDirection: 'row', gap: spacing.sm },
  sheetPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
  tapToSignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  tapToSignText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  error: { color: colors.destructive, fontSize: 13 },
  receiptRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, flexWrap: 'wrap' },
  receiptCard: { flex: 1, minWidth: 140, gap: 2 },
  receiptLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, marginTop: spacing.xs },
  receiptCode: { fontFamily: 'monospace', fontSize: 14, fontWeight: '600' },
  receiptSigned: { fontSize: 11, color: colors.muted },
  doneCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    gap: spacing.sm,
  },
  doneIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  doneTitle: { fontSize: 18, fontWeight: '700', color: colors.primary },
  doneSub: { ...typography.bodySm, textAlign: 'center', marginBottom: spacing.sm },
  doneAction: { width: '100%' },
  viewReviewLink: { color: colors.primary, fontWeight: '600', fontSize: 14, marginVertical: spacing.sm },
  lostItemPill: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  lostItemHint: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  sectionTitle: { marginTop: spacing.xxl, ...typography.subheading, marginBottom: spacing.sm },
  timelineCard: { borderWidth: 0 },
});
