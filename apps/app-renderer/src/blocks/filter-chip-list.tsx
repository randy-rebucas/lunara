import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { FilterChipListProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function FilterChipList({ options, selectedId }: FilterChipListProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option.id === selectedId;
        return (
          <Pressable
            key={option.id}
            style={[
              styles.chip,
              { borderColor: theme.border },
              active && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
          >
            <Text style={[styles.label, { color: active ? theme.background : theme.foreground }]}>
              {option.label}
              {option.count != null ? ` (${option.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '600' },
});
