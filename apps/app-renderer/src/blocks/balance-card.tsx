import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { BalanceCardProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function BalanceCard({ label, amount, currency = '₱', subLabel, ctaLabel, tier }: BalanceCardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <Text style={[styles.label, { color: theme.background }]}>{label}</Text>
      <Text style={[styles.amount, { color: theme.background }]}>
        {currency}
        {amount}
      </Text>
      {subLabel ? <Text style={[styles.subLabel, { color: theme.background }]}>{subLabel}</Text> : null}
      {tier ? <Text style={[styles.tier, { color: theme.background }]}>{tier}</Text> : null}
      {ctaLabel ? (
        <Pressable style={[styles.cta, { backgroundColor: theme.background }]}>
          <Text style={[styles.ctaLabel, { color: theme.primary }]}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, borderRadius: 14, marginBottom: 16 },
  label: { fontSize: 13, opacity: 0.85 },
  amount: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  subLabel: { fontSize: 12, marginTop: 4, opacity: 0.85 },
  tier: { fontSize: 11, marginTop: 4, opacity: 0.9, fontWeight: '600' },
  cta: { marginTop: 14, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  ctaLabel: { fontSize: 13, fontWeight: '700' },
});
