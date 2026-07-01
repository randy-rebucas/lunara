import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaymentStatus } from '@lunara/types';
import { formatCurrency } from '@lunara/utils';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { DataLoadState } from '../../../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../../src/store/auth';
import { colors, radius, spacing, typography } from '../../../src/theme';

interface PaymentReceipt {
  _id: string;
  status: string;
  method: string;
  amount: number;
  receiptCode?: string;
}

function methodLabel(method: string) {
  if (method === 'cash') return 'Cash';
  if (method === 'wallet') return 'Lunara Wallet';
  if (method === 'gcash') return 'GCash';
  if (method === 'card') return 'Card';
  return method.replace(/_/g, ' ');
}

function methodIcon(method: string): keyof typeof Ionicons.glyphMap {
  if (method === 'cash') return 'cash-outline';
  if (method === 'wallet') return 'wallet-outline';
  if (method === 'gcash') return 'phone-portrait-outline';
  return 'card-outline';
}

export default function CheckoutSuccessScreen() {
  const router = useRouter();
  const { orderId, paymentId } = useLocalSearchParams<{ orderId: string; paymentId?: string }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [payment, setPayment] = useState<PaymentReceipt | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!paymentId) {
      setError('Payment not found');
      setLoading(false);
      return;
    }
    setError('');
    try {
      const data = await apiFetch<{ payment: PaymentReceipt; order: { total: number } | null }>(
        `/payments/${paymentId}`,
      );
      setPayment(data.payment);
      setOrderTotal(data.order?.total ?? data.payment.amount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load receipt');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, paymentId]);

  useEffect(() => {
    load();
  }, [load]);

  const isPaid = payment?.status === PaymentStatus.PAID;
  const isCashPending = payment?.method === 'cash' && payment?.status === PaymentStatus.PENDING;

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
    >
      <DataLoadState
        loading={loading}
        error={error && !payment ? error : ''}
        loadingMessage="Loading receipt…"
        onRetry={load}
      />

      {!loading && payment ? (
        <>
          {/* Hero icon */}
          <View style={styles.heroWrap}>
            <View style={styles.heroOuter}>
              <View style={[styles.heroInner, isPaid ? styles.heroInnerPaid : styles.heroInnerPending]}>
                <Ionicons
                  name={isPaid ? 'checkmark' : 'time-outline'}
                  size={36}
                  color={colors.onPrimary}
                />
              </View>
            </View>
            {/* sparkle dots */}
            <View style={[styles.sparkle, { top: 8, right: 12 }]} />
            <View style={[styles.sparkle, styles.sparkleSm, { top: 20, left: 16 }]} />
            <View style={[styles.sparkle, styles.sparkleSm, { bottom: 10, right: 6 }]} />
          </View>

          <Text style={styles.title}>
            {isPaid ? 'Payment successful!' : isCashPending ? 'Booking confirmed!' : 'Payment'}
          </Text>
          <Text style={styles.sub}>
            {isPaid
              ? 'Your payment was processed and your receipt is ready.'
              : isCashPending
                ? 'Pay cash on pickup or delivery. Your receipt reference is below.'
                : 'Review your payment details below.'}
          </Text>

          {/* Receipt card */}
          <Card style={styles.receipt}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="receipt-outline" size={16} color={colors.primary} />
              <Text style={styles.receiptTitle}>Payment receipt</Text>
            </View>

            {/* Method pill */}
            <View style={styles.methodPill}>
              <Ionicons name={methodIcon(payment.method)} size={13} color={colors.primary} />
              <Text style={styles.methodText}>{methodLabel(payment.method)}</Text>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Amount paid</Text>
              <Text style={styles.amountValue}>{formatCurrency(orderTotal)}</Text>
            </View>

            {payment.receiptCode ? (
              <View style={styles.refRow}>
                <View style={styles.refBlock}>
                  <Text style={styles.refLabel}>Reference</Text>
                  <Text style={styles.refCode}>{payment.receiptCode}</Text>
                </View>
                <View style={[styles.statusPill, isPaid ? styles.statusPaid : styles.statusPending]}>
                  <Text style={[styles.statusText, { color: isPaid ? colors.accentDark : colors.primary }]}>
                    {isPaid ? 'Paid' : 'Pending'}
                  </Text>
                </View>
              </View>
            ) : null}
          </Card>

          {isCashPending ? (
            <Card style={styles.cashNote}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.cashNoteTitle}>Cash payment reminder</Text>
              </View>
              <Text style={styles.cashNoteBody}>
                Please have the exact amount ready when our rider arrives for pickup or delivery.
              </Text>
            </Card>
          ) : null}

          <View style={styles.actions}>
            <Button
              label="Track order"
              onPress={() => router.replace(`/orders/${orderId}?booked=1`)}
              style={styles.actionBtn}
            />
            <Button
              label="My orders"
              variant="outline"
              onPress={() => router.replace('/(tabs)/orders')}
              style={styles.actionBtn}
            />
          </View>
        </>
      ) : null}
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },

  /* Hero */
  heroWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  heroOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInnerPaid: { backgroundColor: colors.accent },
  heroInnerPending: { backgroundColor: colors.primary },
  sparkle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary + '40',
  },
  sparkleSm: { width: 6, height: 6, borderRadius: 3 },

  /* Text */
  title: { ...typography.title, fontSize: 24, textAlign: 'center', marginBottom: spacing.xs },
  sub: { ...typography.bodySm, textAlign: 'center', color: colors.slate700, marginBottom: spacing.xl },

  /* Receipt card */
  receipt: { width: '100%', gap: spacing.md, marginBottom: spacing.lg },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  receiptTitle: { fontWeight: '600', fontSize: 15, color: colors.foreground },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  methodText: { fontSize: 12, fontWeight: '600', color: colors.primary, textTransform: 'capitalize' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  amountLabel: { ...typography.bodySm, color: colors.muted },
  amountValue: { fontSize: 26, fontWeight: '800', color: colors.primary },
  refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refBlock: { gap: 2 },
  refLabel: { ...typography.caption, color: colors.muted },
  refCode: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', color: colors.foreground },
  statusPill: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  statusPaid: { backgroundColor: colors.accent + '20' },
  statusPending: { backgroundColor: colors.primaryLight },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  /* Cash note */
  cashNote: { width: '100%', gap: spacing.sm, marginBottom: spacing.lg, backgroundColor: colors.primaryLight },
  cashNoteTitle: { fontWeight: '600', color: colors.primary },
  cashNoteBody: { ...typography.bodySm, color: colors.slate700 },

  /* Actions */
  actions: { width: '100%', gap: spacing.sm },
  actionBtn: { width: '100%' },
});
