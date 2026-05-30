import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@lunara/config';

export function OpsStepper({ steps, currentIndex }: { steps: string[]; currentIndex: number }) {
  return (
    <View style={styles.wrap}>
      {steps.map((label, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <View key={label} style={styles.row}>
            <View
              style={[
                styles.dot,
                done && styles.dotDone,
                current && styles.dotCurrent,
              ]}
            >
              <Text style={styles.dotText}>{done ? '✓' : i + 1}</Text>
            </View>
            <Text
              style={[
                styles.label,
                done && styles.labelDone,
                current && styles.labelCurrent,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: theme.colors.accent },
  dotCurrent: { backgroundColor: theme.colors.primary },
  dotText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  label: { fontSize: 13, color: '#94a3b8', flex: 1 },
  labelDone: { color: '#334155' },
  labelCurrent: { color: theme.colors.primary, fontWeight: '600' },
});
