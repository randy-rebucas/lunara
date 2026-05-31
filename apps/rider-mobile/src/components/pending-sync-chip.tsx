import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function PendingSyncChip() {
  return (
    <View style={styles.chip}>
      <Text style={styles.text}>Pending sync</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
