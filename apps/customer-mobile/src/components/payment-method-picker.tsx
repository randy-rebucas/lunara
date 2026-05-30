import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PaymentMethod } from '@lunara/types';
import { theme } from '@lunara/config';
import {
  CUSTOMER_PAYMENT_OPTIONS,
  formatCashTimingLabel,
  formatCurrency,
  type CashTiming,
} from '@lunara/utils';

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
        <Pressable
          key={opt.method}
          style={[styles.option, method === opt.method && styles.optionSelected]}
          onPress={() => onMethodChange(opt.method)}
        >
          <Text style={styles.optionTitle}>{opt.label}</Text>
          <Text style={styles.optionSub}>{opt.description}</Text>
        </Pressable>
      ))}

      <Text style={styles.groupLabel}>Cash</Text>
      <Pressable
        style={[styles.option, method === PaymentMethod.CASH && styles.optionSelected]}
        onPress={() => onMethodChange(PaymentMethod.CASH)}
      >
        <Text style={styles.optionTitle}>Cash</Text>
        <Text style={styles.optionSub}>Pay when we pick up or deliver your laundry</Text>
      </Pressable>
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
      <Pressable
        style={[styles.option, method === PaymentMethod.WALLET && styles.optionSelected]}
        onPress={() => onMethodChange(PaymentMethod.WALLET)}
      >
        <Text style={styles.optionTitle}>Lunara Wallet</Text>
        <Text style={styles.optionSub}>Balance: {formatCurrency(walletBalance)}</Text>
      </Pressable>
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
  container: { marginTop: 8 },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sub: { color: '#64748b', marginBottom: 12, fontSize: 13 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  optionSelected: { borderColor: theme.colors.primary, backgroundColor: '#eef2ff' },
  optionTitle: { fontWeight: '600', fontSize: 16 },
  optionSub: { marginTop: 4, fontSize: 13, color: '#64748b' },
  timingRow: { flexDirection: 'row', gap: 8, marginBottom: 10, paddingLeft: 4 },
  timingChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  timingChipActive: { backgroundColor: theme.colors.primary },
  timingChipText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  timingChipTextActive: { color: '#fff' },
  warning: { fontSize: 13, color: '#b45309', marginBottom: 8 },
  link: { color: theme.colors.primary, fontWeight: '600' },
});
