import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  image?: ImageSourcePropType;
  tip?: string;
}

export function EmptyState({ title, message, icon, image, tip }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      {image ? (
        <Image source={image} style={styles.illustration} resizeMode="contain" />
      ) : icon ? (
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={32} color={colors.primary} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {tip ? (
        <View style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={16} color={colors.primary} />
          <Text style={styles.tipText}>
            <Text style={styles.tipLabel}>Tip: </Text>
            {tip}
          </Text>
        </View>
      ) : null}
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
  illustration: {
    width: 160,
    height: 110,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
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
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  tipText: {
    ...typography.caption,
    color: colors.primaryDark,
    flexShrink: 1,
    lineHeight: 18,
  },
  tipLabel: { fontWeight: '700' },
});
