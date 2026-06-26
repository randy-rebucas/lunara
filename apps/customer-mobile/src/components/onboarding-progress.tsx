import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

const steps = [
  { key: 'profile', label: 'Profile' },
  { key: 'address', label: 'Address' },
  { key: 'done', label: 'Done' },
] as const;

export type OnboardingStep = (typeof steps)[number]['key'];

interface OnboardingProgressProps {
  current: OnboardingStep;
}

export function OnboardingProgress({ current }: OnboardingProgressProps) {
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <View style={styles.row}>
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <View key={step.key} style={styles.stepWrap}>
            <View style={styles.stepInner}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  active && styles.dotActive,
                ]}
              >
                <Text style={[styles.dotText, (done || active) && styles.dotTextActive]}>
                  {done ? '✓' : index + 1}
                </Text>
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>{step.label}</Text>
            </View>
            {index < steps.length - 1 ? (
              <View style={[styles.connector, done && styles.connectorDone]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  stepInner: { alignItems: 'center', gap: spacing.xs },
  dot: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.accent },
  dotActive: { backgroundColor: colors.primary },
  dotText: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground },
  dotTextActive: { color: colors.onPrimary },
  label: { ...typography.caption, fontSize: 10 },
  labelActive: { fontWeight: '700', color: colors.foreground },
  connector: {
    width: spacing.lg,
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.lg,
  },
  connectorDone: { backgroundColor: colors.accent + '66' },
});
