import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../theme';
import { BrandMark } from './brand-mark';

interface AppHeaderProps {
  hasUnreadNotifications?: boolean;
}

export function AppHeader({ hasUnreadNotifications = false }: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.brandRow}>
        <BrandMark size="sm" />
        <View style={styles.wordmarkBlock}>
          <Text style={styles.wordmark}>LUNARA</Text>
          <Text style={styles.wordmarkSub}>PARTNER · SHOP OPS</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          hasUnreadNotifications ? 'Notifications, unread' : 'Notifications'
        }
        style={styles.bellButton}
      >
        <Ionicons name="notifications-outline" size={20} color={colors.primary} />
        {hasUnreadNotifications ? <View style={styles.badge} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  wordmarkBlock: { flexShrink: 1 },
  wordmark: { ...typography.subheading, fontSize: 16, color: colors.primary, letterSpacing: 0.5 },
  wordmarkSub: { ...typography.label, fontSize: 10 },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.destructive,
  },
});
