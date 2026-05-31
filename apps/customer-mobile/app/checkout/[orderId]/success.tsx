import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaymentStatus } from '@lunara/types';
import { formatCurrency } from '@lunara/utils';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { DataLoadState } from '../../../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../../src/store/auth';
import { colors, spacing, typography } from '../../../src/theme';

interface PaymentReceipt {
  _id: string;
  status: string;
  method: string;
  amount: number;
  receiptCode?: string;
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
  const isCashPending =
    payment?.method === 'cash' && payment?.status === PaymentStatus.PENDING;

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
          <View style={[styles.icon, isPaid ? styles.iconPaid : styles.iconPending]}>
            <Text style={styles.iconText}>{isPaid ? '✓' : '₱'}</Text>
          </View>
          <Text style={styles.title}>
            {isPaid ? 'Payment successful' : isCashPending ? 'Booking confirmed' : 'Payment'}
          </Text>
          <Text style={styles.sub}>
            {isPaid
              ? 'Your payment was processed and your receipt is ready.'
              : isCashPending
                ? 'Pay cash on pickup or delivery. Your receipt reference is below.'
                : 'Review your payment details below.'}
          </Text>

          <Card style={styles.receipt}>
            <Text style={styles.receiptLabel}>Amount</Text>
            <Text style={styles.receiptAmount}>{formatCurrency(orderTotal)}</Text>
            {payment.receiptCode ? (
              <>
                <Text style={styles.receiptLabel}>Reference</Text>
                <Text style={styles.receiptRef}>{payment.receiptCode}</Text>
              </>
            ) : null}
          </Card>

          <Button
            label="Track order"
            onPress={() => router.replace(`/orders/${orderId}?booked=1`)}
            style={styles.btn}
          />
          <Button
            label="My orders"
            variant="outline"
            onPress={() => router.replace('/(tabs)/orders')}
          />
        </>
      ) : null}
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, alignItems: 'center' },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconPaid: { backgroundColor: colors.accent },
  iconPending: { backgroundColor: colors.primary },
  iconText: { fontSize: 28, color: colors.onPrimary, fontWeight: '700' },
  title: { ...typography.title, textAlign: 'center' },
  sub: { ...typography.bodySm, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
  receipt: { width: '100%', gap: spacing.xs, marginBottom: spacing.xl },
  receiptLabel: { ...typography.caption, fontWeight: '600' },
  receiptAmount: { fontSize: 24, fontWeight: '700', color: colors.primary },
  receiptRef: { fontFamily: 'monospace', fontSize: 14, fontWeight: '600' },
  btn: { width: '100%', marginBottom: spacing.sm },
});
