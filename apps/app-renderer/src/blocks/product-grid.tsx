import { View, Text, Image, StyleSheet } from 'react-native';
import type { ProductGridProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function ProductGrid({ title, columns, items }: ProductGridProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      <View style={styles.grid}>
        {items.map((item) => (
          <View
            key={item.id}
            style={[
              styles.card,
              { width: `${100 / columns - 2}%`, borderColor: theme.border, backgroundColor: theme.background },
            ]}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.image} />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: theme.muted }]} />
            )}
            <Text style={[styles.name, { color: theme.foreground }]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.price ? <Text style={[styles.price, { color: theme.primary }]}>{item.price}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 8 },
  image: { width: '100%', aspectRatio: 1, borderRadius: 6, marginBottom: 6 },
  imagePlaceholder: { width: '100%', aspectRatio: 1, borderRadius: 6, marginBottom: 6 },
  name: { fontSize: 13, fontWeight: '500' },
  price: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
