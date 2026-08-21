import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PartnerOrderSummary, PartnerProcessingView } from '@lunara/types';
import { formatCurrency } from '@lunara/utils';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { Screen } from '../../../src/components/ui/screen';
import { StatusPill } from '../../../src/components/ui/status-pill';
import { partnerFetch } from '../../../src/api';
import { useAuthStore } from '../../../src/store/auth';
import { colors, radius, spacing, typography } from '../../../src/theme';

/**
 * Mirrors the stage actions in apps/partner-web/src/app/orders/board/page.tsx:
 * accept -> receive & verify -> process -> request delivery.
 *
 * `canAccept` / `canRequestDelivery` are computed by the API from fields like `partnerAcceptedAt`
 * / `dispatchStatus` / `deliveryRiderId` / the partner's `allowStaffToRequestDelivery` setting —
 * none of which `/partner/orders/:id/processing` returns. The orders list already computes them
 * (`PartnerOrderSummary`) and passes them in as route params for the *initial* render, but a
 * route param is frozen at navigation time: advancing an order to completion inside this screen
 * (e.g. the final "Mark ready for delivery" tap) flips `canRequestDelivery` server-side without
 * ever refreshing the param, so the Request delivery button could stay permanently hidden for the
 * rest of this screen's visit. `refreshFlags` re-fetches the authoritative values from the same
 * list endpoint after every load so they stay in sync with what actually changed.
 */
export default function OrderDetailScreen() {
  const router = useRouter();
  const { id, canAccept: canAcceptParam, canRequestDelivery: canRequestDeliveryParam } =
    useLocalSearchParams<{ id: string; canAccept?: string; canRequestDelivery?: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const [view, setView] = useState<PartnerProcessingView | null>(null);
  const [liveFlags, setLiveFlags] = useState<{ canAccept?: boolean; canRequestDelivery?: boolean } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);

  const refreshFlags = useCallback(async () => {
    try {
      const data = await partnerFetch<{ items: PartnerOrderSummary[] }>('/partner/orders/incoming');
      const match = data.items.find((o) => o._id === id);
      if (match) {
        setLiveFlags({ canAccept: match.canAccept, canRequestDelivery: match.canRequestDelivery });
      }
    } catch {
      // Best-effort refresh — fall back to the route params captured at navigation time.
    }
  }, [id]);

  const load = useCallback(async () => {
    const data = await partnerFetch<PartnerProcessingView>(`/partner/orders/${id}/processing`);
    setView(data);
    void refreshFlags();
  }, [id, refreshFlags]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [load]);

  async function runAction(path: string) {
    setBusy(true);
    setError('');
    try {
      await partnerFetch(path, { method: 'POST' });
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

  const { order, preProcessing, isJobAccepted, currentStep, nextStep, assignedStaffId } = view;
  // Prefer the freshly re-fetched flags (`liveFlags`); the route params are only a same-render
  // fallback for before the first `refreshFlags` resolves. Undefined in both means "unknown", so
  // we don't offer an action that might no longer be valid.
  const canAccept = preProcessing && (liveFlags?.canAccept ?? canAcceptParam === 'true');
  const canAcceptJob = !preProcessing && !isJobAccepted;
  const jobIsMine = !assignedStaffId || assignedStaffId === userId;
  const canAdvance = !preProcessing && isJobAccepted && !view.isComplete && jobIsMine;
  const canRequestDelivery =
    !preProcessing && view.isComplete && (liveFlags?.canRequestDelivery ?? canRequestDeliveryParam === 'true');
  const showReceiving = preProcessing && !canAccept;
  const showAssignedToOther = !preProcessing && isJobAccepted && !view.isComplete && !jobIsMine;

  return (
    <Screen inStack scroll contentStyle={styles.content}>
      <>
        <Card style={styles.statusCard} primary>
          <Text style={styles.statusEyebrow}>CURRENT STATUS</Text>
          <StatusPill label={currentStep.label} kind={view.isComplete ? 'accent' : 'primary'} />
          {!preProcessing && !view.isComplete ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${view.progress}%` }]} />
            </View>
          ) : null}
          {currentStep.description ? (
            <Text style={styles.stepDesc}>{currentStep.description}</Text>
          ) : null}
          {nextStep ? <Text style={styles.nextStep}>Next: {nextStep.label}</Text> : null}
          {!preProcessing && !nextStep && !view.isComplete ? (
            <Text style={styles.nextStep}>
              Tap &quot;Mark ready for delivery&quot; below to confirm and notify delivery dispatch.
            </Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.bookingType}>{order.bookingType.replace(/_/g, ' ')}</Text>
          <Text style={styles.total}>{formatCurrency(order.total)}</Text>
        </Card>

        {order.customerName || order.customerPhone ? (
          <Card style={styles.customerCard}>
            <View style={styles.customerIcon}>
              <Ionicons name="person-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName} numberOfLines={1}>
                {order.customerName || 'Customer'}
              </Text>
              {order.customerPhone ? (
                <Text style={styles.customerPhone}>{order.customerPhone}</Text>
              ) : null}
            </View>
          </Card>
        ) : null}

        {order.items?.length || order.subtotal !== undefined ? (
          <Card style={styles.breakdownCard}>
            <Pressable
              onPress={() => setBreakdownExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: breakdownExpanded }}
              style={styles.breakdownHeader}
            >
              <Text style={styles.breakdownLabel}>ORDER BREAKDOWN</Text>
              <View style={styles.breakdownHeaderRight}>
                <Text style={styles.breakdownHeaderTotal}>{formatCurrency(order.total)}</Text>
                <Ionicons
                  name={breakdownExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.mutedForeground}
                />
              </View>
            </Pressable>

            {breakdownExpanded ? (
              <>
                {order.items?.map((item, i) => (
                  <View key={i} style={styles.breakdownRow}>
                    <Text style={styles.breakdownItemLabel} numberOfLines={1}>
                      {item.notes?.startsWith('Add-on:')
                        ? item.notes.replace(/^Add-on:\s*/, '')
                        : item.serviceType.replace(/_/g, ' ')}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                    </Text>
                    <Text style={styles.breakdownValue}>
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </Text>
                  </View>
                ))}

                {order.subtotal !== undefined ? (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownItemLabel}>Subtotal</Text>
                    <Text style={styles.breakdownValue}>{formatCurrency(order.subtotal)}</Text>
                  </View>
                ) : null}

                {order.deliveryFee ? (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownItemLabel}>Delivery fee</Text>
                    <Text style={styles.breakdownValue}>{formatCurrency(order.deliveryFee)}</Text>
                  </View>
                ) : null}

                {order.discount ? (
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownItemLabel, styles.discountText]}>
                      Discount{order.couponCode ? ` (${order.couponCode})` : ''}
                    </Text>
                    <Text style={[styles.breakdownValue, styles.discountText]}>
                      -{formatCurrency(order.discount)}
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
                  <Text style={styles.breakdownTotalLabel}>Total</Text>
                  <Text style={styles.breakdownTotalLabel}>{formatCurrency(order.total)}</Text>
                </View>

                {order.scheduledPickupAt || order.scheduledDeliveryAt || order.estimatedWeightKg != null ? (
                  <View style={styles.breakdownMeta}>
                    {order.scheduledPickupAt ? (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownItemLabel}>Scheduled pickup</Text>
                        <Text style={styles.breakdownMetaValue}>
                          {new Date(order.scheduledPickupAt).toLocaleString('en-PH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Text>
                      </View>
                    ) : null}
                    {order.scheduledDeliveryAt ? (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownItemLabel}>Scheduled delivery</Text>
                        <Text style={styles.breakdownMetaValue}>
                          {new Date(order.scheduledDeliveryAt).toLocaleString('en-PH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Text>
                      </View>
                    ) : null}
                    {order.estimatedWeightKg != null ? (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownItemLabel}>Estimated weight</Text>
                        <Text style={styles.breakdownMetaValue}>{order.estimatedWeightKg} kg</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
          </Card>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          {canAccept ? (
            <Button
              label="Accept order"
              onPress={() => runAction(`/partner/orders/${id}/accept`)}
              disabled={busy}
            />
          ) : null}
          {showReceiving ? (
            <Pressable
              onPress={() => router.push(`/order/${id}/receiving`)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.receivingCard, pressed && styles.cardPressed]}
            >
              <View style={styles.receivingIcon}>
                <Ionicons name="cube-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.receivingTitle}>Continue receiving</Text>
                <Text style={styles.receivingDesc}>
                  Confirm intake, verify weight, and count items.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
          {canAcceptJob ? (
            <Button
              label="Accept job"
              variant="accent"
              onPress={() => runAction(`/partner/orders/${id}/processing/accept`)}
              disabled={busy}
            />
          ) : null}
          {canAdvance ? (
            <Button
              label={
                nextStep
                  ? `Complete: ${currentStep.label} → ${nextStep.label}`
                  : 'Mark ready for delivery'
              }
              onPress={() => runAction(`/partner/orders/${id}/processing/advance`)}
              disabled={busy}
            />
          ) : null}
          {canRequestDelivery ? (
            <Button
              label="Request delivery"
              variant="outline"
              onPress={() => runAction(`/partner/orders/${id}/request-delivery`)}
              disabled={busy}
            />
          ) : null}
          {showAssignedToOther ? (
            <Text style={styles.hint}>
              This job is assigned to another staff member and can only be advanced by them.
            </Text>
          ) : null}
        </View>
      </>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  card: { gap: spacing.xs, marginBottom: spacing.lg },
  bookingType: { ...typography.heading, textTransform: 'capitalize' },
  total: { fontSize: 18, fontWeight: '700', color: colors.primary },
  statusCard: { gap: spacing.sm, marginBottom: spacing.lg },
  statusEyebrow: { ...typography.label, color: colors.primaryDark },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primaryBorder,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  stepDesc: { ...typography.bodySm, marginTop: spacing.xs },
  nextStep: { ...typography.caption, marginTop: spacing.sm },
  actions: { gap: spacing.md },
  hint: { ...typography.bodySm, textAlign: 'center' },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  customerIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerName: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  customerPhone: { ...typography.bodySm, marginTop: 2 },
  breakdownCard: { marginBottom: spacing.lg, gap: spacing.xs },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakdownHeaderTotal: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  breakdownLabel: { ...typography.label },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
    gap: spacing.md,
  },
  breakdownItemLabel: {
    ...typography.bodySm,
    textTransform: 'capitalize',
    flexShrink: 1,
    color: colors.slate700,
  },
  breakdownValue: { ...typography.bodySm, color: colors.slate700 },
  discountText: { color: colors.accentDark },
  breakdownTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  breakdownTotalLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  breakdownMeta: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  breakdownMetaValue: { ...typography.bodySm, color: colors.foreground, fontWeight: '600' },
  receivingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  cardPressed: { opacity: 0.8 },
  receivingIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receivingTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  receivingDesc: { ...typography.bodySm, marginTop: 2 },
  error: {
    color: colors.destructive,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
});
