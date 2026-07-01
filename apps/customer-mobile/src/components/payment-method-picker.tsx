import { Ionicons } from '@expo/vector-icons';
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
      <View style={styles.headingRow}>
        <Ionicons name="card-outline" size={18} color={colors.primary} />
        <Text style={styles.heading}>Choose payment method</Text>
      </View>
      <Text style={styles.sub}>PayMongo, cash, or Lunara wallet</Text>

      <View style={styles.groupLabelRow}>
        <Ionicons name="globe-outline" size={13} color={colors.muted} />
        <Text style={styles.groupLabel}>PayMongo</Text>
      </View>
      {paymongoOptions.map((opt) => (
        <SelectableOption
          key={opt.method}
          title={opt.label}
          subtitle={opt.description}
          selected={method === opt.method}
          onPress={() => onMethodChange(opt.method)}
        />
      ))}

      <View style={styles.groupLabelRow}>
        <Ionicons name="cash-outline" size={13} color={colors.muted} />
        <Text style={styles.groupLabel}>Cash</Text>
      </View>
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
              accessibilityRole="radio"
              accessibilityState={{ checked: cashTiming === t }}
            >
              <Ionicons
                name={t === 'pickup' ? 'cube-outline' : 'bicycle-outline'}
                size={13}
                color={cashTiming === t ? colors.onPrimary : colors.muted}
              />
              <Text style={[styles.timingChipText, cashTiming === t && styles.timingChipTextActive]}>
                {formatCashTimingLabel(t)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.groupLabelRow}>
        <Ionicons name="wallet-outline" size={13} color={colors.muted} />
        <Text style={styles.groupLabel}>Wallet</Text>
      </View>
      <SelectableOption
        title="Lunara Wallet"
        subtitle={`Balance: ${formatCurrency(walletBalance)}`}
        selected={method === PaymentMethod.WALLET}
        onPress={() => onMethodChange(PaymentMethod.WALLET)}
      />
      {insufficientWallet && (
        <View style={styles.warningRow}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
          <Text style={styles.warning}>
            Insufficient balance.{' '}
            {onTopUpWallet ? (
              <Text style={styles.link} onPress={onTopUpWallet}>Top up wallet</Text>
            ) : (
              'Top up your wallet first.'
            )}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.sm },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  heading: { ...typography.subheading },
  sub: { ...typography.bodySm, marginBottom: spacing.md },
  groupLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, marginBottom: spacing.sm },
  groupLabel: { ...typography.label, color: colors.muted },
  timingRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs, paddingLeft: spacing.xs },
  timingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  timingChipActive: { backgroundColor: colors.primary },
  timingChipText: { fontSize: 13, fontWeight: '500', color: colors.muted },
  timingChipTextActive: { color: colors.onPrimary, fontWeight: '600' },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.xs },
  warning: { fontSize: 13, color: colors.warning, flex: 1 },
  link: { color: colors.primary, fontWeight: '600' },
});
