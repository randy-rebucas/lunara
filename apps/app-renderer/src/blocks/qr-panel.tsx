import { View, Text, StyleSheet } from 'react-native';
import type { QrPanelProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function QrPanel({ mode, instructions, code }: QrPanelProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      <View style={[styles.qrBox, { backgroundColor: theme.foreground }]} />
      {code ? <Text style={[styles.code, { color: theme.foreground }]}>{code}</Text> : null}
      {instructions ? <Text style={[styles.instructions, { color: theme.muted }]}>{instructions}</Text> : null}
      <Text style={[styles.mode, { color: theme.muted }]}>{mode === 'scan' ? 'Scan a code' : 'Show this code'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16, gap: 6 },
  qrBox: { width: 120, height: 120, borderRadius: 8 },
  code: { fontSize: 13, fontWeight: '700' },
  instructions: { fontSize: 12, textAlign: 'center' },
  mode: { fontSize: 11 },
});
