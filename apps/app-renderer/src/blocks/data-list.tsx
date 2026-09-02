import { View, Text, StyleSheet } from 'react-native';
import type { DataListProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function DataList({ title, emptyStateText, items, layout = 'card' }: DataListProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>{emptyStateText ?? 'Nothing here yet'}</Text>
      ) : (
        items.map((item) => (
          <View
            key={item.id}
            style={[
              styles.item,
              layout === 'card'
                ? { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 }
                : { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <View style={styles.itemContent}>
              <Text style={[styles.itemTitle, { color: theme.foreground }]}>{item.title}</Text>
              {item.subtitle ? (
                <Text style={[styles.itemSubtitle, { color: theme.muted }]}>{item.subtitle}</Text>
              ) : null}
            </View>
            {item.badge ? (
              <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                <Text style={[styles.badgeText, { color: theme.background }]}>{item.badge}</Text>
              </View>
            ) : null}
            {item.timestamp ? <Text style={[styles.timestamp, { color: theme.muted }]}>{item.timestamp}</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 8, gap: 8 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600' },
  itemSubtitle: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  timestamp: { fontSize: 11 },
});
