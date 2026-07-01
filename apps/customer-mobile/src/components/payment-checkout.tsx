import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { PaymentMethod } from '@lunara/types';
import { formatCurrency } from '@lunara/utils';
import { useAuthStore } from '../store/auth';
import { PaymentMethodPicker } from './payment-method-picker';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { DataLoadState } from './data-load-state';
import { colors, radius, spacing, typography } from '../theme';
import type { CashTiming } from '@lunara/utils';
import { getCustomerClientOrigin } from '../lib/client-origin';

interface CheckoutOrder {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
}

interface CheckoutPayment {
  _id: string;
  status: string;
  method: string;
  amount: number;
  receiptCode?: string;
}

interface PaymentCheckoutProps {
  orderId: string;
  onPaid?: (paymentId: string) => void;
}

export function PaymentCheckout({ orderId, onPaid }: PaymentCheckoutProps) {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [existingPayment, setExistingPayment] = useState<CheckoutPayment | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.GCASH);
  const [cashTiming, setCashTiming] = useState<CashTiming>('pickup');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [checkout, wallet] = await Promise.all([
        apiFetch<{ order: CheckoutOrder; payment: CheckoutPayment | null }>(
          `/payments/orders/${orderId}`,
        ),
        apiFetch<{ balance: number }>('/wallets/me'),
      ]);
      let payment = checkout.payment;
      if (payment?.status === 'pending' && payment._id) {
        try {
          const synced = await apiFetch<{ status: string }>(`/payments/${payment._id}/sync`, {
            method: 'POST',
          });
          payment = { ...payment, status: synced.status };
        } catch {
          // still pending
        }
      }
      setOrder(checkout.order);
      setExistingPayment(payment);
      setWalletBalance(wallet.balance ?? 0);
      if (payment?.status === 'paid' && payment._id) {
        onPaid?.(payment._id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load checkout');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, orderId, onPaid]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePay() {
    setPaying(true);
    setError('');
    try {
      const payment = await apiFetch<{
        paid?: boolean;
        checkoutUrl?: string;
        payment?: { _id: string };
        receiptCode?: string;
        message?: string;
      }>('/payments/intent', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          method,
          clientOrigin: getCustomerClientOrigin(),
          ...(method === PaymentMethod.CASH ? { cashTiming } : {}),
        }),
      });

      if (payment.paid && payment.payment?._id) {
        onPaid?.(payment.payment._id);
        return;
      }

      if (method === PaymentMethod.CASH && payment.payment?._id) {
        onPaid?.(payment.payment._id);
        return;
      }

      if (payment.checkoutUrl) {
        await Linking.openURL(payment.checkoutUrl);
        Alert.alert(
          'Complete payment',
          'Finish payment in your browser, then return here and pull to refresh.',
        );
        return;
      }

      setError('Payment could not be started');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  const insufficientWallet = method === PaymentMethod.WALLET && order && walletBalance < order.total;

  if (loading || error || !order) {
    return (
      <DataLoadState
        loading={loading}
        error={error}
        loadingMessage="Loading checkout…"
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.summary}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="cart-outline" size={16} color={colors.primary} />
          <Text style={styles.summaryTitle}>Order summary</Text>
        </View>
        <Text style={styles.summaryMeta}>{order.bookingType.replace(/_/g, ' ')}</Text>
        <Text style={styles.total}>{formatCurrency(order.total)}</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Ionicons name="ellipse" size={6} color={colors.primary} />
            <Text style={styles.statusHint}>{order.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        {existingPayment?.receiptCode && existingPayment.status === 'pending' ? (
          <View style={styles.pendingRow}>
            <Ionicons name="time-outline" size={13} color={colors.warning} />
            <Text style={styles.pendingRef}>Pending · ref {existingPayment.receiptCode}</Text>
          </View>
        ) : null}
      </Card>

      <PaymentMethodPicker
        method={method}
        onMethodChange={setMethod}
        cashTiming={cashTiming}
        onCashTimingChange={setCashTiming}
        walletBalance={walletBalance}
        orderTotal={order.total}
      />

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <Button
        label={
          paying
            ? 'Processing…'
            : method === PaymentMethod.CASH
              ? 'Confirm & get receipt'
              : method === PaymentMethod.WALLET
                ? 'Pay with wallet'
                : 'Continue to PayMongo'
        }
        onPress={handlePay}
        disabled={paying || insufficientWallet}
        style={styles.payBtn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  summary: { gap: spacing.sm },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryTitle: { ...typography.subheading },
  summaryMeta: { ...typography.bodySm, textTransform: 'capitalize', color: colors.slate700 },
  total: { fontSize: 28, fontWeight: '800', color: colors.primary },
  statusRow: { flexDirection: 'row' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusHint: { fontSize: 11, fontWeight: '600', color: colors.primary, textTransform: 'capitalize' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pendingRef: { fontSize: 12, color: colors.warning },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  error: { color: colors.destructive, fontSize: 14, flex: 1 },
  payBtn: { marginTop: spacing.sm },
});
