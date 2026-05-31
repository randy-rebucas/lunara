import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useRiderOperations } from '../../src/context/rider-operations';
import { FilterChips } from '../../src/components/ui/filter-chips';
import { Card } from '../../src/components/ui/card';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Screen } from '../../src/components/ui/screen';
import { TaskTypeBadge } from '../../src/components/ui/task-type-badge';
import { riderFetch } from '../../src/api';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import {
  buildTaskListRows,
  TASK_LIST_FILTERS,
  taskListEmptyMessage,
  type TaskListFilter,
  type TaskListRow,
} from '../../src/lib/task-list-filters';
import type { CancelledTaskItem, TaskHistoryItem } from '../../src/lib/rider-types';
import { riderTaskStatusLabel } from '../../src/rider-labels';
import { colors, spacing, typography } from '../../src/theme';

export default function TasksScreen() {
  const tabPadding = useTabScreenPadding();
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const initialFilter =
    filterParam && TASK_LIST_FILTERS.some((f) => f.id === filterParam)
      ? (filterParam as TaskListFilter)
      : 'assigned';
  const [filter, setFilter] = useState<TaskListFilter>(initialFilter);
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [cancelled, setCancelled] = useState<CancelledTaskItem[]>([]);
  const {
    offers,
    deliveryOffers,
    tasks,
    online,
    refreshing,
    onRefresh,
    acceptPickupOffer,
    previewDeliveryQueue,
    openTask,
  } = useRiderOperations();

  useEffect(() => {
    if (
      filterParam &&
      TASK_LIST_FILTERS.some((f) => f.id === filterParam) &&
      filterParam !== filter
    ) {
      setFilter(filterParam as TaskListFilter);
    }
  }, [filterParam, filter]);

  const loadArchived = useCallback(async () => {
    if (filter === 'completed') {
      try {
        const data = await riderFetch<TaskHistoryItem[]>('/riders/tasks/history?limit=30');
        setHistory(data);
      } catch {
        setHistory([]);
      }
      return;
    }

    if (filter === 'cancelled') {
      try {
        const data = await riderFetch<CancelledTaskItem[]>('/riders/tasks/cancelled?limit=30');
        setCancelled(data);
      } catch {
        setCancelled([]);
      }
    }
  }, [filter]);

  useEffect(() => {
    if (filter === 'completed' || filter === 'cancelled') {
      void loadArchived();
    }
  }, [filter, loadArchived]);

  async function handleRefresh() {
    await onRefresh();
    if (filter === 'completed' || filter === 'cancelled') {
      await loadArchived();
    }
  }

  const rows = useMemo(
    () => buildTaskListRows(filter, offers, deliveryOffers, tasks, history, cancelled),
    [filter, offers, deliveryOffers, tasks, history, cancelled],
  );

  function handleRowPress(row: TaskListRow) {
    switch (row.kind) {
      case 'pickup_offer':
        void acceptPickupOffer(row.item._id);
        break;
      case 'delivery_offer':
        previewDeliveryQueue(row.item._id);
        break;
      case 'task':
        openTask(row.item._id, row.item.status);
        break;
      case 'history':
        openTask(row.item._id, row.item.status);
        break;
      case 'cancelled':
        openTask(row.item._id, row.item.status);
        break;
    }
  }

  function renderRow({ item: row }: { item: TaskListRow }) {
    if (row.kind === 'pickup_offer') {
      const item = row.item;
      return (
        <Pressable onPress={() => handleRowPress(row)}>
          <Card primary style={styles.card}>
            <TaskTypeBadge type="pickup" />
            <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
            <Text style={styles.meta}>
              {item.pickupAddress?.label ?? 'Address'} · {item.pickupAddress?.city ?? ''}
            </Text>
            {item.scheduledPickupAt ? (
              <Text style={styles.meta}>
                Scheduled:{' '}
                {new Date(item.scheduledPickupAt).toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            ) : null}
            <Text style={styles.action}>Accept pickup →</Text>
          </Card>
        </Pressable>
      );
    }

    if (row.kind === 'delivery_offer') {
      const item = row.item;
      return (
        <Pressable onPress={() => handleRowPress(row)}>
          <Card accent style={styles.card}>
            <TaskTypeBadge type="delivery" />
            <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
            <Text style={styles.meta}>
              {item.deliveryAddress?.label ?? 'Address'} · {item.deliveryAddress?.city ?? ''}
            </Text>
            <Text style={[styles.action, styles.actionAccent]}>View in queue →</Text>
          </Card>
        </Pressable>
      );
    }

    if (row.kind === 'history') {
      const item = row.item;
      return (
        <Pressable onPress={() => handleRowPress(row)}>
          <Card style={styles.card}>
            <View style={styles.rowTop}>
              <TaskTypeBadge type={item.leg === 'delivery' ? 'delivery' : 'pickup'} />
              <Text style={styles.date}>
                {new Date(item.completedAt).toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
            <Text style={styles.meta}>{riderTaskStatusLabel(item.status)}</Text>
            {item.branchName ? <Text style={styles.branch}>{item.branchName}</Text> : null}
          </Card>
        </Pressable>
      );
    }

    if (row.kind === 'cancelled') {
      const item = row.item;
      return (
        <Pressable onPress={() => handleRowPress(row)}>
          <Card style={styles.card}>
            <View style={styles.rowTop}>
              <TaskTypeBadge type={item.leg === 'delivery' ? 'delivery' : 'pickup'} />
              <Text style={styles.date}>
                {new Date(item.cancelledAt).toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
            <Text style={styles.meta}>Cancelled</Text>
            {item.branchName ? <Text style={styles.branch}>{item.branchName}</Text> : null}
          </Card>
        </Pressable>
      );
    }

    const item = row.item;
    return (
      <Pressable onPress={() => handleRowPress(row)}>
        <Card elevated style={styles.taskCard}>
          <View style={styles.taskAccent} />
          <View style={styles.taskContent}>
            <TaskTypeBadge type={item.leg === 'delivery' ? 'delivery' : 'active'} />
            <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
            <Text style={styles.meta}>{riderTaskStatusLabel(item.status)}</Text>
            {item.branchName ? <Text style={styles.branch}>{item.branchName}</Text> : null}
          </View>
        </Card>
      </Pressable>
    );
  }

  const showOfflineGate = !online && filter !== 'completed' && filter !== 'cancelled';

  return (
    <Screen
      inTab
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      contentStyle={{ paddingBottom: tabPadding }}
    >
      <Text style={styles.title}>Tasks</Text>
      <Text style={styles.subtitle}>Filter by assignment stage.</Text>

      <FilterChips options={TASK_LIST_FILTERS} value={filter} onChange={setFilter} />

      {showOfflineGate ? (
        <EmptyState
          title="Start your shift"
          message={taskListEmptyMessage(filter, online)}
        />
      ) : (
        <FlatList
          data={rows}
          scrollEnabled={false}
          keyExtractor={(row, index) => {
            const id =
              row.kind === 'pickup_offer' ||
              row.kind === 'delivery_offer' ||
              row.kind === 'task' ||
              row.kind === 'history' ||
              row.kind === 'cancelled'
                ? row.item._id
                : String(index);
            return `${row.kind}-${id}`;
          }}
          renderItem={renderRow}
          ListEmptyComponent={
            <EmptyState
              title={`No ${TASK_LIST_FILTERS.find((f) => f.id === filter)?.label ?? ''} tasks`}
              message={taskListEmptyMessage(filter, online)}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, fontSize: 22 },
  subtitle: { ...typography.bodySm, marginTop: spacing.xs, marginBottom: spacing.md },
  card: { marginBottom: spacing.sm + 2, gap: spacing.xs },
  taskCard: {
    marginBottom: spacing.sm + 2,
    flexDirection: 'row',
    padding: 0,
    overflow: 'hidden',
  },
  taskAccent: {
    width: 4,
    backgroundColor: colors.secondary,
  },
  taskContent: { flex: 1, padding: spacing.lg, gap: spacing.xs },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: {
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'capitalize',
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  meta: { ...typography.bodySm, textTransform: 'capitalize' },
  date: { ...typography.caption },
  branch: { ...typography.caption, color: colors.primary },
  action: { marginTop: spacing.sm, fontSize: 13, color: colors.primary, fontWeight: '600' },
  actionAccent: { color: colors.accentDark },
});
