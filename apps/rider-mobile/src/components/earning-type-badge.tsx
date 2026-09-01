import { StyleSheet, Text, View } from 'react-native';
import type { RiderEarningType } from '@lunara/utils';
import { colors, radius, spacing } from '../theme';

const EARNING_LABELS: Record<RiderEarningType, string> = {
  pickup: 'Pickup Fee',
  delivery: 'Delivery Fee',
  bonus: 'Bonus',
  adjustment: 'Adjustment',
  wage: 'Wage Payment',
};

const stylesByType: Record<
  RiderEarningType,
  { bg: string; text: string; border: string }
> = {
  pickup: {
    bg: colors.primaryLight,
    text: colors.primaryDark,
    border: colors.primaryBorder,
  },
  delivery: {
    bg: colors.accentLight,
    text: colors.accentDark,
    border: colors.accent,
  },
  bonus: {
    bg: colors.warningBg,
    text: colors.warning,
    border: colors.warningBorder,
  },
  adjustment: {
    bg: colors.secondaryLight,
    text: colors.slate800,
    border: colors.secondary,
  },
  wage: {
    bg: colors.primaryLight,
    text: colors.primary,
    border: colors.primaryBorder,
  },
};

interface EarningTypeBadgeProps {
  type: RiderEarningType;
}

export function EarningTypeBadge({ type }: EarningTypeBadgeProps) {
  const style = stylesByType[type];
  return (
    <View style={[styles.badge, { backgroundColor: style.bg, borderColor: style.border }]}>
      <Text style={[styles.text, { color: style.text }]}>
        {EARNING_LABELS[type]}
      </Text>
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
  },
});
