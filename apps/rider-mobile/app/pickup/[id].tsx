import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
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
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
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
import { callPhone, promptNavigate } from '../../src/lib/task-contact';
import type { RiderShopLocation, RiderTaskAddress } from '../../src/lib/rider-task-types';
import { colors, spacing, typography } from '../../src/theme';

interface PickupTask {
  _id: string;
  status: string;
  bookingType: string;
  orderNumber?: string;
  branchName?: string;
  branchCode?: string;
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

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useRiderOrderSocket(id, load);

  async function run<T>(fn: () => Promise<T>, successMsg?: string) {
    setLoading(true);
    try {
      const res = await fn();
      if (isQueuedResponse(res)) {
        const cached = id ? await loadTaskCache<PickupTask>(id) : null;
        if (cached) {
          setTask(cached);
          setFromCache(true);
        }
        if (successMsg) {
          Alert.alert('Saved offline', `${successMsg} — will sync when you're back online.`);
        }
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
      prev
        ? {
            ...prev,
            pickup: { ...prev.pickup, photoUrl: localUri },
          }
        : prev,
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

  const steps =
    task?.pickupWorkflowSteps ?? PICKUP_WORKFLOW_STEPS.map((s) => s.label);
  const stepIndex =
    task?.pickupWorkflowStep ??
    (task
      ? getPickupWorkflowStepIndex({ status: task.status, pickup: task.pickup })
      : 0);

  const isActivePickup = useMemo(() => {
    if (!task) return false;
    return [
      'rider_assigned_pickup',
      'rider_assigned',
      'picked_up',
      'in_transit_to_shop',
    ].includes(task.status);
  }, [task]);

  if (!task) {
    return (
      <Screen inStack>
        <DataLoadState
          loading={!loadError}
          error={loadError}
          loadingMessage="Loading pickup task…"
          onRetry={load}
        />
      </Screen>
    );
  }

  const p = task.pickup ?? {};
  const cash = task.cashPayment;
  const pickupCashDue =
    cash?.collectAt === 'pickup' && !cash.collected && !!p.customerVerifiedAt;
  const canCollectLaundry =
    !!p.customerVerifiedAt && !p.collectedAt && !pickupCashDue && !cashPendingSync;
  const isOffer =
    (task.status === 'shop_assigned' || task.status === 'confirmed') && !p.acceptedAt;
  const done =
    task.status === 'in_transit_to_shop' ||
    task.status === 'received_at_shop' ||
    task.status === 'received';
  const shop = task.shopLocation;

  return (
    <View style={styles.screenWrap}>
      <Screen scroll inStack contentStyle={styles.content}>
        <Text style={styles.title}>Pickup route</Text>
        <Text style={styles.subtitle}>
          {task.bookingType.replace(/_/g, ' ')} · {task.status.replace(/_/g, ' ')}
        </Text>
        <OpsStepper steps={steps} currentIndex={stepIndex} />
        {pendingCount > 0 ? <PendingSyncChip /> : null}
        {fromCache ? (
          <Text style={styles.cacheHint}>Showing cached task — changes sync when online</Text>
        ) : null}

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
              ? () =>
                  run(
                    () => riderFetch(`/riders/pickup-offers/${id}/accept`, { method: 'POST' }),
                    'Task accepted — navigate to customer',
                  )
              : undefined
          }
          onReject={task.canReject ? confirmReject : undefined}
          onNavigateCustomer={
            task.pickupAddress
              ? () => promptNavigate(task.pickupAddress!)
              : undefined
          }
          onNavigateShop={shop ? () => promptNavigate(shop) : undefined}
          onCallCustomer={() => callPhone(task.customerPhone)}
          onCallShop={() => callPhone(task.shopPhone)}
        />

        {isActivePickup && !done && (
          <>
            {!p.arrivedAt && p.acceptedAt && (
              <Button
                label="I've arrived"
                disabled={loading}
                onPress={() =>
                  run(() => riderFetch(`/riders/pickup-tasks/${id}/arrive`, { method: 'POST' }))
                }
                style={styles.action}
              />
            )}

            {p.arrivedAt && !p.customerVerifiedAt && (
              <Card elevated style={styles.card}>
                <Text style={styles.cardTitle}>Verify customer</Text>
                {task.customerPhoneMasked && (
                  <Text style={styles.statusHint}>Phone ends in {task.customerPhoneMasked}</Text>
                )}
                <Button
                  label="Scan Customer QR"
                  disabled={loading}
                  onPress={() =>
                    router.push({
                      pathname: '/scan',
                      params: { orderId: id!, mode: 'customer_pickup' },
                    })
                  }
                  style={styles.action}
                />
                <Text style={styles.orDivider}>or enter code manually</Text>
                <Input
                  style={styles.field}
                  placeholder="Last 4 digits of phone"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={verifyCode}
                  onChangeText={setVerifyCode}
                />
                <Button
                  label="Verify"
                  disabled={loading || verifyCode.length !== 4}
                  onPress={() =>
                    run(() =>
                      riderFetch(`/riders/pickup-tasks/${id}/verify`, {
                        method: 'POST',
                        body: JSON.stringify({ code: verifyCode }),
                      }),
                    )
                  }
                />
              </Card>
            )}

            {p.customerVerifiedAt && cash?.collectAt === 'pickup' && (
              <CashPaymentCard
                cashPayment={cash}
                loading={loading}
                onCollect={
                  cash.canCollect
                    ? () =>
                        run(
                          () =>
                            riderFetch(`/riders/pickup-tasks/${id}/collect-cash`, {
                              method: 'POST',
                            }),
                          'Cash payment recorded',
                        )
                    : undefined
                }
              />
            )}

            {cashPendingSync && cash?.collectAt === 'pickup' ? (
              <Text style={styles.cacheHint}>Cash collection pending sync — stay online before pickup</Text>
            ) : null}

            {canCollectLaundry && (
              <Card elevated style={styles.card}>
                <Text style={styles.cardTitle}>Pickup laundry</Text>
                <Text style={styles.statusHint}>Status will become picked_up</Text>
                <Input
                  style={styles.field}
                  placeholder="Actual weight (kg)"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                />
                <Input
                  style={styles.field}
                  placeholder="Notes (optional)"
                  value={notes}
                  onChangeText={setNotes}
                />
                <Button
                  label="Confirm pickup"
                  disabled={loading}
                  onPress={() =>
                    run(
                      () =>
                        riderFetch(`/riders/pickup-tasks/${id}/collect`, {
                          method: 'POST',
                          body: JSON.stringify({
                            actualWeightKg: Number(weight),
                            notes: notes || undefined,
                          }),
                        }),
                      'Laundry picked up',
                    )
                  }
                />
              </Card>
            )}

            {p.collectedAt && !p.photoUrl && task.status === 'picked_up' && (
              <Button
                label="Take photo"
                disabled={loading}
                onPress={() =>
                  run(async () => {
                    const captured = await captureTaskPhoto();
                    if (!captured) return;
                    applyLocalPhotoPreview(captured.localUri);
                    return riderUpload(
                      `/riders/pickup-tasks/${id}/photo-upload`,
                      captured.formData,
                      id,
                    );
                  }, 'Photo proof saved')
                }
                style={styles.action}
              />
            )}

            {p.photoUrl && !p.receiptCode && task.status === 'picked_up' && (
              <Button
                label="Generate pickup receipt"
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
                style={styles.action}
              />
            )}

            {p.receiptCode && !p.droppedAtShop && task.status === 'picked_up' && shop && (
              <>
                <Card elevated style={styles.card}>
                  <Text style={styles.cardTitle}>Deliver to assigned shop · {shop.name}</Text>
                  <Text style={styles.cardBody}>
                    {shop.line1}, {shop.city}
                  </Text>
                  <Text style={styles.statusHint}>Status will become in_transit_to_shop</Text>
                </Card>
                <Button
                  label="Scan Order QR"
                  variant="accent"
                  disabled={loading}
                  onPress={() =>
                    router.push({
                      pathname: '/scan',
                      params: { orderId: id!, mode: 'order_handover' },
                    })
                  }
                  style={styles.action}
                />
                <Button
                  label="Deliver without scan"
                  variant="outline"
                  disabled={loading}
                  onPress={() =>
                    run(async () => {
                      const res = await riderFetch<{
                        earnings?: { amount: number; todayEarnings: number };
                      }>(`/riders/pickup-tasks/${id}/drop-at-shop`, { method: 'POST' });
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
                  style={styles.action}
                />
              </>
            )}
          </>
        )}

        {p.photoUrl ? (
          <Card elevated style={styles.card}>
            <Text style={styles.cardTitle}>Pickup photo proof</Text>
            <AuthenticatedImage
              path={p.photoUrl}
              style={styles.photoPreview}
              accessibilityLabel="Pickup photo proof"
            />
          </Card>
        ) : null}

        {p.receiptCode && (
          <Card accent style={styles.card}>
            <Text style={styles.cardTitle}>Pickup receipt</Text>
            <Text style={styles.receiptCode}>{p.receiptCode}</Text>
          </Card>
        )}

        {done && (
          <Card accent style={styles.card}>
            <Text style={styles.cardTitle}>Pickup leg complete</Text>
            <Text style={styles.cardBody}>Laundry is at the partner shop for processing.</Text>
          </Card>
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
  title: { ...typography.title, fontSize: 22 },
  subtitle: {
    marginTop: spacing.xs,
    ...typography.bodySm,
    textTransform: 'capitalize',
  },
  cacheHint: {
    marginTop: spacing.sm,
    ...typography.caption,
    color: colors.warning,
  },
  statusHint: { marginTop: spacing.xs, fontSize: 12, color: colors.accentDark, fontWeight: '500' },
  card: { marginTop: spacing.lg },
  cardTitle: { ...typography.subheading, fontSize: 16 },
  cardBody: { marginTop: spacing.xs + 2, ...typography.bodySm },
  field: { marginTop: spacing.md },
  action: { marginTop: spacing.lg },
  photoPreview: {
    marginTop: spacing.sm,
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  receiptCode: {
    marginTop: spacing.sm,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.foreground,
  },
  orDivider: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
    fontSize: 12,
    color: colors.mutedForeground,
  },
});
