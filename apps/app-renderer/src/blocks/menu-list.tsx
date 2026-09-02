import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { MenuListProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function MenuList({ title, items }: MenuListProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      {items.map((item) => (
        <Pressable key={item.id} style={[styles.row, { borderColor: theme.border }]}>
          <Text style={[styles.label, { color: item.danger ? theme.destructive : theme.foreground }]}>
            {item.label}
          </Text>
          {item.value ? <Text style={[styles.value, { color: theme.muted }]}>{item.value}</Text> : null}
        </Pressable>
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 14, fontWeight: '500' },
  value: { fontSize: 13 },
});
