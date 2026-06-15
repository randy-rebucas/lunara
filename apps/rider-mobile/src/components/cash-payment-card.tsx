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
  const hasNetting =
    cashPayment.collected &&
    cashPayment.earningOffset != null &&
    cashPayment.netRemittance != null;

  return (
    <Card elevated style={styles.card}>
      <Text style={styles.title}>Cash payment</Text>
      {cashPayment.collected ? (
        <View style={styles.paidRow}>
          <Text style={styles.paidText}>Collected · {formatCurrency(cashPayment.amount)}</Text>
          {cashPayment.receiptCode ? (
            <Text style={styles.ref}>Ref {cashPayment.receiptCode}</Text>
          ) : null}
          {hasNetting ? (
            <View style={styles.nettingBox}>
              <View style={styles.nettingRow}>
                <Text style={styles.nettingLabel}>Cash collected</Text>
                <Text style={styles.nettingValue}>{formatCurrency(cashPayment.amount)}</Text>
              </View>
              <View style={styles.nettingRow}>
                <Text style={styles.nettingLabel}>Your fee (offset)</Text>
                <Text style={styles.nettingOffset}>− {formatCurrency(cashPayment.earningOffset!)}</Text>
              </View>
              <View style={[styles.nettingRow, styles.nettingTotal]}>
                <Text style={styles.nettingTotalLabel}>Remit to admin</Text>
                <Text style={styles.nettingTotalValue}>{formatCurrency(cashPayment.netRemittance!)}</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <Text style={styles.amount}>{formatCurrency(cashPayment.amount)}</Text>
          <Text style={styles.hint}>Customer pays cash {timingLabel}</Text>
          <Text style={styles.hint}>Your earned fee will be offset — hand over the net amount to admin.</Text>
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
  nettingBox: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border ?? '#e2e8f0',
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  nettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nettingLabel: { ...typography.bodySm, color: colors.mutedForeground },
  nettingValue: { ...typography.bodySm, color: colors.foreground },
  nettingOffset: { ...typography.bodySm, color: colors.warning ?? '#d97706' },
  nettingTotal: { marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border ?? '#e2e8f0' },
  nettingTotalLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  nettingTotalValue: { fontSize: 14, fontWeight: '700', color: colors.accent ?? '#0ea5e9' },
});
