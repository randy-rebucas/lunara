import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { PaymentMethod } from '@lunara/types';
import { formatCurrency } from '@lunara/utils';
import { useAuthStore } from '../store/auth';
import { PaymentMethodPicker } from './payment-method-picker';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { DataLoadState } from './data-load-state';
import { colors, spacing, typography } from '../theme';
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
        <Text style={styles.summaryTitle}>Order summary</Text>
        <Text style={styles.summaryMeta}>{order.bookingType.replace(/_/g, ' ')}</Text>
        <Text style={styles.total}>{formatCurrency(order.total)}</Text>
        <Text style={styles.statusHint}>Status: {order.status.replace(/_/g, ' ')}</Text>
        {existingPayment?.receiptCode && existingPayment.status === 'pending' ? (
          <Text style={styles.pendingRef}>Pending · ref {existingPayment.receiptCode}</Text>
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

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
  summary: { gap: spacing.xs },
  summaryTitle: { ...typography.subheading },
  summaryMeta: { ...typography.bodySm, textTransform: 'capitalize' },
  total: { fontSize: 28, fontWeight: '700', color: colors.primary, marginTop: spacing.sm },
  statusHint: { ...typography.caption, textTransform: 'capitalize' },
  pendingRef: { fontSize: 12, color: colors.warning, marginTop: spacing.xs },
  error: { color: colors.destructive, fontSize: 14 },
  payBtn: { marginTop: spacing.sm },
});
