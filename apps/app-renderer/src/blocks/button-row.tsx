import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ButtonRowProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function ButtonRow({ buttons }: ButtonRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {buttons.map((button) => (
        <Pressable key={button.id} style={[styles.button, { backgroundColor: theme.primary }]}>
          <Text style={[styles.label, { color: theme.background }]}>{button.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  button: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  label: { fontWeight: '600' },
});
