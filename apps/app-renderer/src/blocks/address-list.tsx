import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { AddressListProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function AddressList({ title, addresses, allowAdd, addLabel }: AddressListProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      {addresses.map((address) => (
        <View key={address.id} style={[styles.card, { borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.label, { color: theme.foreground }]}>{address.label}</Text>
            {address.isDefault ? (
              <Text style={[styles.defaultBadge, { color: theme.primary }]}>Default</Text>
            ) : null}
          </View>
          <Text style={[styles.line, { color: theme.muted }]}>{address.line1}</Text>
          {address.line2 ? <Text style={[styles.line, { color: theme.muted }]}>{address.line2}</Text> : null}
        </View>
      ))}
      {allowAdd ? (
        <Pressable style={[styles.addRow, { borderColor: theme.primary }]}>
          <Text style={[styles.addLabel, { color: theme.primary }]}>{addLabel ?? 'Add address'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginBottom: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '700' },
  defaultBadge: { fontSize: 11, fontWeight: '600' },
  line: { fontSize: 12, marginTop: 2 },
  addRow: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 12, alignItems: 'center' },
  addLabel: { fontSize: 13, fontWeight: '600' },
});
