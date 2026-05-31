import { StyleSheet, Text, View } from 'react-native';
import { buildCustomerTimeline } from '@lunara/utils';
import { colors, spacing } from '../theme';

interface Props {
  status: string;
  statusHistory?: { status: string; timestamp: string; note?: string }[];
}

export function OrderTimeline({ status, statusHistory }: Props) {
  const { steps } = buildCustomerTimeline(status, statusHistory);

  return (
    <View style={styles.wrap}>
      {steps.map((step, i) => (
        <View key={`${step.id}-${i}`} style={styles.row}>
          <View
            style={[
              styles.dot,
              step.state === 'done' && styles.dotDone,
              step.state === 'current' && styles.dotCurrent,
            ]}
          />
          <View style={styles.content}>
            <Text
              style={[
                styles.label,
                step.state === 'current' && styles.labelCurrent,
                step.state === 'done' && styles.labelDone,
              ]}
            >
              {step.label}
            </Text>
            {step.timestamp ? (
              <Text style={styles.time}>
                {new Date(step.timestamp).toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  row: { flexDirection: 'row', marginBottom: spacing.lg - 2 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    marginTop: 5,
    marginRight: spacing.md,
  },
  dotDone: { backgroundColor: colors.accent },
  dotCurrent: {
    backgroundColor: colors.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  content: { flex: 1 },
  label: { fontSize: 14, color: colors.mutedForeground },
  labelDone: { color: colors.slate700 },
  labelCurrent: { color: colors.primaryDark, fontWeight: '600' },
  time: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
});
