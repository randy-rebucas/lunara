import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatCurrency,
  getPickupWorkflowStepIndex,
  PICKUP_WORKFLOW_STEPS,
} from '@lunara/utils';
import type { RiderCashPaymentInfo } from '@lunara/utils';
import { OpsStepper } from '../../src/components/ops-stepper';
import { CashPaymentCard } from '../../src/components/cash-payment-card';
import { TaskDetailsCard } from '../../src/components/task-details-card';
import { DataLoadState } from '../../src/components/data-load-state';
import { Input } from '../../src/components/ui/input';
import { Screen } from '../../src/components/ui/screen';
import { riderFetch, riderUpload, loadTaskWithCache, isQueuedResponse } from '../../src/api';
import { useRiderOrderSocket } from '../../src/hooks/use-rider-dispatch-socket';
import { useOrderPendingCount, useOrderHasPendingStep } from '../../src/hooks/use-offline-sync';
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

interface PickupTask {
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
  pickupWorkflowStep?: number;
  pickupWorkflowSteps?: string[];
  laundryTagId?: string;
  pickup?: {
    acceptedAt?: string;
    arrivedAt?: string;
    customerVerifiedAt?: string;
    collectedAt?: string;
    photoUrl?: string;
    receiptCode?: string;
    receiptGeneratedAt?: string;
    droppedAtShop?: string;
  };
  pickupAddress?: RiderTaskAddress | null;
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
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
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  hint: {
    ...typography.caption,
    marginTop: 2,
  },
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

// ── OR divider ────────────────────────────────────────────────────────────────

function OrDivider() {
  return (
    <View style={orStyles.row}>
      <View style={orStyles.line} />
      <Text style={orStyles.text}>or enter manually</Text>
      <View style={orStyles.line} />
    </View>
  );
}

const orStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  text: { ...typography.caption },
});

// ── Pickup screen ─────────────────────────────────────────────────────────────

export default function PickupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const pendingCount = useOrderPendingCount(id);
  const cashPendingSync = useOrderHasPendingStep(id, 'pickup:collect-cash');
  const [task, setTask] = useState<PickupTask | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [weight, setWeight] = useState('5');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError('');
    try {
      const { data, fromCache: cached } = await loadTaskWithCache<PickupTask>(
        `/riders/pickup-tasks/${id}`,
        id,
      );
      setTask(data);
      setFromCache(cached);
      if (data.estimatedWeightKg) setWeight(String(data.estimatedWeightKg));
    } catch {
      const offline = !(await isOnline());
      setLoadError(
        offline
          ? 'Offline — open this task while online first to cache it locally.'
          : 'Could not load pickup task',
      );
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useRiderOrderSocket(id, load);

  async function run<T>(fn: () => Promise<T>, successMsg?: string) {
    setLoading(true);
    try {
      const res = await fn();
      if (isQueuedResponse(res)) {
        const cached = id ? await loadTaskCache<PickupTask>(id) : null;
        if (cached) { setTask(cached); setFromCache(true); }
        if (successMsg) Alert.alert('Saved offline', `${successMsg} — will sync when you're back online.`);
        return res;
      }
      await load();
      if (successMsg) Alert.alert('Done', successMsg);
      return res;
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  function applyLocalPhotoPreview(localUri: string) {
    setTask((prev) =>
      prev ? { ...prev, pickup: { ...prev.pickup, photoUrl: localUri } } : prev,
    );
  }

  function confirmReject() {
    Alert.alert('Reject task', 'Decline this pickup assignment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            const path = isOffer
              ? `/riders/pickup-offers/${id}/reject`
              : `/riders/pickup-tasks/${id}/reject`;
            await riderFetch(path, { method: 'POST' });
            router.back();
          }),
      },
    ]);
  }

  const steps = task?.pickupWorkflowSteps ?? PICKUP_WORKFLOW_STEPS.map((s) => s.label);
  const stepIndex =
    task?.pickupWorkflowStep ??
    (task ? getPickupWorkflowStepIndex({ status: task.status, pickup: task.pickup }) : 0);

  const isActivePickup = useMemo(() => {
    if (!task) return false;
    return ['rider_assigned_pickup', 'rider_assigned', 'picked_up', 'in_transit_to_shop'].includes(task.status);
  }, [task]);

  if (!task) {
    return (
      <Screen inStack>
        <DataLoadState loading={!loadError} error={loadError} loadingMessage="Loading pickup task…" onRetry={load} />
      </Screen>
    );
  }

  const p = task.pickup ?? {};
  const cash = task.cashPayment;
  const pickupCashDue = cash?.collectAt === 'pickup' && !cash.collected && !!p.customerVerifiedAt;
  const canCollectLaundry = !!p.customerVerifiedAt && !p.collectedAt && !pickupCashDue && !cashPendingSync;
  const isOffer = (task.status === 'shop_assigned' || task.status === 'confirmed') && !p.acceptedAt;
  const done = task.status === 'in_transit_to_shop' || task.status === 'received_at_shop' || task.status === 'received';
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
              <Ionicons name="arrow-up-circle-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Pickup route</Text>
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
            customerAddress: task.pickupAddress,
            shopName: task.shopName,
            branchName: task.branchName,
            branchCode: task.branchCode,
            shopLocation: task.shopLocation,
            shopPhone: task.shopPhone,
            shopPhoneMasked: task.shopPhoneMasked,
            canReject: task.canReject,
          }}
          taskType="pickup"
          showActions={isOffer || (isActivePickup && !done)}
          loading={loading}
          onAccept={
            isOffer
              ? () => run(() => riderFetch(`/riders/pickup-offers/${id}/accept`, { method: 'POST' }), 'Task accepted — navigate to customer')
              : undefined
          }
          onReject={task.canReject ? confirmReject : undefined}
        />

        {isActivePickup && !done && (
          <>
            {/* ── Head to customer ── */}
            {!p.arrivedAt && p.acceptedAt && (
              <StepCard
                icon="location-outline"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                title={task.customerName ?? 'Customer'}
                hint={
                  task.pickupAddress
                    ? [task.pickupAddress.line1, task.pickupAddress.city].filter(Boolean).join(', ')
                    : 'Navigate to the pickup address'
                }
              >
                <View style={styles.contactRow}>
                  {task.pickupAddress ? (
                    <View style={styles.contactBtn}>
                      <ActionBtn
                        label="Navigate"
                        icon="navigate-outline"
                        variant="primary"
                        inRow
                        disabled={loading}
                        onPress={() => promptNavigate(task.pickupAddress!)}
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
                  label="I've arrived"
                  icon="checkmark-circle-outline"
                  variant="accent"
                  disabled={loading}
                  onPress={() => run(() => riderFetch(`/riders/pickup-tasks/${id}/arrive`, { method: 'POST' }))}
                />
              </StepCard>
            )}

            {/* ── Verify customer ── */}
            {p.arrivedAt && !p.customerVerifiedAt && (
              <StepCard
                icon="person-circle-outline"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                title="Verify customer"
                hint="Confirm identity before collecting laundry."
              >
                {(task.customerName || task.customerPhoneMasked) ? (
                  <View style={styles.identityBox}>
                    {task.customerName ? (
                      <Text style={styles.identityName}>{task.customerName}</Text>
                    ) : null}
                    {task.customerPhoneMasked ? (
                      <Text style={styles.identityPhone}>
                        <Ionicons name="call-outline" size={12} color={colors.mutedForeground} /> ···· {task.customerPhoneMasked}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <ActionBtn
                  label="Scan Customer QR"
                  icon="qr-code-outline"
                  disabled={loading}
                  onPress={() => router.push({ pathname: '/scan', params: { orderId: id!, mode: 'customer_pickup' } })}
                />
                <OrDivider />
                <Input
                  placeholder="Last 4 digits of phone"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={verifyCode}
                  onChangeText={setVerifyCode}
                />
                <ActionBtn
                  label="Verify"
                  icon="shield-checkmark-outline"
                  disabled={loading || verifyCode.length !== 4}
                  onPress={() =>
                    run(() => riderFetch(`/riders/pickup-tasks/${id}/verify`, {
                      method: 'POST',
                      body: JSON.stringify({ code: verifyCode }),
                    }))
                  }
                />
              </StepCard>
            )}

            {/* ── Cash payment ── */}
            {p.customerVerifiedAt && cash?.collectAt === 'pickup' && (
              <CashPaymentCard
                cashPayment={cash}
                loading={loading}
                onCollect={
                  cash.canCollect
                    ? () => run(() => riderFetch(`/riders/pickup-tasks/${id}/collect-cash`, { method: 'POST' }), 'Cash payment recorded')
                    : undefined
                }
              />
            )}
            {cashPendingSync && cash?.collectAt === 'pickup' ? (
              <View style={styles.cacheBanner}>
                <Ionicons name="hourglass-outline" size={14} color={colors.warning} />
                <Text style={styles.cacheBannerText}>Cash collection pending sync — stay online before pickup</Text>
              </View>
            ) : null}

            {/* ── Collect laundry ── */}
            {canCollectLaundry && (
              <StepCard
                icon="cube-outline"
                iconBg={colors.accentLight}
                iconColor={colors.accentDark}
                title="Collect laundry"
                hint="Enter actual weight and confirm pickup."
              >
                <Input
                  placeholder="Actual weight (kg)"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                />
                <Input
                  placeholder="Notes (optional)"
                  value={notes}
                  onChangeText={setNotes}
                  style={styles.fieldGap}
                />
                <ActionBtn
                  label="Confirm pickup"
                  icon="checkmark-done-outline"
                  variant="accent"
                  disabled={loading}
                  onPress={() =>
                    run(() => riderFetch(`/riders/pickup-tasks/${id}/collect`, {
                      method: 'POST',
                      body: JSON.stringify({ actualWeightKg: Number(weight), notes: notes || undefined }),
                    }), 'Laundry picked up')
                  }
                />
              </StepCard>
            )}

            {/* ── Assign laundry tag ── */}
            {p.collectedAt && (
              <StepCard
                icon="pricetag-outline"
                iconBg={colors.accentLight}
                iconColor={colors.accentDark}
                title="Laundry tag"
                hint={task.laundryTagId ? 'Tag attached to this bag.' : 'Scan a tag to attach it to this bag.'}
              >
                <ActionBtn
                  label={task.laundryTagId ? 'Re-scan tag' : 'Scan tag'}
                  icon="qr-code-outline"
                  variant={task.laundryTagId ? 'outline' : 'accent'}
                  disabled={loading}
                  onPress={() => {
                    const goToScan = () =>
                      router.push({ pathname: '/scan', params: { orderId: id!, mode: 'assign_laundry_tag' } });
                    if (task.laundryTagId) {
                      Alert.alert(
                        'Replace laundry tag?',
                        'This bag already has a tag attached. Scanning a new one will replace it.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Scan new tag', style: 'destructive', onPress: goToScan },
                        ],
                      );
                      return;
                    }
                    goToScan();
                  }}
                />
              </StepCard>
            )}

            {/* ── Photo proof (persistent) ── */}
            {p.photoUrl ? (
              <StepCard
                icon="image-outline"
                iconBg={colors.surfaceMuted}
                iconColor={colors.mutedForeground}
                title="Pickup photo proof"
              >
                <AuthenticatedImage
                  path={p.photoUrl}
                  style={styles.photoPreview}
                  accessibilityLabel="Pickup photo proof"
                />
              </StepCard>
            ) : null}

            {/* ── Shop contact (visible from laundry collected onward) ── */}
            {p.collectedAt && shop && (
              <StepCard
                icon="storefront-outline"
                iconBg={colors.secondaryLight}
                iconColor={colors.secondaryDark}
                iconImageUri={resolveMediaUrl(task.branchLogoUrl)}
                title={task.branchName ?? shop.name}
                hint={`${shop.line1 ?? ''}, ${shop.city ?? ''}`.trim().replace(/^,\s*/, '')}
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
              </StepCard>
            )}

            {/* ── Take photo ── */}
            {p.collectedAt && !p.photoUrl && task.status === 'picked_up' && (
              <StepCard
                icon="camera-outline"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                title="Take photo proof"
                hint="Photograph the laundry bag as proof of pickup."
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
                      return riderUpload(`/riders/pickup-tasks/${id}/photo-upload`, captured.formData, id);
                    }, 'Photo proof saved')
                  }
                />
              </StepCard>
            )}

            {/* ── Generate receipt ── */}
            {p.photoUrl && !p.receiptCode && task.status === 'picked_up' && (
              <StepCard
                icon="document-text-outline"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                title="Generate receipt"
                hint="Create a pickup receipt code for shop handover."
              >
                <ActionBtn
                  label="Generate pickup receipt"
                  icon="receipt-outline"
                  disabled={loading}
                  onPress={() =>
                    run(async () => {
                      const res = await riderFetch<{ receiptCode: string }>(
                        `/riders/pickup-tasks/${id}/generate-receipt`,
                        { method: 'POST' },
                      );
                      Alert.alert('Receipt', res.receiptCode);
                    })
                  }
                />
              </StepCard>
            )}

            {/* ── Deliver to shop ── */}
            {p.receiptCode && !p.droppedAtShop && task.status === 'picked_up' && shop && (
              <StepCard
                icon="receipt-outline"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                title="Hand over at shop"
                hint="Scan or confirm handover to complete this pickup."
              >
                <ActionBtn
                  label="Scan Order QR"
                  icon="qr-code-outline"
                  variant="accent"
                  disabled={loading}
                  onPress={() => router.push({ pathname: '/scan', params: { orderId: id!, mode: 'order_handover' } })}
                />
                <ActionBtn
                  label="Deliver without scan"
                  icon="arrow-forward-outline"
                  variant="outline"
                  disabled={loading}
                  onPress={() =>
                    run(async () => {
                      const res = await riderFetch<{ earnings?: { amount: number; todayEarnings: number } }>(
                        `/riders/pickup-tasks/${id}/drop-at-shop`,
                        { method: 'POST' },
                      );
                      const earn = res.earnings;
                      Alert.alert(
                        'Delivered to shop',
                        earn
                          ? `in_transit_to_shop · +${formatCurrency(earn.amount)} (today ${formatCurrency(earn.todayEarnings)})`
                          : 'in_transit_to_shop',
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
        {p.receiptCode ? (
          <StepCard
            icon="receipt-outline"
            iconBg={colors.primaryLight}
            iconColor={colors.primary}
            title="Pickup receipt"
            hint="Present this code at the shop counter."
          >
            <View style={styles.receiptBox}>
              <Text style={styles.receiptCode}>{p.receiptCode}</Text>
            </View>
          </StepCard>
        ) : null}

        {/* ── Done ── */}
        {done && (
          <View style={styles.doneBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.accentDark} />
            <View style={styles.doneBannerText}>
              <Text style={styles.doneBannerTitle}>Pickup leg complete</Text>
              <Text style={styles.doneBannerHint}>Laundry is at the partner shop for processing.</Text>
            </View>
          </View>
        )}

      </Screen>
      {id ? (
        <SosButton orderId={id} taskActive={isActivePickup && !isOffer && !done} />
      ) : null}
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
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
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
  orderNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  statusPill: { backgroundColor: colors.primaryLight },
  statusPillText: { color: colors.primary },

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
  identityName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  identityPhone: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  fieldGap: { marginTop: spacing.sm },

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
  doneBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentDark,
  },
  doneBannerHint: {
    ...typography.bodySm,
    color: colors.accentDark,
    marginTop: spacing.xs,
    opacity: 0.8,
  },
});
