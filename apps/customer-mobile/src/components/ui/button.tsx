import { Pressable, StyleSheet, Text, type PressableProps, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: ViewStyle;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.lg,
        size === 'sm' && styles.sm,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      disabled={disabled}
      {...props}
    >
      <Text
        style={[
          styles.text,
          styles[`${variant}Text` as keyof typeof styles],
          size === 'lg' && styles.lgText,
          size === 'sm' && styles.smText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
  },
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  accent: { backgroundColor: colors.accent },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.88 },
  text: { fontWeight: '600', fontSize: 16 },
  lgText: { fontSize: 17 },
  smText: { fontSize: 14 },
  primaryText: { color: colors.onPrimary },
  secondaryText: { color: colors.onPrimary },
  accentText: { color: colors.onPrimary },
  outlineText: { color: colors.foreground },
  ghostText: { color: colors.primary },
});
