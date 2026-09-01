import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DataLoadState } from '../src/components/data-load-state';
import { NotificationListItem } from '../src/components/notification-list-item';
import { Screen } from '../src/components/ui/screen';
import { useNotifications } from '../src/hooks/use-notifications';
import { useRiderOperations } from '../src/context/rider-operations';
import {
  RIDER_NOTIFICATION_CATEGORY,
  resolveNotificationCategory,
  type RiderNotificationCategory,
} from '../src/lib/notification-types';
import { colors, radius, spacing, typography } from '../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type FilterKey = 'all' | RiderNotificationCategory;

const FILTERS: { key: FilterKey; label: string; icon: IoniconName }[] = [
  { key: 'all', label: 'All', icon: 'apps-outline' },
  { key: RIDER_NOTIFICATION_CATEGORY.ASSIGNMENT, label: 'Assignment', icon: 'bicycle-outline' },
  { key: RIDER_NOTIFICATION_CATEGORY.REMINDER, label: 'Reminder', icon: 'alarm-outline' },
  { key: RIDER_NOTIFICATION_CATEGORY.EARNINGS, label: 'Earnings', icon: 'wallet-outline' },
  { key: RIDER_NOTIFICATION_CATEGORY.SYSTEM, label: 'System', icon: 'settings-outline' },
];

const Separator = () => <View style={styles.separator} />;

export default function NotificationsScreen() {
  const { setUnreadCount, notificationsVersion } = useRiderOperations();
  const { items, loading, refreshing, error, refresh, markRead, load, unreadCount } =
    useNotifications(50);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    setUnreadCount(unreadCount);
  }, [unreadCount, setUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // A dispatch-pushed notification (new assignment, rider alert) arrived while this screen was
  // already open — refetch so the list isn't stale until the rider backgrounds/refocuses the tab.
  useEffect(() => {
    if (notificationsVersion === 0) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationsVersion]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => resolveNotificationCategory(item) === filter);
  }, [filter, items]);

  const renderNotification = useCallback(
    ({ item }: { item: Parameters<typeof NotificationListItem>[0]['notification'] }) => (
      <NotificationListItem notification={item} onMarkRead={markRead} />
    ),
    [markRead],
  );

  if (loading && items.length === 0) {
    return (
      <Screen inStack>
        <DataLoadState loading error="" loadingMessage="Loading notifications…" />
      </Screen>
    );
  }

  if (error && items.length === 0) {
    return (
      <Screen inStack>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen inStack padded={false}>
      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.pageSubtitle}>Assignments, reminders, earnings and system alerts.</Text>
      </View>

      {/* ── Filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Ionicons
                name={f.icon}
                size={13}
                color={active ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      <FlatList
        style={styles.list}
        data={filteredItems}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        renderItem={renderNotification}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-outline" size={28} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
            </Text>
            <Text style={styles.emptyBody}>
              Assignment updates, overdue reminders, earnings, and platform announcements appear here.
            </Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  pageSubtitle: { ...typography.bodySm, marginTop: spacing.xs },

  filterScroll: { flexGrow: 0 },
  filterRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 32,
    paddingHorizontal: spacing.md + 2,
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginRight: spacing.sm,
  },
  chipActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  chipTextActive: { color: colors.primary },

  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  separator: { height: spacing.sm },

  emptyWrap: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  emptyBody: { ...typography.bodySm, textAlign: 'center' },
});
