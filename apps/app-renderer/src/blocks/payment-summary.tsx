import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PaymentSummaryProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function PaymentSummary({ lineItems, total, status, methodLabel, ctaLabel }: PaymentSummaryProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      {lineItems.map((item, i) => (
        <View key={`${item.label}-${i}`} style={styles.row}>
          <Text style={[styles.label, { color: theme.muted }]}>{item.label}</Text>
          <Text style={[styles.amount, { color: theme.foreground }]}>{item.amount}</Text>
        </View>
      ))}
      <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
        <Text style={[styles.totalLabel, { color: theme.foreground }]}>Total</Text>
        <Text style={[styles.totalAmount, { color: theme.foreground }]}>{total}</Text>
      </View>
      {methodLabel ? <Text style={[styles.method, { color: theme.muted }]}>Via {methodLabel}</Text> : null}
      {status ? (
        <Text style={[styles.status, { color: status === 'paid' ? theme.primary : status === 'failed' ? theme.destructive : theme.muted }]}>
          {status.toUpperCase()}
        </Text>
      ) : null}
      {ctaLabel ? (
        <Pressable style={[styles.cta, { backgroundColor: theme.primary }]}>
          <Text style={[styles.ctaLabel, { color: theme.background }]}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: 13 },
  amount: { fontSize: 13, fontWeight: '500' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 8 },
  totalLabel: { fontSize: 15, fontWeight: '700' },
  totalAmount: { fontSize: 15, fontWeight: '700' },
  method: { fontSize: 12, marginTop: 6 },
  status: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  cta: { marginTop: 12, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  ctaLabel: { fontSize: 14, fontWeight: '700' },
});
