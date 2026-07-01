import { Ionicons } from '@expo/vector-icons';
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
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                {done ? (
                  <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.dotText, active && styles.dotTextActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.label, active && styles.labelActive, done && styles.labelDone]}>
                {step.label}
              </Text>
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
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  stepInner: { alignItems: 'center', gap: 4, width: 56 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotText: { fontSize: 13, fontWeight: '700', color: colors.mutedForeground },
  dotTextActive: { color: colors.onPrimary },
  label: { ...typography.caption, fontSize: 10, color: colors.muted, textAlign: 'center' },
  labelActive: { fontWeight: '700', color: colors.foreground },
  labelDone: { color: colors.accent, fontWeight: '600' },
  connector: {
    width: 32,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
    marginHorizontal: 2,
  },
  connectorDone: { backgroundColor: colors.accent },
});
