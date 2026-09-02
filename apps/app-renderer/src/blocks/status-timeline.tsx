import { View, Text, StyleSheet } from 'react-native';
import type { StatusTimelineProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function StatusTimeline({ title, currentStatus, steps }: StatusTimelineProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      {steps.map((step, i) => {
        const isCurrent = step.status === currentStatus;
        const isDone = steps.findIndex((s) => s.status === currentStatus) > i;
        return (
          <View key={step.status} style={styles.row}>
            <View
              style={[
                styles.dot,
                { borderColor: theme.border },
                (isCurrent || isDone) && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
            />
            <View style={styles.content}>
              <Text style={[styles.label, { color: theme.foreground }]}>{step.label}</Text>
              {step.description ? (
                <Text style={[styles.description, { color: theme.muted }]}>{step.description}</Text>
              ) : null}
              {step.timestamp ? (
                <Text style={[styles.timestamp, { color: theme.muted }]}>{step.timestamp}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, paddingBottom: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 3 },
  content: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600' },
  description: { fontSize: 12, marginTop: 2 },
  timestamp: { fontSize: 11, marginTop: 2 },
});
