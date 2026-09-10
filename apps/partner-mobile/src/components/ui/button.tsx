import { Pressable, StyleSheet, Text, View, type PressableProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
type ButtonSize = 'md' | 'lg';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IoniconName;
  style?: ViewStyle;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const iconColor = iconColors[variant];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.lg,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      {...props}
    >
      <View style={styles.content}>
        <Text
          style={[
            styles.text,
            styles[`${variant}Text` as keyof typeof styles],
            size === 'lg' && styles.lgText,
          ]}
        >
          {label}
        </Text>
        {icon ? <Ionicons name={icon} size={size === 'lg' ? 18 : 16} color={iconColor} /> : null}
      </View>
    </Pressable>
  );
}

const iconColors: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  secondary: colors.onPrimary,
  accent: colors.onPrimary,
  outline: colors.foreground,
  ghost: colors.primary,
};

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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  primaryText: { color: colors.onPrimary },
  secondaryText: { color: colors.onPrimary },
  accentText: { color: colors.onPrimary },
  outlineText: { color: colors.foreground },
  ghostText: { color: colors.primary },
});
