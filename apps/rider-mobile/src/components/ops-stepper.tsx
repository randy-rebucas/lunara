import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

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
  wrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.accent },
  dotCurrent: { backgroundColor: colors.primary },
  dotText: { fontSize: 11, fontWeight: '700', color: colors.onPrimary },
  label: { fontSize: 13, color: colors.mutedForeground, flex: 1 },
  labelDone: { color: colors.slate700 },
  labelCurrent: { color: colors.primary, fontWeight: '600' },
});
