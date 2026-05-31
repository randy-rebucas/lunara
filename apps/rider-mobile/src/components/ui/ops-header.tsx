import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from './brand-mark';
import { colors, radius, spacing, typography } from '../../theme';

interface OpsHeaderProps {
  name: string;
  unreadCount: number;
  onAlertsPress: () => void;
  onLogoutPress?: () => void;
  showLogout?: boolean;
}

export function OpsHeader({
  name,
  unreadCount,
  onAlertsPress,
  onLogoutPress,
  showLogout = true,
}: OpsHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <BrandMark size="sm" />
        <View style={styles.brandText}>
          <Text style={styles.appName}>Lunara Rider</Text>
          <Text style={styles.portal}>Field operations</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.notifBtn} onPress={onAlertsPress} hitSlop={8}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
          {unreadCount > 0 && (
            <View style={styles.badgeDot}>
              <Text style={styles.badgeDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={onLogoutPress} hitSlop={8} disabled={!showLogout || !onLogoutPress}>
          {showLogout && onLogoutPress ? <Text style={styles.logout}>Sign out</Text> : null}
        </Pressable>
      </View>

      <Text style={styles.greeting}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  brandText: { flex: 1 },
  appName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  portal: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  actions: {
    position: 'absolute',
    top: 0,
    right: 0,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  notifBtn: {
    padding: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.destructive,
    borderRadius: radius.sm,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDotText: { color: colors.onPrimary, fontSize: 10, fontWeight: '700' },
  logout: { ...typography.bodySm, color: colors.muted },
  greeting: {
    ...typography.heading,
    fontSize: 24,
    marginTop: spacing.xl,
    letterSpacing: -0.3,
  },
});
