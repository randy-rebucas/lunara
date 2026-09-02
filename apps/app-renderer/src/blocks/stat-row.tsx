import { View, Text, StyleSheet } from 'react-native';
import type { StatRowProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function StatRow({ title, stats }: StatRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      <View style={styles.row}>
        {stats.map((stat) => (
          <View key={stat.id} style={styles.stat}>
            <Text style={[styles.value, { color: theme.primary }]}>{stat.value}</Text>
            <Text style={[styles.label, { color: theme.muted }]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  value: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 11, marginTop: 2 },
});
