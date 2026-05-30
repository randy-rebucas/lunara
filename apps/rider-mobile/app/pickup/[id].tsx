import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatCurrency,
  getPickupWorkflowStepIndex,
  PICKUP_WORKFLOW_STEPS,
} from '@lunara/utils';
import { theme } from '@lunara/config';
import { OpsStepper } from '../../src/components/ops-stepper';
import { riderFetch } from '../../src/api';

interface ShopLocation {
  name: string;
  line1: string;
  city: string;
  province: string;
  latitude?: number;
  longitude?: number;
}

interface PickupTask {
  _id: string;
  status: string;
  bookingType: string;
  branchName?: string;
  estimatedWeightKg?: number;
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
  customerPhoneMasked?: string;
  pickupAddress?: {
    label: string;
    line1: string;
    city: string;
    latitude?: number;
    longitude?: number;
  } | null;
  shopLocation?: ShopLocation;
}

export default function PickupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<PickupTask | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [weight, setWeight] = useState('5');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await riderFetch<PickupTask>(`/riders/pickup-tasks/${id}`);
    setTask(data);
    if (data.estimatedWeightKg) setWeight(String(data.estimatedWeightKg));
  }, [id]);

  useEffect(() => {
    load().catch(() => Alert.alert('Error', 'Could not load pickup task'));
  }, [load]);

  async function run<T>(fn: () => Promise<T>, successMsg?: string) {
    setLoading(true);
    try {
      const res = await fn();
      await load();
      if (successMsg) Alert.alert('Done', successMsg);
      return res;
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  function openMaps(
    addr: { line1: string; city: string; province?: string; latitude?: number; longitude?: number },
  ) {
    const q = encodeURIComponent(`${addr.line1}, ${addr.city}`);
    const url =
      addr.latitude && addr.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${addr.latitude},${addr.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;
    Linking.openURL(url);
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
      <View style={styles.container}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const p = task.pickup ?? {};
  const isOffer =
    (task.status === 'shop_assigned' || task.status === 'confirmed') && !p.acceptedAt;
  const done =
    task.status === 'in_transit_to_shop' ||
    task.status === 'received_at_shop' ||
    task.status === 'received';
  const shop = task.shopLocation;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pickup workflow</Text>
      <Text style={styles.subtitle}>
        {task.bookingType.replace(/_/g, ' ')} · {task.status.replace(/_/g, ' ')}
      </Text>
      <OpsStepper steps={steps} currentIndex={stepIndex} />

      {task.pickupAddress && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer · {task.pickupAddress.label}</Text>
          <Text style={styles.cardBody}>
            {task.pickupAddress.line1}, {task.pickupAddress.city}
          </Text>
        </View>
      )}

      {task.branchName && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Assigned shop</Text>
          <Text style={styles.cardBody}>{task.branchName}</Text>
        </View>
      )}

      {isOffer && (
        <Pressable
          style={styles.primaryBtn}
          disabled={loading}
          onPress={() =>
            run(
              () => riderFetch(`/riders/pickup-offers/${id}/accept`, { method: 'POST' }),
              'Task accepted — navigate to customer',
            )
          }
        >
          <Text style={styles.primaryBtnText}>Rider accepts</Text>
        </Pressable>
      )}

      {isActivePickup && !done && (
        <>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => task.pickupAddress && openMaps(task.pickupAddress)}
          >
            <Text style={styles.secondaryBtnText}>Navigate to customer</Text>
          </Pressable>

          {!p.arrivedAt && p.acceptedAt && (
            <Pressable
              style={styles.primaryBtn}
              disabled={loading}
              onPress={() => run(() => riderFetch(`/riders/pickup-tasks/${id}/arrive`, { method: 'POST' }))}
            >
              <Text style={styles.primaryBtnText}>I&apos;ve arrived</Text>
            </Pressable>
          )}

          {p.arrivedAt && !p.customerVerifiedAt && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Verify customer</Text>
              {task.customerPhoneMasked && (
                <Text style={styles.statusHint}>Phone ends in {task.customerPhoneMasked}</Text>
              )}
              <TextInput
                style={styles.input}
                placeholder="Last 4 digits of phone"
                keyboardType="number-pad"
                maxLength={4}
                value={verifyCode}
                onChangeText={setVerifyCode}
              />
              <Pressable
                style={styles.primaryBtn}
                disabled={loading || verifyCode.length !== 4}
                onPress={() =>
                  run(() =>
                    riderFetch(`/riders/pickup-tasks/${id}/verify`, {
                      method: 'POST',
                      body: JSON.stringify({ code: verifyCode }),
                    }),
                  )
                }
              >
                <Text style={styles.primaryBtnText}>Verify</Text>
              </Pressable>
            </View>
          )}

          {p.customerVerifiedAt && !p.collectedAt && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pickup laundry</Text>
              <Text style={styles.statusHint}>Status will become picked_up</Text>
              <TextInput
                style={styles.input}
                placeholder="Actual weight (kg)"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
              />
              <TextInput
                style={styles.input}
                placeholder="Notes (optional)"
                value={notes}
                onChangeText={setNotes}
              />
              <Pressable
                style={styles.primaryBtn}
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
              >
                <Text style={styles.primaryBtnText}>Confirm pickup</Text>
              </Pressable>
            </View>
          )}

          {p.collectedAt && !p.photoUrl && task.status === 'picked_up' && (
            <Pressable
              style={styles.primaryBtn}
              disabled={loading}
              onPress={() =>
                run(() =>
                  riderFetch(`/riders/pickup-tasks/${id}/photo`, {
                    method: 'POST',
                    body: JSON.stringify({
                      photoUrl: `https://storage.lunara.dev/pickup/${id}-${Date.now()}.jpg`,
                    }),
                  }),
                )
              }
            >
              <Text style={styles.primaryBtnText}>Take photo</Text>
            </Pressable>
          )}

          {p.photoUrl && !p.receiptCode && task.status === 'picked_up' && (
            <Pressable
              style={styles.primaryBtn}
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
            >
              <Text style={styles.primaryBtnText}>Generate pickup receipt</Text>
            </Pressable>
          )}

          {p.receiptCode && !p.droppedAtShop && task.status === 'picked_up' && shop && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Deliver to assigned shop · {shop.name}</Text>
                <Text style={styles.cardBody}>
                  {shop.line1}, {shop.city}
                </Text>
                <Text style={styles.statusHint}>Status will become in_transit_to_shop</Text>
              </View>
              <Pressable style={styles.secondaryBtn} onPress={() => openMaps(shop)}>
                <Text style={styles.secondaryBtnText}>Navigate to laundry shop</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
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
              >
                <Text style={styles.primaryBtnText}>Deliver to assigned shop</Text>
              </Pressable>
            </>
          )}
        </>
      )}

      {p.receiptCode && (
        <View style={[styles.card, styles.receiptCard]}>
          <Text style={styles.cardTitle}>Pickup receipt</Text>
          <Text style={styles.receiptCode}>{p.receiptCode}</Text>
        </View>
      )}

      {done && (
        <View style={[styles.card, { borderColor: theme.colors.accent }]}>
          <Text style={styles.cardTitle}>Pickup leg complete</Text>
          <Text style={styles.cardBody}>Laundry is at the partner shop for processing.</Text>
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
  statusHint: { marginTop: 4, fontSize: 12, color: theme.colors.accent },
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
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
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
  receiptCard: { borderColor: theme.colors.accent },
  receiptCode: { marginTop: 8, fontSize: 20, fontWeight: '700', letterSpacing: 1 },
});
