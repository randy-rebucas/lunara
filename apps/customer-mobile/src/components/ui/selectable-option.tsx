import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme';

interface SelectableOptionProps {
  title: string;
  subtitle?: string;
  detail?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export function SelectableOption({
  title,
  subtitle,
  detail,
  selected,
  disabled,
  onPress,
  style,
  children,
}: SelectableOptionProps) {
  return (
    <Pressable
      style={[
        styles.option,
        selected && styles.selected,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg - 2,
    marginBottom: spacing.md - 2,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  disabled: { opacity: 0.4 },
  title: { fontWeight: '600', fontSize: 16, color: colors.foreground },
  subtitle: { marginTop: spacing.xs, fontSize: 13, color: colors.muted, lineHeight: 18 },
  detail: { marginTop: spacing.sm - 2, fontSize: 13, color: colors.primary, fontWeight: '500' },
});
