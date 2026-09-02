import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ReceiptCardProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function ReceiptCard({ orderNumber, amount, timestamp, methodLabel, shareLabel }: ReceiptCardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      <Text style={[styles.check, { color: theme.primary }]}>✓</Text>
      <Text style={[styles.amount, { color: theme.foreground }]}>{amount}</Text>
      <Text style={[styles.orderNumber, { color: theme.muted }]}>{orderNumber}</Text>
      <Text style={[styles.timestamp, { color: theme.muted }]}>{timestamp}</Text>
      {methodLabel ? <Text style={[styles.method, { color: theme.muted }]}>Paid via {methodLabel}</Text> : null}
      {shareLabel ? (
        <Pressable style={[styles.share, { borderColor: theme.primary }]}>
          <Text style={[styles.shareLabel, { color: theme.primary }]}>{shareLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 20, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16, gap: 4 },
  check: { fontSize: 28, fontWeight: '700' },
  amount: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  orderNumber: { fontSize: 12 },
  timestamp: { fontSize: 11 },
  method: { fontSize: 11, marginTop: 4 },
  share: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  shareLabel: { fontSize: 12, fontWeight: '600' },
});
