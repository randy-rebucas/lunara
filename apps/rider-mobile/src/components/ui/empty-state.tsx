import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
}

export function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      {icon ? (
        <View style={styles.iconBadge}>
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.subheading,
    fontSize: 15,
    textAlign: 'center',
  },
  message: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
