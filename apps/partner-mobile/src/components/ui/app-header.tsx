import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/auth';
import { colors, radius, spacing, typography } from '../../theme';
import { Avatar } from './avatar';
import { BrandMark } from './brand-mark';

interface AppHeaderProps {
  hasUnreadNotifications?: boolean;
}

export function AppHeader({ hasUnreadNotifications = false }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const name = user?.email ? user.email.split('@')[0] : 'Staff';
  const role = user?.role ?? 'Shop Staff';

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.brandRow}>
        <BrandMark size="sm" />
        <View style={styles.wordmarkBlock}>
          <Text style={styles.wordmark}>LUNARA</Text>
          <Text style={styles.wordmarkSub}>PARTNER · SHOP OPS</Text>
        </View>
      </View>

      <View style={styles.actions}>
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

        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityRole="button"
          accessibilityLabel={`Account menu, ${name}, ${role}`}
          style={styles.userTrigger}
        >
          <Avatar name={name} size={36} />
          <View style={styles.userTextBlock}>
            <Text style={styles.userName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.userRole} numberOfLines={1}>
              {role}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  userTrigger: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  userTextBlock: { maxWidth: 72 },
  userName: { ...typography.bodySm, fontWeight: '700' },
  userRole: { ...typography.caption, fontSize: 10 },
});
