import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useOwnBranch } from '../hooks/use-own-branch';
import { colors, radius, spacing, typography } from '../theme';

export function BranchBanner() {
  const { branch, loading } = useOwnBranch();

  if (loading || !branch) return null;

  return (
    <View style={styles.wrap}>
      <Ionicons name="storefront-outline" size={16} color={colors.primary} />
      <Text style={styles.text} numberOfLines={1}>
        {branch.name} · {branch.city}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  text: { ...typography.bodySm, color: colors.primaryDark, fontWeight: '600', flexShrink: 1 },
});
