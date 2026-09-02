import { View, Text, StyleSheet } from 'react-native';
import type { MapPickerProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function MapPicker({ mode, centerLabel, markerLabel }: MapPickerProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.muted, borderColor: theme.border }]}>
      <View style={styles.pin}>
        <Text style={[styles.pinLabel, { color: theme.primary }]}>📍 {markerLabel ?? 'Location'}</Text>
      </View>
      {centerLabel ? <Text style={[styles.center, { color: theme.foreground }]}>{centerLabel}</Text> : null}
      <Text style={[styles.mode, { color: theme.muted }]}>{mode === 'live' ? 'Live tracking' : mode === 'pick' ? 'Tap to set location' : 'Static map'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 160, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16, alignItems: 'center', justifyContent: 'center', gap: 4 },
  pin: { paddingHorizontal: 10, paddingVertical: 6 },
  pinLabel: { fontSize: 14, fontWeight: '700' },
  center: { fontSize: 12, fontWeight: '500' },
  mode: { fontSize: 11 },
});
