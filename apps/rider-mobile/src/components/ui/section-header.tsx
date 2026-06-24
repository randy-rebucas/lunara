import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../../theme';

interface SectionHeaderProps {
  title: string;
  hint?: string;
}

export function SectionHeader({ title, hint }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.subheading,
    fontSize: 16,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
