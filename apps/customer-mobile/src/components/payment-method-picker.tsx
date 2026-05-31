import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PaymentMethod } from '@lunara/types';
import {
  CUSTOMER_PAYMENT_OPTIONS,
  formatCashTimingLabel,
  formatCurrency,
  type CashTiming,
} from '@lunara/utils';
import { SelectableOption } from './ui/selectable-option';
import { colors, radius, spacing, typography } from '../theme';

interface PaymentMethodPickerProps {
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  cashTiming: CashTiming;
  onCashTimingChange: (timing: CashTiming) => void;
  walletBalance: number;
  orderTotal: number;
  onTopUpWallet?: () => void;
}

export function PaymentMethodPicker({
  method,
  onMethodChange,
  cashTiming,
  onCashTimingChange,
  walletBalance,
  orderTotal,
  onTopUpWallet,
}: PaymentMethodPickerProps) {
  const paymongoOptions = CUSTOMER_PAYMENT_OPTIONS.filter((o) => o.channel === 'paymongo');
  const insufficientWallet = method === PaymentMethod.WALLET && walletBalance < orderTotal;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Choose payment method</Text>
      <Text style={styles.sub}>PayMongo, cash, or Lunara wallet</Text>

      <Text style={styles.groupLabel}>PayMongo</Text>
      {paymongoOptions.map((opt) => (
        <SelectableOption
          key={opt.method}
          title={opt.label}
          subtitle={opt.description}
          selected={method === opt.method}
          onPress={() => onMethodChange(opt.method)}
        />
      ))}

      <Text style={styles.groupLabel}>Cash</Text>
      <SelectableOption
        title="Cash"
        subtitle="Pay when we pick up or deliver your laundry"
        selected={method === PaymentMethod.CASH}
        onPress={() => onMethodChange(PaymentMethod.CASH)}
      />
      {method === PaymentMethod.CASH && (
        <View style={styles.timingRow}>
          {(['pickup', 'delivery'] as CashTiming[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.timingChip, cashTiming === t && styles.timingChipActive]}
              onPress={() => onCashTimingChange(t)}
            >
              <Text
                style={[styles.timingChipText, cashTiming === t && styles.timingChipTextActive]}
              >
                {formatCashTimingLabel(t)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.groupLabel}>Wallet</Text>
      <SelectableOption
        title="Lunara Wallet"
        subtitle={`Balance: ${formatCurrency(walletBalance)}`}
        selected={method === PaymentMethod.WALLET}
        onPress={() => onMethodChange(PaymentMethod.WALLET)}
      />
      {insufficientWallet && (
        <Text style={styles.warning}>
          Insufficient balance.{' '}
          {onTopUpWallet ? (
            <Text style={styles.link} onPress={onTopUpWallet}>
              Top up wallet
            </Text>
          ) : (
            'Top up your wallet first.'
          )}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.sm },
  heading: { ...typography.subheading, marginBottom: spacing.xs },
  sub: { ...typography.bodySm, marginBottom: spacing.md },
  groupLabel: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.sm },
  timingRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md - 2, paddingLeft: spacing.xs },
  timingChip: {
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  timingChipActive: { backgroundColor: colors.primary },
  timingChipText: { fontSize: 13, fontWeight: '500', color: colors.muted },
  timingChipTextActive: { color: colors.onPrimary },
  warning: { fontSize: 13, color: colors.warning, marginBottom: spacing.sm },
  link: { color: colors.primary, fontWeight: '600' },
});
