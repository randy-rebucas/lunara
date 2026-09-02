import { View, Text, StyleSheet } from 'react-native';
import type { ListProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function ListBlock({ title, items }: ListProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      {items.map((item) => (
        <View key={item.id} style={[styles.row, { borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.foreground }]}>{item.label}</Text>
          {item.description ? (
            <Text style={[styles.description, { color: theme.muted }]}>{item.description}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 15, fontWeight: '500' },
  description: { fontSize: 13, marginTop: 2 },
});
