import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BranchPricingMode, type PartnerReceivingView } from '@lunara/types';
import { estimateMachineLoads, formatCurrency } from '@lunara/utils';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { Input } from '../../../src/components/ui/input';
import { Screen } from '../../../src/components/ui/screen';
import { partnerFetch } from '../../../src/api';
import { colors, radius, spacing, typography } from '../../../src/theme';

/** Mirrors apps/partner-web/src/app/orders/[id]/receiving/page.tsx (weight/item shop-intake checklist). */
export default function ShopReceivingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [view, setView] = useState<PartnerReceivingView | null>(null);
  const [weight, setWeight] = useState('');
  const [loadCount, setLoadCount] = useState('');
  const [pieceCount, setPieceCount] = useState('');
  const [itemCount, setItemCount] = useState('1');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await partnerFetch<PartnerReceivingView>(`/partner/orders/${id}/receiving`);
    setView(data);
    if (data.shopReceiving?.verifiedWeightKg) {
      setWeight(String(data.shopReceiving.verifiedWeightKg));
    } else if (data.order.estimatedWeightKg) {
      setWeight(String(data.order.estimatedWeightKg));
    } else if (data.order.pickup?.actualWeightKg) {
      setWeight(String(data.order.pickup.actualWeightKg));
    }
    if (data.order.pickup?.actualLoadCount) {
      setLoadCount(String(data.order.pickup.actualLoadCount));
    } else if (data.order.estimatedLoadCount) {
      setLoadCount(String(data.order.estimatedLoadCount));
    }
    if (data.order.pickup?.actualPieceCount) {
      setPieceCount(String(data.order.pickup.actualPieceCount));
    } else if (data.order.estimatedPieceCount) {
      setPieceCount(String(data.order.estimatedPieceCount));
    }
    if (data.shopReceiving?.itemCount) setItemCount(String(data.shopReceiving.itemCount));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  async function run(step: string, body?: object) {
    setBusy(true);
    setError('');
    try {
      await partnerFetch(`/partner/orders/${id}/receiving/${step}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Screen inStack centered>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!view) {
    return (
      <Screen inStack>
        <Text style={styles.error}>{error || 'Order not found.'}</Text>
      </Screen>
    );
  }

  const est = view.order.estimatedWeightKg;
  const riderWt = view.order.pickup?.actualWeightKg;
  const variance = est != null && riderWt != null ? Math.abs(riderWt - est) : null;
  const waitingForRider = !view.canReceive && !view.canVerifyWeight && !view.canConfirmItems && !view.isComplete;

  return (
    <Screen inStack scroll contentStyle={styles.content}>
      <>
        <Text style={styles.bookingType}>{view.order.bookingType.replace(/_/g, ' ')}</Text>
        <Text style={styles.status}>{view.order.status.replace(/_/g, ' ')}</Text>

        {view.order.pickup?.receiptCode ? (
          <Card style={styles.receiptCard}>
            <View style={styles.receiptIcon}>
              <Ionicons name="receipt-outline" size={16} color={colors.slate700} />
            </View>
            <View>
              <Text style={styles.receiptLabel}>Pickup receipt</Text>
              <Text style={styles.receiptCode}>{view.order.pickup.receiptCode}</Text>
            </View>
          </Card>
        ) : null}

        <View style={styles.steps}>
          {view.workflowSteps.map((label, i) => {
            const state = i < view.workflowStep ? 'done' : i === view.workflowStep ? 'current' : 'upcoming';
            return (
              <View
                key={label}
                style={[
                  styles.stepRow,
                  state === 'current' && styles.stepRowCurrent,
                  state === 'done' && styles.stepRowDone,
                ]}
              >
                <Ionicons
                  name={state === 'done' ? 'checkmark-circle' : state === 'current' ? 'ellipse' : 'ellipse-outline'}
                  size={16}
                  color={state === 'done' ? colors.accent : state === 'current' ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.stepText,
                    state === 'current' && styles.stepTextCurrent,
                    state === 'upcoming' && styles.stepTextUpcoming,
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {waitingForRider ? (
          <Card style={styles.waitingCard}>
            <View style={styles.waitingIcon}>
              <Ionicons name="car-outline" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.waitingTitle}>Waiting for rider</Text>
              <Text style={styles.waitingDesc}>
                The laundry is on its way to your shop. This unlocks once the rider drops it off —
                check back shortly or pull to refresh.
              </Text>
            </View>
          </Card>
        ) : null}

        {view.canReceive ? (
          <Card style={styles.actionCard}>
            <Text style={styles.actionTitle}>Receive laundry</Text>
            <Text style={styles.actionDesc}>Confirm bags arrived from the rider.</Text>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <Input
              value={note}
              onChangeText={setNote}
              placeholder="e.g. 2 bags, one slightly damp"
            />
            <Button
              label={busy ? 'Saving…' : 'Receive laundry'}
              onPress={() => run('receive', { note: note || undefined })}
              disabled={busy}
              style={styles.actionButton}
            />
          </Card>
        ) : null}

        {view.canVerifyWeight ? (
          <Card style={styles.actionCard}>
            <Text style={styles.actionTitle}>Verify weight</Text>
            <Text style={styles.actionDesc}>
              Enter the weight measured at your shop — this is the authoritative value used for
              billing.
            </Text>

            {est != null || riderWt != null ? (
              <View style={styles.varianceRow}>
                <View style={styles.varianceCol}>
                  <Text style={styles.varianceLabel}>Declared</Text>
                  <Text style={styles.varianceValue}>{est != null ? `${est} kg` : '—'}</Text>
                </View>
                <View style={styles.varianceCol}>
                  <Text style={styles.varianceLabel}>Rider weighed</Text>
                  <Text style={styles.varianceValue}>{riderWt != null ? `${riderWt} kg` : '—'}</Text>
                </View>
                <View style={styles.varianceCol}>
                  <Text style={styles.varianceLabel}>Variance</Text>
                  <Text
                    style={[
                      styles.varianceValue,
                      variance != null && variance > 0.5 && { color: colors.warning },
                    ]}
                  >
                    {variance != null ? `${variance.toFixed(2)} kg` : '—'}
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Shop-measured weight (kg)</Text>
            <Input
              value={weight}
              onChangeText={(v) => {
                setWeight(v);
                if (view.order.pricingMode === BranchPricingMode.PER_LOAD && v) {
                  setLoadCount(String(estimateMachineLoads(Number(v) || 0)));
                }
              }}
              keyboardType="decimal-pad"
              placeholder="e.g. 8.2"
            />

            {view.order.pricingMode === BranchPricingMode.PER_LOAD ? (
              <>
                <Text style={styles.fieldLabel}>Load count</Text>
                <Input
                  value={loadCount}
                  onChangeText={setLoadCount}
                  keyboardType="number-pad"
                />
              </>
            ) : null}

            {view.order.pricingMode === BranchPricingMode.PER_PIECE ? (
              <>
                <Text style={styles.fieldLabel}>Piece count</Text>
                <Input
                  value={pieceCount}
                  onChangeText={setPieceCount}
                  keyboardType="number-pad"
                />
              </>
            ) : null}

            <Button
              label={busy ? 'Saving…' : 'Verify weight'}
              onPress={() =>
                run('verify-weight', {
                  verifiedWeightKg: Number(weight),
                  ...(view.order.pricingMode === BranchPricingMode.PER_LOAD
                    ? { verifiedLoadCount: Number(loadCount) }
                    : {}),
                  ...(view.order.pricingMode === BranchPricingMode.PER_PIECE
                    ? { verifiedPieceCount: Number(pieceCount) }
                    : {}),
                  note: note || undefined,
                })
              }
              disabled={
                busy ||
                !weight ||
                (view.order.pricingMode === BranchPricingMode.PER_LOAD && !loadCount) ||
                (view.order.pricingMode === BranchPricingMode.PER_PIECE && !pieceCount)
              }
              style={styles.actionButton}
            />

            {view.order.finalTotal != null ? (
              <View style={styles.totalsRow}>
                <View style={styles.totalsCol}>
                  <Text style={styles.varianceLabel}>Estimated total</Text>
                  <Text style={styles.varianceValue}>{formatCurrency(view.order.total)}</Text>
                </View>
                <View style={styles.totalsCol}>
                  <Text style={styles.varianceLabel}>Finalized total</Text>
                  <Text style={[styles.varianceValue, { color: colors.accentDark }]}>
                    {formatCurrency(view.order.finalTotal)}
                  </Text>
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

        {view.canConfirmItems ? (
          <Card style={styles.actionCard}>
            <Text style={styles.actionTitle}>Confirm items</Text>
            <Text style={styles.actionDesc}>Count bags/pieces to complete shop intake.</Text>
            <Text style={styles.fieldLabel}>Item count</Text>
            <Input value={itemCount} onChangeText={setItemCount} keyboardType="number-pad" />
            <Text style={styles.actionHint}>Status becomes &quot;received at shop&quot; once confirmed.</Text>
            <Button
              label={busy ? 'Saving…' : 'Confirm items'}
              onPress={() => run('confirm-items', { itemCount: Number(itemCount), note: note || undefined })}
              disabled={busy}
              style={styles.actionButton}
            />
          </Card>
        ) : null}

        {view.isComplete ? (
          <Card style={styles.completeCard}>
            <View style={styles.completeIcon}>
              <Ionicons name="checkmark-circle" size={20} color={colors.accentDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.completeTitle}>Received at shop</Text>
              <Text style={styles.completeDesc}>
                {view.shopReceiving?.verifiedWeightKg != null
                  ? `Verified ${view.shopReceiving.verifiedWeightKg} kg`
                  : ''}
                {view.shopReceiving?.itemCount != null ? ` · ${view.shopReceiving.itemCount} item(s)` : ''}
              </Text>
              <Button
                label="Start laundry processing"
                onPress={() => router.replace(`/order/${id}`)}
                style={styles.actionButton}
              />
            </View>
          </Card>
        ) : null}
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  bookingType: { ...typography.heading, textTransform: 'capitalize' },
  status: { ...typography.bodySm, textTransform: 'capitalize', marginTop: 2, marginBottom: spacing.lg },
  receiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  receiptIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptLabel: { ...typography.caption, textTransform: 'uppercase' },
  receiptCode: { fontSize: 14, fontWeight: '700', color: colors.foreground, fontVariant: ['tabular-nums'] },
  steps: { gap: spacing.xs, marginBottom: spacing.lg },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  stepRowCurrent: { backgroundColor: colors.primaryLight },
  stepRowDone: { backgroundColor: colors.accentLight },
  stepText: { ...typography.bodySm, fontWeight: '500', color: colors.mutedForeground },
  stepTextCurrent: { color: colors.primaryDark, fontWeight: '700' },
  stepTextUpcoming: { color: colors.mutedForeground },
  waitingCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warningBorder,
    marginBottom: spacing.lg,
  },
  waitingIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  waitingDesc: { ...typography.bodySm, marginTop: spacing.xs },
  actionCard: { marginBottom: spacing.lg, gap: spacing.xs },
  actionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  actionDesc: { ...typography.bodySm, marginBottom: spacing.sm },
  actionHint: { ...typography.caption, marginTop: spacing.xs },
  fieldLabel: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.xs },
  actionButton: { marginTop: spacing.lg, alignSelf: 'flex-start' },
  varianceRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  varianceCol: { flex: 1, alignItems: 'center' },
  varianceLabel: { ...typography.caption },
  varianceValue: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginTop: 2 },
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  totalsCol: { flex: 1, alignItems: 'center' },
  completeCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  completeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: { fontSize: 15, fontWeight: '700', color: colors.accentDark },
  completeDesc: { ...typography.bodySm, marginTop: spacing.xs },
  error: {
    color: colors.destructive,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
});
