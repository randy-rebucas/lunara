import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  DELIVERY_WORKFLOW_STEPS,
  formatCurrency,
  getDeliveryWorkflowStepIndex,
} from '@lunara/utils';
import { theme } from '@lunara/config';
import { OpsStepper } from '../../src/components/ops-stepper';
import { riderFetch } from '../../src/api';

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
    load().catch(() => Alert.alert('Error', 'Could not load delivery'));
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
      <View style={styles.container}>
        <Text>Loading…</Text>
      </View>
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Customer delivery</Text>
      <Text style={styles.subtitle}>
        {task.bookingType.replace(/_/g, ' ')} · {task.status.replace(/_/g, ' ')}
        {task.branchName ? ` · ${task.branchName}` : ''}
      </Text>
      <OpsStepper steps={steps} currentIndex={stepIndex} />

      {task.branchName && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pickup from shop</Text>
          <Text style={styles.cardBody}>{task.branchName}</Text>
        </View>
      )}

      {task.deliveryAddress && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Deliver to · {task.deliveryAddress.label}</Text>
          <Text style={styles.cardBody}>
            {task.deliveryAddress.line1}, {task.deliveryAddress.city}
          </Text>
        </View>
      )}

      {isOffer && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Awaiting Lunara assignment</Text>
          <Text style={styles.hint}>
            This order is ready at the shop. Operations will assign you — check Active tasks on
            the home screen.
          </Text>
        </View>
      )}

      {isAssigned && !d.acceptedAt && (
        <Pressable
          style={styles.primaryBtn}
          disabled={loading}
          onPress={() =>
            run(
              () => riderFetch(`/riders/delivery-offers/${id}/accept`, { method: 'POST' }),
              'Assignment acknowledged',
            )
          }
        >
          <Text style={styles.primaryBtnText}>Acknowledge assignment</Text>
        </Pressable>
      )}

      {d.acceptedAt && !done && (
        <>
          {task.canPickupFromShop && (
            <Pressable
              style={styles.primaryBtn}
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
            >
              <Text style={styles.primaryBtnText}>Rider pickup from shop</Text>
            </Pressable>
          )}

          {task.canGoOutForDelivery && (
            <Pressable
              style={styles.primaryBtn}
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
            >
              <Text style={styles.primaryBtnText}>Out for delivery</Text>
            </Pressable>
          )}

          {task.status === 'out_for_delivery' && d.pickedUpFromShopAt && (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() =>
                task.deliveryAddress && openMaps(task.deliveryAddress)
              }
            >
              <Text style={styles.secondaryBtnText}>Navigate to customer</Text>
            </Pressable>
          )}

          {task.canMarkCustomerReceived && (
            <Pressable
              style={styles.primaryBtn}
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
            >
              <Text style={styles.primaryBtnText}>Customer receives</Text>
            </Pressable>
          )}

          {(task.customerReceived || d.customerReceivedAt) && (
            <View style={styles.card}>
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
            </View>
          )}

          {task.canCapturePhoto && (
            <Pressable
              style={styles.primaryBtn}
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
            >
              <Text style={styles.primaryBtnText}>Photo proof</Text>
            </Pressable>
          )}

          {task.canComplete && (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: theme.colors.accent }]}
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
            >
              <Text style={styles.primaryBtnText}>Complete (delivered)</Text>
            </Pressable>
          )}
        </>
      )}

      {d.receiptCode && (
        <View style={[styles.card, styles.receipt]}>
          <Text style={styles.cardTitle}>Delivery receipt</Text>
          <Text style={styles.receiptCode}>{d.receiptCode}</Text>
        </View>
      )}

      {done && (
        <View style={[styles.card, { borderColor: theme.colors.accent }]}>
          <Text style={styles.cardTitle}>Delivery complete</Text>
          <Text style={styles.cardBody}>Order delivered and completed.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { marginTop: 4, fontSize: 14, color: '#64748b', textTransform: 'capitalize' },
  card: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontWeight: '600', fontSize: 16 },
  cardBody: { marginTop: 6, color: '#64748b' },
  hint: { marginTop: 8, fontSize: 13, color: '#64748b' },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  secondaryBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: theme.colors.primary, fontWeight: '600' },
  receipt: { borderColor: theme.colors.accent },
  receiptCode: { marginTop: 8, fontSize: 20, fontWeight: '700' },
});
