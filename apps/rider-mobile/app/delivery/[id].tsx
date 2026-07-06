import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  DELIVERY_WORKFLOW_STEPS,
  formatCurrency,
  getDeliveryWorkflowStepIndex,
} from '@lunara/utils';
import type { RiderCashPaymentInfo } from '@lunara/utils';
import { OpsStepper } from '../../src/components/ops-stepper';
import { CashPaymentCard } from '../../src/components/cash-payment-card';
import { TaskDetailsCard } from '../../src/components/task-details-card';
import { DataLoadState } from '../../src/components/data-load-state';
import { Screen } from '../../src/components/ui/screen';
import { riderFetch, riderUpload, loadTaskWithCache, isQueuedResponse } from '../../src/api';
import { useRiderOrderSocket } from '../../src/hooks/use-rider-dispatch-socket';
import { useOrderPendingCount } from '../../src/hooks/use-offline-sync';
import { PendingSyncChip } from '../../src/components/pending-sync-chip';
import { SosButton } from '../../src/components/sos-button';
import { loadTaskCache } from '../../src/lib/offline/task-cache';
import { isOnline } from '../../src/lib/offline/network';
import { captureTaskPhoto } from '../../src/lib/task-photo';
import { AuthenticatedImage } from '../../src/components/authenticated-image';
import { resolveMediaUrl } from '../../src/lib/media-url';
import { callPhone, promptNavigate } from '../../src/lib/task-contact';
import type { RiderShopLocation, RiderTaskAddress } from '../../src/lib/rider-task-types';
import { colors, radius, shadow, spacing, typography } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface DeliveryTask {
  _id: string;
  status: string;
  bookingType: string;
  orderNumber?: string;
  branchName?: string;
  branchCode?: string;
  branchLogoUrl?: string;
  shopName?: string;
  estimatedWeightKg?: number;
  specialInstructions?: string;
  customerName?: string;
  customerPhone?: string;
  customerPhoneMasked?: string;
  shopPhone?: string;
  shopPhoneMasked?: string;
  canReject?: boolean;
  deliveryWorkflowSteps?: string[];
  deliveryWorkflowStep?: number;
  customerReceived?: boolean;
  customerSigned?: boolean;
  canPickupFromShop?: boolean;
  canGoOutForDelivery?: boolean;
  canMarkCustomerReceived?: boolean;
  canCapturePhoto?: boolean;
  canComplete?: boolean;
  delivery?: {
    acceptedAt?: string;
    pickedUpFromShopAt?: string;
    startedAt?: string;
    customerReceivedAt?: string;
    photoUrl?: string;
    receiptCode?: string;
  };
  deliveryAddress?: RiderTaskAddress | null;
  shopLocation?: RiderShopLocation | null;
  cashPayment?: RiderCashPaymentInfo | null;
}

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  icon,
  iconBg,
  iconColor,
  iconImageUri,
  title,
  hint,
  children,
}: {
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
  iconImageUri?: string;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={stepStyles.card}>
      <View style={stepStyles.header}>
        <View style={[stepStyles.iconWrap, { backgroundColor: iconBg }]}>
          {iconImageUri ? (
            <Image source={{ uri: iconImageUri }} style={stepStyles.iconImage} />
          ) : (
            <Ionicons name={icon} size={18} color={iconColor} />
          )}
        </View>
        <View style={stepStyles.headerText}>
          <Text style={stepStyles.title}>{title}</Text>
          {hint ? <Text style={stepStyles.hint}>{hint}</Text> : null}
        </View>
      </View>
      {children ? (
        <>
          <View style={stepStyles.divider} />
          <View style={stepStyles.body}>{children}</View>
        </>
      ) : null}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  iconImage: { width: '100%', height: '100%' },
  headerText: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  hint: { ...typography.caption, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginTop: spacing.md },
  body: { marginTop: spacing.md },
});

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({
  label,
  icon,
  onPress,
  disabled,
  variant = 'primary',
  inRow = false,
}: {
  label: string;
  icon?: IoniconName;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'accent' | 'outline' | 'danger';
  inRow?: boolean;
}) {
  const bg =
    variant === 'accent'
      ? colors.accent
      : variant === 'danger'
        ? colors.destructive
        : variant === 'outline'
          ? 'transparent'
          : colors.primary;
  const textColor = variant === 'outline' ? colors.primary : '#fff';
  const borderColor = variant === 'outline' ? colors.primaryBorder : 'transparent';

  return (
    <Pressable
      style={({ pressed }) => [
        btnStyles.btn,
        inRow && btnStyles.btnInRow,
        { backgroundColor: bg, borderColor },
        variant === 'outline' && btnStyles.outline,
        disabled && btnStyles.disabled,
        pressed && !disabled && btnStyles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon ? <Ionicons name={icon} size={16} color={textColor} /> : null}
      <Text style={[btnStyles.text, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing.md,
    ...shadow.card,
  },
  btnInRow: { marginTop: 0 },
  outline: { shadowOpacity: 0, elevation: 0 },
  disabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  text: { fontSize: 15, fontWeight: '700' },
});

// ── Delivery screen ───────────────────────────────────────────────────────────

export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const pendingCount = useOrderPendingCount(id);
  const [task, setTask] = useState<DeliveryTask | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError('');
    try {
      const { data, fromCache: cached } = await loadTaskWithCache<DeliveryTask>(
        `/riders/delivery-tasks/${id}`,
        id,
      );
      setTask(data);
      setFromCache(cached);
    } catch {
      const offline = !(await isOnline());
      setLoadError(
        offline
          ? 'Offline — open this task while online first to cache it locally.'
          : 'Could not load delivery task',
      );
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useRiderOrderSocket(id, load);

  async function run<T>(fn: () => Promise<T>, msg?: string) {
    setLoading(true);
    try {
      const res = await fn();
      if (isQueuedResponse(res)) {
        const cached = id ? await loadTaskCache<DeliveryTask>(id) : null;
        if (cached) { setTask(cached); setFromCache(true); }
        if (msg) Alert.alert('Saved offline', `${msg} — will sync when you're back online.`);
        return res;
      }
      await load();
      if (msg) Alert.alert('Done', msg);
      return res;
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  function applyLocalPhotoPreview(localUri: string) {
    setTask((prev) =>
      prev ? { ...prev, delivery: { ...prev.delivery, photoUrl: localUri } } : prev,
    );
  }

  function confirmReject() {
    Alert.alert('Reject task', 'Decline this delivery assignment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            await riderFetch(`/riders/delivery-tasks/${id}/reject`, { method: 'POST' });
            router.back();
          }),
      },
    ]);
  }

  if (!task) {
    return (
      <Screen inStack>
        <DataLoadState loading={!loadError} error={loadError} loadingMessage="Loading delivery task…" onRetry={load} />
      </Screen>
    );
  }

  const d = task.delivery ?? {};
  const steps = task.deliveryWorkflowSteps ?? DELIVERY_WORKFLOW_STEPS.map((s) => s.label);
  const stepIndex =
    task.deliveryWorkflowStep ??
    getDeliveryWorkflowStepIndex({ status: task.status, delivery: d });
  const isAssigned = task.status === 'rider_assigned_delivery';
  const isOffer = task.status === 'ready_for_delivery' && !d.acceptedAt && !isAssigned;
  const done = task.status === 'delivered' || task.status === 'completed';
  const isActiveDelivery = Boolean(d.acceptedAt && !done && !isOffer);
  const shop = task.shopLocation;
  const bookingLabel = task.bookingType.replace(/_/g, ' ');
  const statusLabel = task.status.replace(/_/g, ' ');

  return (
    <View style={styles.screenWrap}>
      <Screen scroll inStack contentStyle={styles.content}>

        {/* ── Page header ── */}
        <View style={styles.pageHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Ionicons name="arrow-down-circle-outline" size={22} color={colors.accentDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Delivery route</Text>
              {task.orderNumber ? (
                <Text style={styles.orderNumber}>#{task.orderNumber}</Text>
              ) : null}
              <View style={styles.metaRow}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{bookingLabel}</Text>
                </View>
                <View style={[styles.metaPill, styles.statusPill]}>
                  <Text style={[styles.metaPillText, styles.statusPillText]}>{statusLabel}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Stepper ── */}
        <OpsStepper steps={steps} currentIndex={stepIndex} />

        {/* ── Banners ── */}
        {pendingCount > 0 ? <PendingSyncChip /> : null}
        {fromCache ? (
          <View style={styles.cacheBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
            <Text style={styles.cacheBannerText}>Showing cached task — changes sync when online</Text>
          </View>
        ) : null}

        {/* ── Task details ── */}
        <TaskDetailsCard
          task={{
            orderNumber: task.orderNumber,
            bookingType: task.bookingType,
            estimatedWeightKg: task.estimatedWeightKg,
            specialInstructions: task.specialInstructions,
            customerName: task.customerName,
            customerPhone: task.customerPhone,
            customerPhoneMasked: task.customerPhoneMasked,
            customerAddress: task.deliveryAddress,
            shopName: task.shopName,
            branchName: task.branchName,
            branchCode: task.branchCode,
            shopLocation: task.shopLocation,
            shopPhone: task.shopPhone,
            shopPhoneMasked: task.shopPhoneMasked,
            canReject: task.canReject,
          }}
          taskType="delivery"
          showActions={Boolean(isAssigned && !done) || isOffer}
          loading={loading}
          onAccept={
            isAssigned && !d.acceptedAt
              ? () => run(() => riderFetch(`/riders/delivery-offers/${id}/accept`, { method: 'POST' }), 'Assignment acknowledged')
              : undefined
          }
          onReject={task.canReject ? confirmReject : undefined}
        />

        {/* ── Waiting for assignment ── */}
        {isOffer && (
          <View style={styles.infoBanner}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <View style={styles.infoBannerText}>
              <Text style={styles.infoBannerTitle}>Awaiting Lunara assignment</Text>
              <Text style={styles.infoBannerHint}>
                This order is ready at the shop. Operations will assign you — check Active tasks on the home screen.
              </Text>
            </View>
          </View>
        )}

        {d.acceptedAt && !done && (
          <>
            {/* ── Pick up from shop ── */}
            {task.canPickupFromShop && shop && (
              <StepCard
                icon="storefront-outline"
                iconBg={colors.secondaryLight}
                iconColor={colors.secondaryDark}
                iconImageUri={resolveMediaUrl(task.branchLogoUrl)}
                title={task.branchName ?? shop.name}
                hint={[shop.line1, shop.city].filter(Boolean).join(', ')}
              >
                <View style={styles.contactRow}>
                  <View style={styles.contactBtn}>
                    <ActionBtn
                      label="Navigate"
                      icon="navigate-outline"
                      variant="primary"
                      inRow
                      disabled={loading}
                      onPress={() => promptNavigate(shop)}
                    />
                  </View>
                  {task.shopPhone ? (
                    <View style={styles.contactBtn}>
                      <ActionBtn
                        label="Call shop"
                        icon="call-outline"
                        variant="outline"
                        inRow
                        disabled={loading}
                        onPress={() => callPhone(task.shopPhone)}
                      />
                    </View>
                  ) : null}
                </View>
                <ActionBtn
                  label="Picked up from shop"
                  icon="checkmark-circle-outline"
                  variant="accent"
                  disabled={loading}
                  onPress={() => run(() => riderFetch(`/riders/delivery-tasks/${id}/pickup-from-shop`, { method: 'POST' }), 'Picked up from shop')}
                />
              </StepCard>
            )}

            {/* ── Out for delivery ── */}
            {task.canGoOutForDelivery && (
              <StepCard
                icon="bicycle-outline"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                title="Head to customer"
                hint={
                  task.deliveryAddress
                    ? [task.deliveryAddress.line1, task.deliveryAddress.city].filter(Boolean).join(', ')
                    : 'Navigate to the delivery address'
                }
              >
                <View style={styles.contactRow}>
                  {task.deliveryAddress ? (
                    <View style={styles.contactBtn}>
                      <ActionBtn
                        label="Navigate"
                        icon="navigate-outline"
                        variant="primary"
                        inRow
                        disabled={loading}
                        onPress={() => promptNavigate(task.deliveryAddress!)}
                      />
                    </View>
                  ) : null}
                  <View style={styles.contactBtn}>
                    <ActionBtn
                      label="Call"
                      icon="call-outline"
                      variant="outline"
                      inRow
                      disabled={loading}
                      onPress={() => callPhone(task.customerPhone)}
                    />
                  </View>
                </View>
                <View style={styles.arrivedDivider} />
                <ActionBtn
                  label="Out for delivery"
                  icon="arrow-forward-circle-outline"
                  variant="accent"
                  disabled={loading}
                  onPress={() => run(() => riderFetch(`/riders/delivery-tasks/${id}/out-for-delivery`, { method: 'POST' }), 'Status: out for delivery')}
                />
              </StepCard>
            )}

            {/* ── Cash collection ── */}
            {task.cashPayment?.collectAt === 'delivery' && task.status === 'out_for_delivery' && (
              <CashPaymentCard
                cashPayment={task.cashPayment}
                loading={loading}
                onCollect={
                  task.cashPayment.canCollect
                    ? () => run(() => riderFetch(`/riders/delivery-tasks/${id}/collect-cash`, { method: 'POST' }), 'Cash payment recorded')
                    : undefined
                }
              />
            )}

            {/* ── Customer handoff ── */}
            {task.canMarkCustomerReceived && (
              <StepCard
                icon="person-circle-outline"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                title={task.customerName ?? 'Customer handoff'}
                hint="Confirm delivery with customer."
              >
                {(task.customerName || task.customerPhoneMasked) ? (
                  <View style={styles.identityBox}>
                    {task.customerName ? (
                      <Text style={styles.identityName}>{task.customerName}</Text>
                    ) : null}
                    {task.customerPhoneMasked ? (
                      <Text style={styles.identityPhone}>···· {task.customerPhoneMasked}</Text>
                    ) : null}
                  </View>
                ) : null}
                <ActionBtn
                  label="Scan Customer QR"
                  icon="qr-code-outline"
                  disabled={loading}
                  onPress={() => router.push({ pathname: '/scan', params: { orderId: id!, mode: 'customer_delivery' } })}
                />
                <ActionBtn
                  label="Customer received (manual)"
                  icon="checkmark-outline"
                  variant="outline"
                  disabled={loading}
                  onPress={() => run(() => riderFetch(`/riders/delivery-tasks/${id}/customer-received`, { method: 'POST' }), 'Or customer verifies in their app')}
                />
              </StepCard>
            )}

            {/* ── Handoff status ── */}
            {(task.customerReceived || d.customerReceivedAt) && (
              <StepCard
                icon="checkmark-done-circle-outline"
                iconBg={colors.accentLight}
                iconColor={colors.accentDark}
                title="Handoff status"
                hint="Customer receives and signs in their app after photo proof."
              >
                <View style={styles.handoffRow}>
                  <View style={[styles.handoffChip, task.customerReceived && styles.handoffChipDone]}>
                    <Ionicons
                      name={task.customerReceived ? 'checkmark-circle' : 'time-outline'}
                      size={13}
                      color={task.customerReceived ? colors.accentDark : colors.mutedForeground}
                    />
                    <Text style={[styles.handoffChipText, task.customerReceived && styles.handoffChipTextDone]}>
                      Received
                    </Text>
                  </View>
                  <View style={[styles.handoffChip, task.customerSigned && styles.handoffChipDone]}>
                    <Ionicons
                      name={task.customerSigned ? 'checkmark-circle' : 'time-outline'}
                      size={13}
                      color={task.customerSigned ? colors.accentDark : colors.mutedForeground}
                    />
                    <Text style={[styles.handoffChipText, task.customerSigned && styles.handoffChipTextDone]}>
                      Signed
                    </Text>
                  </View>
                </View>
              </StepCard>
            )}

            {/* ── Photo proof ── */}
            {task.canCapturePhoto && (
              <StepCard
                icon="camera-outline"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                title="Photo proof"
                hint="Photograph the delivered laundry as proof."
              >
                <ActionBtn
                  label="Take photo"
                  icon="camera-outline"
                  disabled={loading}
                  onPress={() =>
                    run(async () => {
                      const captured = await captureTaskPhoto();
                      if (!captured) return;
                      applyLocalPhotoPreview(captured.localUri);
                      return riderUpload(`/riders/delivery-tasks/${id}/photo-upload`, captured.formData, id);
                    }, 'Photo proof saved')
                  }
                />
              </StepCard>
            )}

            {/* ── Photo proof (persistent) ── */}
            {d.photoUrl ? (
              <StepCard
                icon="image-outline"
                iconBg={colors.surfaceMuted}
                iconColor={colors.mutedForeground}
                title="Delivery photo proof"
              >
                <AuthenticatedImage
                  path={d.photoUrl}
                  style={styles.photoPreview}
                  accessibilityLabel="Delivery photo proof"
                />
              </StepCard>
            ) : null}

            {/* ── Complete ── */}
            {task.canComplete && (
              <StepCard
                icon="flag-outline"
                iconBg={colors.accentLight}
                iconColor={colors.accentDark}
                title="Complete delivery"
                hint="Finalize the delivery and collect your payout."
              >
                <ActionBtn
                  label="Complete (delivered)"
                  icon="checkmark-circle-outline"
                  variant="accent"
                  disabled={loading}
                  onPress={() =>
                    run(async () => {
                      const res = await riderFetch<{
                        receiptCode: string;
                        earnings?: { amount: number; todayEarnings: number };
                      }>(`/riders/delivery-tasks/${id}/complete`, { method: 'POST' });
                      const earn = res.earnings;
                      Alert.alert(
                        'Completed',
                        `${res.receiptCode}${earn ? `\n+${formatCurrency(earn.amount)} earned (today ${formatCurrency(earn.todayEarnings)})` : ''}`,
                      );
                      router.back();
                    })
                  }
                />
              </StepCard>
            )}
          </>
        )}

        {/* ── Receipt code ── */}
        {d.receiptCode ? (
          <StepCard
            icon="receipt-outline"
            iconBg={colors.primaryLight}
            iconColor={colors.primary}
            title="Delivery receipt"
            hint="Keep this code as proof of delivery."
          >
            <View style={styles.receiptBox}>
              <Text style={styles.receiptCode}>{d.receiptCode}</Text>
            </View>
          </StepCard>
        ) : null}

        {/* ── Done ── */}
        {done && (
          <View style={styles.doneBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.accentDark} />
            <View style={styles.doneBannerText}>
              <Text style={styles.doneBannerTitle}>Delivery complete</Text>
              <Text style={styles.doneBannerHint}>Order delivered and completed successfully.</Text>
            </View>
          </View>
        )}

      </Screen>
      {id ? <SosButton orderId={id} taskActive={isActiveDelivery} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: { flex: 1 },
  content: { paddingBottom: spacing.xxxl + 72 },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  metaPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  statusPill: { backgroundColor: colors.accentLight },
  statusPillText: { color: colors.accentDark },

  cacheBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  cacheBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.warning,
    lineHeight: 18,
  },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  infoBannerText: { flex: 1 },
  infoBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  infoBannerHint: { ...typography.bodySm, color: colors.primary, marginTop: spacing.xs, opacity: 0.85 },

  contactRow: { flexDirection: 'row', gap: spacing.sm },
  contactBtn: { flex: 1 },
  arrivedDivider: { height: 1, backgroundColor: colors.border, marginTop: spacing.lg },

  identityBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
  },
  identityName: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  identityPhone: { fontSize: 13, fontWeight: '500', color: colors.mutedForeground },

  handoffRow: { flexDirection: 'row', gap: spacing.sm },
  handoffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  handoffChipDone: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  handoffChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  handoffChipTextDone: { color: colors.accentDark },

  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.xs,
  },

  receiptBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.xs,
  },
  receiptCode: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 4,
    color: colors.foreground,
  },

  doneBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.accentLight,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  doneBannerText: { flex: 1 },
  doneBannerTitle: { fontSize: 15, fontWeight: '700', color: colors.accentDark },
  doneBannerHint: {
    ...typography.bodySm,
    color: colors.accentDark,
    marginTop: spacing.xs,
    opacity: 0.8,
  },
});
