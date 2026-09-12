import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { EmptyState } from '../src/components/ui/empty-state';
import { NotificationListItem } from '../src/components/notification-list-item';
import { Screen } from '../src/components/ui/screen';
import { useNotifications } from '../src/hooks/use-notifications';
import type { StaffNotification } from '../src/lib/notification-types';
import { colors, radius, spacing, typography } from '../src/theme';

const Separator = () => <View style={styles.separator} />;

export default function NotificationsScreen() {
  const { items, loading, refreshing, error, refresh, markRead, markAllRead, unreadCount } =
    useNotifications(50);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const renderNotification = useCallback(
    ({ item }: { item: StaffNotification }) => (
      <NotificationListItem notification={item} onMarkRead={markRead} />
    ),
    [markRead],
  );

  if (loading && items.length === 0) {
    return (
      <Screen inStack centered>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (error && items.length === 0) {
    return (
      <Screen inStack>
        <EmptyState icon="alert-circle-outline" title="Couldn't load notifications" message={error} />
      </Screen>
    );
  }

  return (
    <Screen inStack padded={false}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <Pressable onPress={() => void markAllRead()} hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        renderItem={renderNotification}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="No notifications yet"
            message="New orders, staff assignments, and shop alerts appear here."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.heading, fontSize: 22 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  markAll: { fontSize: 13, fontWeight: '600', color: colors.primary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, flexGrow: 1 },
  separator: { height: spacing.sm },
});
