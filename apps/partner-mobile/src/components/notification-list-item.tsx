import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from './ui/card';
import {
  formatNotificationTime,
  notificationCategoryIcon,
  resolveNotificationCategory,
  resolveStaffNotificationRoute,
  STAFF_NOTIFICATION_CATEGORY_LABELS,
  type StaffNotification,
} from '../lib/notification-types';
import { colors, radius, spacing, typography } from '../theme';

interface NotificationListItemProps {
  notification: StaffNotification;
  onMarkRead?: (id: string) => void | Promise<void>;
}

export function NotificationListItem({ notification, onMarkRead }: NotificationListItemProps) {
  const router = useRouter();
  const route = resolveStaffNotificationRoute(notification);
  const category = resolveNotificationCategory(notification);
  const icon = notificationCategoryIcon(category);

  async function handlePress() {
    if (!notification.read) {
      await onMarkRead?.(notification._id);
    }
    if (route) {
      router.push(route as Href);
    }
  }

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card primary={!notification.read} style={styles.card}>
        <View style={[styles.iconWrap, !notification.read && styles.iconWrapUnread]}>
          <Ionicons
            name={icon}
            size={20}
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
          <Text style={styles.category}>{STAFF_NOTIFICATION_CATEGORY_LABELS[category]}</Text>
          <Text style={styles.body} numberOfLines={4}>
            {notification.body}
          </Text>
          <Text style={styles.time}>{formatNotificationTime(notification.createdAt)}</Text>
          {route ? <Text style={styles.action}>Open →</Text> : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md },
  pressed: { opacity: 0.92 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: { backgroundColor: colors.surface },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.foreground },
  titleUnread: { fontWeight: '700' },
  category: { ...typography.caption, marginTop: spacing.xs, textTransform: 'uppercase' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  body: { ...typography.bodySm, marginTop: spacing.xs },
  time: { ...typography.caption, marginTop: spacing.sm },
  action: { marginTop: spacing.sm, fontSize: 13, fontWeight: '600', color: colors.primary },
});
