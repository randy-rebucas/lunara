import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export type TaskType = 'pickup' | 'delivery' | 'active';

interface TaskTypeBadgeProps {
  type: TaskType;
}

const config = {
  pickup: {
    label: 'Pickup',
    bg: colors.primaryLight,
    text: colors.primaryDark,
    border: colors.primaryBorder,
  },
  delivery: {
    label: 'Delivery',
    bg: colors.accentLight,
    text: colors.accentDark,
    border: colors.accent,
  },
  active: {
    label: 'In progress',
    bg: colors.secondaryLight,
    text: colors.slate800,
    border: colors.secondary,
  },
} as const;

export function TaskTypeBadge({ type }: TaskTypeBadgeProps) {
  const c = config[type];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
