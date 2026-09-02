import { View, Text, StyleSheet } from 'react-native';
import type { TransactionListProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function TransactionList({ title, transactions }: TransactionListProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      {transactions.map((tx) => (
        <View key={tx.id} style={[styles.row, { borderColor: theme.border }]}>
          <View style={styles.content}>
            <Text style={[styles.label, { color: theme.foreground }]}>{tx.label}</Text>
            <Text style={[styles.timestamp, { color: theme.muted }]}>{tx.timestamp}</Text>
          </View>
          <Text style={[styles.amount, { color: tx.direction === 'credit' ? theme.primary : theme.destructive }]}>
            {tx.direction === 'credit' ? '+' : '-'}
            {tx.amount}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: { flex: 1 },
  label: { fontSize: 14, fontWeight: '500' },
  timestamp: { fontSize: 11, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '700' },
});
