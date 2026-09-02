import { View, Text, StyleSheet } from 'react-native';
import type { MapProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

/** Static address card — no native map view dependency. Swap for react-native-maps if/when
 *  an interactive map is needed. */
export function MapBlock({ title, address }: MapProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: theme.muted }]}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      <Text style={[styles.address, { color: theme.foreground }]}>{address}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  address: { fontSize: 13 },
});
