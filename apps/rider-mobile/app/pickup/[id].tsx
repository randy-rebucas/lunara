import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import {
  formatCurrency,
  getPickupWorkflowStepIndex,
  PICKUP_WORKFLOW_STEPS,
} from '@lunara/utils';
import { OpsStepper } from '../../src/components/ops-stepper';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { Screen } from '../../src/components/ui/screen';
import { riderFetch } from '../../src/api';
import { colors, spacing, typography } from '../../src/theme';

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
      <Screen inStack>
        <Text style={typography.body}>Loading…</Text>
      </Screen>
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
    <Screen scroll inStack contentStyle={styles.content}>
      <Text style={styles.title}>Pickup route</Text>
      <Text style={styles.subtitle}>
        {task.bookingType.replace(/_/g, ' ')} · {task.status.replace(/_/g, ' ')}
      </Text>
      <OpsStepper steps={steps} currentIndex={stepIndex} />

      {task.pickupAddress && (
        <Card elevated style={styles.card}>
          <Text style={styles.cardTitle}>Customer · {task.pickupAddress.label}</Text>
          <Text style={styles.cardBody}>
            {task.pickupAddress.line1}, {task.pickupAddress.city}
          </Text>
        </Card>
      )}

      {task.branchName && (
        <Card elevated style={styles.card}>
          <Text style={styles.cardTitle}>Assigned shop</Text>
          <Text style={styles.cardBody}>{task.branchName}</Text>
        </Card>
      )}

      {isOffer && (
        <Button
          label="Rider accepts"
          disabled={loading}
          onPress={() =>
            run(
              () => riderFetch(`/riders/pickup-offers/${id}/accept`, { method: 'POST' }),
              'Task accepted — navigate to customer',
            )
          }
          style={styles.action}
        />
      )}

      {isActivePickup && !done && (
        <>
          <Button
            label="Navigate to customer"
            variant="outline"
            onPress={() => task.pickupAddress && openMaps(task.pickupAddress)}
            style={styles.action}
          />

          {!p.arrivedAt && p.acceptedAt && (
            <Button
              label="I've arrived"
              disabled={loading}
              onPress={() => run(() => riderFetch(`/riders/pickup-tasks/${id}/arrive`, { method: 'POST' }))}
              style={styles.action}
            />
          )}

          {p.arrivedAt && !p.customerVerifiedAt && (
            <Card elevated style={styles.card}>
              <Text style={styles.cardTitle}>Verify customer</Text>
              {task.customerPhoneMasked && (
                <Text style={styles.statusHint}>Phone ends in {task.customerPhoneMasked}</Text>
              )}
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

          {p.customerVerifiedAt && !p.collectedAt && (
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
                run(() =>
                  riderFetch(`/riders/pickup-tasks/${id}/photo`, {
                    method: 'POST',
                    body: JSON.stringify({
                      photoUrl: `https://storage.lunara.dev/pickup/${id}-${Date.now()}.jpg`,
                    }),
                  }),
                )
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
                label="Navigate to laundry shop"
                variant="secondary"
                onPress={() => openMaps(shop)}
                style={styles.action}
              />
              <Button
                label="Deliver to assigned shop"
                variant="accent"
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
  statusHint: { marginTop: spacing.xs, fontSize: 12, color: colors.accentDark, fontWeight: '500' },
  card: { marginTop: spacing.lg },
  cardTitle: { ...typography.subheading, fontSize: 16 },
  cardBody: { marginTop: spacing.xs + 2, ...typography.bodySm },
  field: { marginTop: spacing.md },
  action: { marginTop: spacing.lg },
  receiptCode: {
    marginTop: spacing.sm,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.foreground,
  },
});
