import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNotifications } from '../hooks/use-notifications';
import { NotificationListItem } from './notification-list-item';
import { Card } from './ui/card';
import { colors, spacing, typography } from '../theme';

interface NotificationsPreviewProps {
  limit?: number;
}

export function NotificationsPreview({ limit = 3 }: NotificationsPreviewProps) {
  const router = useRouter();
  const { items, loading, unreadCount, refresh, markRead } = useNotifications(limit);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const previewItems = items.slice(0, limit);
  if (!loading && previewItems.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </View>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>

      {loading && previewItems.length === 0 ? (
        <Card muted style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {previewItems.map((notification) => (
            <NotificationListItem
              key={notification._id}
              notification={notification}
              onMarkRead={markRead}
              compact
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const { unreadCount, refresh } = useNotifications(10);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={12}
      style={bellStyles.btn}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.primary} />
      {unreadCount > 0 ? (
        <View style={bellStyles.badge}>
          <Text style={bellStyles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.subheading, fontSize: 17 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    paddingHorizontal: spacing.xs + 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
  seeAll: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  list: { gap: spacing.sm },
  loadingCard: { padding: spacing.lg },
  loadingText: { ...typography.bodySm, textAlign: 'center' },
});

const bellStyles = StyleSheet.create({
  btn: {
    marginRight: spacing.md,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    paddingHorizontal: 4,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: { color: colors.onPrimary, fontSize: 9, fontWeight: '700' },
});
