import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

/** Pill color kinds — mirrors admin-web/partner-web's badge-warning/accent/danger/primary/neutral classes. */
export type PillKind = 'warning' | 'accent' | 'danger' | 'primary' | 'neutral';

interface StatusPillProps {
  label: string;
  kind?: PillKind;
}

const KIND_STYLES: Record<PillKind, { bg: string; fg: string }> = {
  warning: { bg: colors.warningBg, fg: colors.warning },
  accent: { bg: colors.accentLight, fg: colors.accentDark },
  danger: { bg: colors.dangerLight, fg: colors.destructive },
  primary: { bg: colors.primaryLight, fg: colors.primaryDark },
  neutral: { bg: colors.surfaceMuted, fg: colors.slate700 },
};

export function StatusPill({ label, kind = 'neutral' }: StatusPillProps) {
  const { bg, fg } = KIND_STYLES[kind];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
