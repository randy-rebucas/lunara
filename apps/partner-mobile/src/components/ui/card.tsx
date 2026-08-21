import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';

interface CardProps extends ViewProps {
  elevated?: boolean;
  muted?: boolean;
  primary?: boolean;
  accent?: boolean;
}

export function Card({
  elevated,
  muted,
  primary,
  accent,
  style,
  children,
  ...props
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && shadow.elevated,
        !elevated && shadow.card,
        muted && styles.muted,
        primary && styles.primary,
        accent && styles.accent,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
  },
  primary: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
  },
  accent: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
});
