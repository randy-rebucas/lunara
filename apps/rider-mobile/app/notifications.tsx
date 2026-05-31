import { useCallback, useEffect, useMemo, useState } from 'react';

import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

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



type FilterKey = 'all' | RiderNotificationCategory;



const FILTERS: { key: FilterKey; label: string }[] = [

  { key: 'all', label: 'All' },

  { key: RIDER_NOTIFICATION_CATEGORY.ASSIGNMENT, label: 'Assignment' },

  { key: RIDER_NOTIFICATION_CATEGORY.REMINDER, label: 'Reminder' },

  { key: RIDER_NOTIFICATION_CATEGORY.EARNINGS, label: 'Earnings' },

  { key: RIDER_NOTIFICATION_CATEGORY.SYSTEM, label: 'System' },

];



export default function NotificationsScreen() {

  const { setUnreadCount } = useRiderOperations();

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



  const filteredItems = useMemo(() => {

    if (filter === 'all') return items;

    return items.filter((item) => resolveNotificationCategory(item) === filter);

  }, [filter, items]);



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

    <Screen inStack>

      <View style={styles.filters}>

        {FILTERS.map((item) => (

          <Pressable

            key={item.key}

            style={[styles.filterChip, filter === item.key && styles.filterChipActive]}

            onPress={() => setFilter(item.key)}

          >

            <Text

              style={[styles.filterText, filter === item.key && styles.filterTextActive]}

            >

              {item.label}

            </Text>

          </Pressable>

        ))}

      </View>



      <FlatList

        style={styles.list}

        data={filteredItems}

        keyExtractor={(item) => item._id}

        contentContainerStyle={styles.content}

        refreshControl={

          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />

        }

        renderItem={({ item }) => (

          <NotificationListItem notification={item} onMarkRead={markRead} />

        )}

        ItemSeparatorComponent={() => <View style={styles.separator} />}

        ListEmptyComponent={

          <View style={styles.emptyWrap}>

            <Text style={styles.emptyTitle}>No notifications yet</Text>

            <Text style={styles.emptyBody}>

              Assignment updates, overdue reminders, earnings, and platform announcements appear

              here.

            </Text>

          </View>

        }

      />

    </Screen>

  );

}



const styles = StyleSheet.create({

  filters: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    gap: spacing.sm,

    paddingHorizontal: spacing.lg,

    paddingTop: spacing.sm,

    paddingBottom: spacing.md,

  },

  filterChip: {

    paddingHorizontal: spacing.md,

    paddingVertical: spacing.sm,

    borderRadius: radius.full,

    borderWidth: 1,

    borderColor: colors.border,

    backgroundColor: colors.surface,

  },

  filterChipActive: {

    borderColor: colors.primary,

    backgroundColor: colors.primaryLight,

  },

  filterText: { ...typography.bodySm, color: colors.muted },

  filterTextActive: { color: colors.primary, fontWeight: '700' },

  list: { flex: 1 },

  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, flexGrow: 1 },

  separator: { height: spacing.sm },

  emptyWrap: {

    alignItems: 'center',

    paddingTop: spacing.xxxl * 2,

    paddingHorizontal: spacing.xl,

  },

  emptyTitle: { ...typography.subheading, marginBottom: spacing.sm },

  emptyBody: { ...typography.bodySm, textAlign: 'center' },

});

