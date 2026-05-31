import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '../../theme';

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
});
