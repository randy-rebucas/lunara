import { View, Text, StyleSheet } from 'react-native';
import type { StepperProgressProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function StepperProgress({ steps, currentStep }: StepperProgressProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {steps.map((step, i) => (
          <View key={step} style={styles.stepWrap}>
            <View
              style={[
                styles.dot,
                { borderColor: theme.border },
                i <= currentStep && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
            >
              <Text style={[styles.dotLabel, { color: i <= currentStep ? theme.background : theme.muted }]}>
                {i + 1}
              </Text>
            </View>
            {i < steps.length - 1 ? (
              <View style={[styles.connector, { backgroundColor: i < currentStep ? theme.primary : theme.border }]} />
            ) : null}
          </View>
        ))}
      </View>
      <Text style={[styles.label, { color: theme.foreground }]}>{steps[currentStep]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  stepWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotLabel: { fontSize: 11, fontWeight: '700' },
  connector: { flex: 1, height: 2, marginHorizontal: 4 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' },
});
