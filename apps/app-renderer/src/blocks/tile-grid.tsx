import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { TileGridProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function TileGrid({ title, columns = 4, tiles }: TileGridProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.id}
            style={[
              styles.tile,
              { width: `${100 / columns - 2}%`, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.label, { color: theme.foreground }]} numberOfLines={2}>
              {tile.label}
            </Text>
            {tile.value ? <Text style={[styles.value, { color: theme.primary }]}>{tile.value}</Text> : null}
            {tile.badge ? <Text style={[styles.badge, { color: theme.muted }]}>{tile.badge}</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  value: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  badge: { fontSize: 9, marginTop: 2 },
});
