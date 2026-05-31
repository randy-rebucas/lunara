import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DataLoadState } from '../src/components/data-load-state';
import { NotificationListItem } from '../src/components/notification-list-item';
import { useNotifications } from '../src/hooks/use-notifications';
import { colors, spacing, typography } from '../src/theme';

export default function NotificationsScreen() {
  const { items, loading, refreshing, error, refresh, markRead, load } = useNotifications(50);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        <DataLoadState loading error="" loadingMessage="Loading notifications…" />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.container}>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyBody}>
              Order updates, review requests, and refund alerts will show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <NotificationListItem notification={item} onMarkRead={markRead} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  separator: { height: spacing.sm },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: spacing.xxxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: { ...typography.subheading, marginBottom: spacing.sm },
  emptyBody: { ...typography.bodySm, textAlign: 'center' },
});
