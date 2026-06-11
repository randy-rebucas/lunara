import { StyleSheet, Text, View } from 'react-native';
import type { RiderCashPaymentInfo } from '@lunara/utils';
import { formatCurrency } from '@lunara/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { colors, spacing, typography } from '../theme';

interface CashPaymentCardProps {
  cashPayment: RiderCashPaymentInfo;
  loading?: boolean;
  onCollect?: () => void;
}

export function CashPaymentCard({ cashPayment, loading, onCollect }: CashPaymentCardProps) {
  const timingLabel = cashPayment.collectAt === 'pickup' ? 'on pickup' : 'on delivery';

  return (
    <Card elevated style={styles.card}>
      <Text style={styles.title}>Cash payment</Text>
      {cashPayment.collected ? (
        <View style={styles.paidRow}>
          <Text style={styles.paidText}>Collected · {formatCurrency(cashPayment.amount)}</Text>
          {cashPayment.receiptCode ? (
            <Text style={styles.ref}>Ref {cashPayment.receiptCode}</Text>
          ) : null}
        </View>
      ) : (
        <>
          <Text style={styles.amount}>{formatCurrency(cashPayment.amount)}</Text>
          <Text style={styles.hint}>Customer pays cash {timingLabel}</Text>
          {cashPayment.receiptCode ? (
            <Text style={styles.ref}>Ref {cashPayment.receiptCode}</Text>
          ) : null}
          {cashPayment.canCollect && onCollect ? (
            <Button
              label="Cash collected"
              variant="accent"
              disabled={loading}
              onPress={onCollect}
              style={styles.action}
            />
          ) : !cashPayment.canCollect && cashPayment.collectAt === cashPayment.timing ? (
            <Text style={styles.waitHint}>Collect after customer verification</Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg },
  title: { ...typography.subheading, fontSize: 16 },
  amount: {
    marginTop: spacing.sm,
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
  },
  hint: { marginTop: spacing.xs, ...typography.bodySm, color: colors.mutedForeground },
  ref: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.accentDark,
  },
  waitHint: {
    marginTop: spacing.md,
    ...typography.caption,
    color: colors.warning,
  },
  paidRow: { marginTop: spacing.sm },
  paidText: { fontSize: 16, fontWeight: '600', color: colors.accentDark },
  action: { marginTop: spacing.md },
});
