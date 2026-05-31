import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text } from 'react-native';
import {
  DELIVERY_WORKFLOW_STEPS,
  formatCurrency,
  getDeliveryWorkflowStepIndex,
} from '@lunara/utils';
import { OpsStepper } from '../../src/components/ops-stepper';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { riderFetch } from '../../src/api';
import { colors, spacing, typography } from '../../src/theme';

interface DeliveryTask {
  _id: string;
  status: string;
  bookingType: string;
  branchName?: string;
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
  customerPhoneMasked?: string;
  deliveryAddress?: {
    label: string;
    line1: string;
    city: string;
    latitude?: number;
    longitude?: number;
  } | null;
}

export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<DeliveryTask | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await riderFetch<DeliveryTask>(`/riders/delivery-tasks/${id}`);
    setTask(data);
  }, [id]);

  useEffect(() => {
    load().catch((e) =>
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load delivery'),
    );
  }, [load]);

  useEffect(() => {
    if (!task?.delivery?.customerReceivedAt || task.customerSigned) return;
    const interval = setInterval(() => {
      load().catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [task?.delivery?.customerReceivedAt, task?.customerSigned, load]);

  async function run<T>(fn: () => Promise<T>, msg?: string) {
    setLoading(true);
    try {
      await fn();
      await load();
      if (msg) Alert.alert('Done', msg);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  function openMaps(
    addr: { line1: string; city: string; latitude?: number; longitude?: number },
  ) {
    const q = encodeURIComponent(`${addr.line1}, ${addr.city}`);
    const url =
      addr.latitude && addr.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${addr.latitude},${addr.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;
    Linking.openURL(url);
  }

  if (!task) {
    return (
      <Screen inStack>
        <Text style={typography.body}>Loading…</Text>
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

  return (
    <Screen scroll inStack contentStyle={styles.content}>
      <Text style={styles.title}>Delivery route</Text>
      <Text style={styles.subtitle}>
        {task.bookingType.replace(/_/g, ' ')} · {task.status.replace(/_/g, ' ')}
        {task.branchName ? ` · ${task.branchName}` : ''}
      </Text>
      <OpsStepper steps={steps} currentIndex={stepIndex} />

      {task.branchName && (
        <Card elevated style={styles.card}>
          <Text style={styles.cardTitle}>Pickup from shop</Text>
          <Text style={styles.cardBody}>{task.branchName}</Text>
        </Card>
      )}

      {task.deliveryAddress && (
        <Card elevated style={styles.card}>
          <Text style={styles.cardTitle}>Deliver to · {task.deliveryAddress.label}</Text>
          <Text style={styles.cardBody}>
            {task.deliveryAddress.line1}, {task.deliveryAddress.city}
          </Text>
        </Card>
      )}

      {isOffer && (
        <Card muted style={styles.card}>
          <Text style={styles.cardTitle}>Awaiting Lunara assignment</Text>
          <Text style={styles.hint}>
            This order is ready at the shop. Operations will assign you — check Active tasks on
            the home screen.
          </Text>
        </Card>
      )}

      {isAssigned && !d.acceptedAt && (
        <Button
          label="Acknowledge assignment"
          disabled={loading}
          onPress={() =>
            run(
              () => riderFetch(`/riders/delivery-offers/${id}/accept`, { method: 'POST' }),
              'Assignment acknowledged',
            )
          }
          style={styles.action}
        />
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

          {task.status === 'out_for_delivery' && d.pickedUpFromShopAt && (
            <Button
              label="Navigate to customer"
              variant="secondary"
              onPress={() => task.deliveryAddress && openMaps(task.deliveryAddress)}
              style={styles.action}
            />
          )}

          {task.canMarkCustomerReceived && (
            <Button
              label="Customer receives"
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
                run(
                  () =>
                    riderFetch(`/riders/delivery-tasks/${id}/photo`, {
                      method: 'POST',
                      body: JSON.stringify({
                        photoUrl: `https://storage.lunara.dev/delivery/${id}-${Date.now()}.jpg`,
                      }),
                    }),
                  'Photo proof saved',
                )
              }
              style={styles.action}
            />
          )}

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
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  title: { ...typography.title, fontSize: 22 },
  subtitle: {
    marginTop: spacing.xs,
    ...typography.bodySm,
    textTransform: 'capitalize',
  },
  card: { marginTop: spacing.lg },
  cardTitle: { ...typography.subheading, fontSize: 16 },
  cardBody: { marginTop: spacing.xs + 2, ...typography.bodySm },
  hint: { marginTop: spacing.sm, ...typography.bodySm },
  action: { marginTop: spacing.lg },
  receiptCode: {
    marginTop: spacing.sm,
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
});
