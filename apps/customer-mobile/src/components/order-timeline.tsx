import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { buildCustomerTimeline } from '@lunara/utils';
import { colors, radius, spacing } from '../theme';

interface Props {
  status: string;
  statusHistory?: { status: string; timestamp: string; note?: string }[];
}

export function OrderTimeline({ status, statusHistory }: Props) {
  const { steps } = buildCustomerTimeline(status, statusHistory);

  return (
    <View style={styles.wrap}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <View key={`${step.id}-${i}`} style={styles.row}>
            <View style={styles.dotCol}>
              <View
                style={[
                  styles.dot,
                  step.state === 'done' && styles.dotDone,
                  step.state === 'current' && styles.dotCurrent,
                ]}
              >
                {step.state === 'done' ? (
                  <Ionicons name="checkmark" size={11} color={colors.accentDark} />
                ) : step.state === 'current' ? (
                  <View style={styles.dotCurrentInner} />
                ) : null}
              </View>
              {!isLast ? (
                <View style={[styles.connector, step.state === 'done' && styles.connectorDone]} />
              ) : null}
            </View>
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
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  row: { flexDirection: 'row' },
  dotCol: { alignItems: 'center', marginRight: spacing.md },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  dotCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotCurrentInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.onPrimary },
  connector: { width: 2, flex: 1, minHeight: spacing.lg, backgroundColor: colors.border },
  connectorDone: { backgroundColor: colors.accent },
  content: { flex: 1, paddingBottom: spacing.lg - 2 },
  label: { fontSize: 14, color: colors.mutedForeground },
  labelDone: { color: colors.slate700 },
  labelCurrent: { color: colors.primaryDark, fontWeight: '600' },
  time: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
});
