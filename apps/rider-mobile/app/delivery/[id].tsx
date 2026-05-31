import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import {
  DELIVERY_WORKFLOW_STEPS,
  formatCurrency,
  getDeliveryWorkflowStepIndex,
} from '@lunara/utils';
import { OpsStepper } from '../../src/components/ops-stepper';
import { TaskDetailsCard } from '../../src/components/task-details-card';
import { DataLoadState } from '../../src/components/data-load-state';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { riderFetch, riderUpload, loadTaskWithCache, isQueuedResponse } from '../../src/api';
import { useRiderOrderSocket } from '../../src/hooks/use-rider-dispatch-socket';
import { useOrderPendingCount } from '../../src/hooks/use-offline-sync';
import { PendingSyncChip } from '../../src/components/pending-sync-chip';
import { SosButton } from '../../src/components/sos-button';
import { loadTaskCache } from '../../src/lib/offline/task-cache';
import { isOnline } from '../../src/lib/offline/network';
import { captureTaskPhoto } from '../../src/lib/task-photo';
import { resolveMediaUrl } from '../../src/lib/media-url';
import { callPhone, promptNavigate } from '../../src/lib/task-contact';
import type { RiderShopLocation, RiderTaskAddress } from '../../src/lib/rider-task-types';
import { colors, spacing, typography } from '../../src/theme';

interface DeliveryTask {
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
}

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

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useRiderOrderSocket(id, load);

  async function run<T>(fn: () => Promise<T>, msg?: string) {
    setLoading(true);
    try {
      const res = await fn();
      if (isQueuedResponse(res)) {
        const cached = id ? await loadTaskCache<DeliveryTask>(id) : null;
        if (cached) {
          setTask(cached);
          setFromCache(true);
        }
        if (msg) {
          Alert.alert('Saved offline', `${msg} — will sync when you're back online.`);
        }
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

  function photoUri(url?: string) {
    if (!url) return undefined;
    if (url.startsWith('file://')) return url;
    return resolveMediaUrl(url);
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
        <DataLoadState
          loading={!loadError}
          error={loadError}
          loadingMessage="Loading delivery task…"
          onRetry={load}
        />
      </Screen>
    );
  }

  const d = task.delivery ?? {};
  const steps =
    task.deliveryWorkflowSteps ?? DELIVERY_WORKFLOW_STEPS.map((s) => s.label);
  const stepIndex =
    task.deliveryWorkflowStep ??
    getDeliveryWorkflowStepIndex({ status: task.status, delivery: d });
  const isAssigned = task.status === 'rider_assigned_delivery';
  const isOffer =
    task.status === 'ready_for_delivery' && !d.acceptedAt && !isAssigned;
  const done = task.status === 'delivered' || task.status === 'completed';
  const isActiveDelivery = Boolean(d.acceptedAt && !done && !isOffer);

  return (
    <View style={styles.screenWrap}>
      <Screen scroll inStack contentStyle={styles.content}>
      <Text style={styles.title}>Delivery route</Text>
      <Text style={styles.subtitle}>
        {task.bookingType.replace(/_/g, ' ')} · {task.status.replace(/_/g, ' ')}
        {task.branchName ? ` · ${task.branchName}` : ''}
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
            ? () =>
                run(
                  () => riderFetch(`/riders/delivery-offers/${id}/accept`, { method: 'POST' }),
                  'Assignment acknowledged',
                )
            : undefined
        }
        onReject={task.canReject ? confirmReject : undefined}
        onNavigateCustomer={
          task.deliveryAddress && d.pickedUpFromShopAt
            ? () => promptNavigate(task.deliveryAddress!)
            : undefined
        }
        onNavigateShop={
          task.shopLocation ? () => promptNavigate(task.shopLocation!) : undefined
        }
        onCallCustomer={() => callPhone(task.customerPhone)}
        onCallShop={() => callPhone(task.shopPhone)}
      />

      {isOffer && (
        <Card muted style={styles.card}>
          <Text style={styles.cardTitle}>Awaiting Lunara assignment</Text>
          <Text style={styles.hint}>
            This order is ready at the shop. Operations will assign you — check Active tasks on
            the home screen.
          </Text>
        </Card>
      )}

      {d.acceptedAt && !done && (
        <>
          {task.canPickupFromShop && (
            <Button
              label="Rider pickup from shop"
              disabled={loading}
              onPress={() =>
                run(
                  () =>
                    riderFetch(`/riders/delivery-tasks/${id}/pickup-from-shop`, {
                      method: 'POST',
                    }),
                  'Picked up from shop',
                )
              }
              style={styles.action}
            />
          )}

          {task.canGoOutForDelivery && (
            <Button
              label="Out for delivery"
              disabled={loading}
              onPress={() =>
                run(
                  () =>
                    riderFetch(`/riders/delivery-tasks/${id}/out-for-delivery`, {
                      method: 'POST',
                    }),
                  'Status: out_for_delivery',
                )
              }
              style={styles.action}
            />
          )}

          {task.canMarkCustomerReceived && (
            <>
              <Button
                label="Scan Customer QR"
                disabled={loading}
                onPress={() =>
                  router.push({
                    pathname: '/scan',
                    params: { orderId: id!, mode: 'customer_delivery' },
                  })
                }
                style={styles.action}
              />
              <Button
                label="Customer receives (manual)"
                variant="outline"
                disabled={loading}
                onPress={() =>
                  run(
                    () =>
                      riderFetch(`/riders/delivery-tasks/${id}/customer-received`, {
                        method: 'POST',
                      }),
                    'Or customer verifies in their app',
                  )
                }
                style={styles.action}
              />
            </>
          )}

          {(task.customerReceived || d.customerReceivedAt) && (
            <Card elevated style={styles.card}>
              <Text style={styles.cardTitle}>Customer handoff</Text>
              {task.customerPhoneMasked && (
                <Text style={styles.hint}>Customer phone ends in {task.customerPhoneMasked}</Text>
              )}
              <Text style={styles.hint}>
                Customer can verify (last 4 of phone) and sign in their app after photo proof.
              </Text>
              <Text style={styles.hint}>
                Received: {task.customerReceived ? 'Yes ✓' : 'Waiting…'} · Signed:{' '}
                {task.customerSigned ? 'Yes ✓' : 'Waiting…'}
              </Text>
            </Card>
          )}

          {task.canCapturePhoto && (
            <Button
              label="Photo proof"
              disabled={loading}
              onPress={() =>
                run(async () => {
                  const captured = await captureTaskPhoto();
                  if (!captured) return;
                  return riderUpload(
                    `/riders/delivery-tasks/${id}/photo-upload`,
                    captured.formData,
                    id,
                  );
                }, 'Photo proof saved')
              }
              style={styles.action}
            />
          )}

          {d.photoUrl ? (
            <Card elevated style={styles.card}>
              <Text style={styles.cardTitle}>Delivery photo proof</Text>
              <Image
                source={{ uri: photoUri(d.photoUrl) }}
                style={styles.photoPreview}
                accessibilityLabel="Delivery photo proof"
              />
            </Card>
          ) : null}

          {task.canComplete && (
            <Button
              label="Complete (delivered)"
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
                    `${res.receiptCode} · delivered → completed${
                      earn
                        ? `\n+${formatCurrency(earn.amount)} (today ${formatCurrency(earn.todayEarnings)})`
                        : ''
                    }`,
                  );
                  router.back();
                })
              }
              style={styles.action}
            />
          )}
        </>
      )}

      {d.receiptCode && (
        <Card accent style={styles.card}>
          <Text style={styles.cardTitle}>Delivery receipt</Text>
          <Text style={styles.receiptCode}>{d.receiptCode}</Text>
        </Card>
      )}

      {done && (
        <Card accent style={styles.card}>
          <Text style={styles.cardTitle}>Delivery complete</Text>
          <Text style={styles.cardBody}>Order delivered and completed.</Text>
        </Card>
      )}
      </Screen>
      {id ? <SosButton orderId={id} taskActive={isActiveDelivery} /> : null}
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
  card: { marginTop: spacing.lg },
  cardTitle: { ...typography.subheading, fontSize: 16 },
  cardBody: { marginTop: spacing.xs + 2, ...typography.bodySm },
  hint: { marginTop: spacing.sm, ...typography.bodySm },
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
    color: colors.foreground,
  },
});
