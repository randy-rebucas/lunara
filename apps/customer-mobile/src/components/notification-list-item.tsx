import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatNotificationTime,
  notificationIconName,
  notificationRouteToPath,
  resolveNotificationRoute,
  type AppNotification,
} from '../lib/notification-types';
import { colors, radius, spacing, typography } from '../theme';

interface NotificationListItemProps {
  notification: AppNotification;
  onMarkRead?: (id: string) => void | Promise<void>;
  compact?: boolean;
}

function routeToPath(route: NonNullable<ReturnType<typeof resolveNotificationRoute>>): string {
  return notificationRouteToPath(route);
}

export function NotificationListItem({
  notification,
  onMarkRead,
  compact = false,
}: NotificationListItemProps) {
  const router = useRouter();
  const icon = notificationIconName(notification.data?.type, Boolean(notification.data?.orderId));
  const route = resolveNotificationRoute(notification);

  async function handlePress() {
    if (!notification.read) {
      await onMarkRead?.(notification._id);
    }
    if (route) {
      router.push(routeToPath(route) as Href);
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        !notification.read && styles.unread,
        compact && styles.compact,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, !notification.read && styles.iconWrapUnread]}>
        <Ionicons
          name={icon}
          size={compact ? 18 : 20}
          color={notification.read ? colors.mutedForeground : colors.primary}
        />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, !notification.read && styles.titleUnread]} numberOfLines={1}>
            {notification.title}
          </Text>
          {!notification.read ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.body} numberOfLines={compact ? 2 : 4}>
          {notification.body}
        </Text>
        <Text style={styles.time}>{formatNotificationTime(notification.createdAt)}</Text>
        {route ? (
          <Text style={styles.action}>
            {route.kind === 'review'
              ? 'Leave a review →'
              : route.kind === 'refund'
                ? 'View refund →'
                : route.kind === 'wallet'
                  ? 'View wallet →'
                  : 'View order →'}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  compact: {
    padding: spacing.md,
  },
  unread: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  pressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: colors.surface,
  },
  copy: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  titleUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  body: {
    ...typography.bodySm,
    marginTop: spacing.xs,
  },
  time: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
