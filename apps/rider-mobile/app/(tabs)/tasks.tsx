import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRiderOperations } from '../../src/context/rider-operations';
import { Card } from '../../src/components/ui/card';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Screen } from '../../src/components/ui/screen';
import { SectionHeader } from '../../src/components/ui/section-header';
import { TaskTypeBadge } from '../../src/components/ui/task-type-badge';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { riderTaskStatusLabel } from '../../src/rider-labels';
import { colors, spacing, typography } from '../../src/theme';

export default function TasksScreen() {
  const tabPadding = useTabScreenPadding();
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

  return (
    <Screen
      inTab
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentStyle={{ paddingBottom: tabPadding }}
    >
      {online ? (
        <>
          <SectionHeader title="Pickup offers" hint="Tap to accept and open the pickup workflow." />
          <FlatList
            data={offers}
            scrollEnabled={false}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <Pressable onPress={() => acceptPickupOffer(item._id)}>
                <Card primary style={styles.offerCard}>
                  <TaskTypeBadge type="pickup" />
                  <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
                  <Text style={styles.address}>
                    {item.pickupAddress?.label ?? 'Address'} · {item.pickupAddress?.city ?? ''}
                  </Text>
                  {item.scheduledPickupAt && (
                    <Text style={styles.meta}>
                      Scheduled:{' '}
                      {new Date(item.scheduledPickupAt).toLocaleString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                  <Text style={styles.action}>Accept pickup →</Text>
                </Card>
              </Pressable>
            )}
            ListEmptyComponent={
              <EmptyState
                title="No pickup offers"
                message="New customer pickups will appear here when dispatch sends them."
              />
            }
          />

          <SectionHeader
            title="Delivery queue"
            hint="Ready at shop — dispatch assigns you, then open from Active tasks."
          />
          <FlatList
            data={deliveryOffers}
            scrollEnabled={false}
            keyExtractor={(item) => `d-${item._id}`}
            renderItem={({ item }) => (
              <Pressable onPress={() => previewDeliveryQueue(item._id)}>
                <Card accent style={styles.offerCard}>
                  <TaskTypeBadge type="delivery" />
                  <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
                  <Text style={styles.address}>
                    {item.deliveryAddress?.label ?? 'Address'} · {item.deliveryAddress?.city ?? ''}
                  </Text>
                  <Text style={[styles.action, styles.actionAccent]}>View details →</Text>
                </Card>
              </Pressable>
            )}
            ListEmptyComponent={
              <EmptyState
                title="Delivery queue empty"
                message="Orders ready for delivery will show here while you are on shift."
              />
            }
          />

          <SectionHeader title="Active tasks" hint="Open a task to continue pickup or delivery workflow." />
          <FlatList
            data={tasks}
            scrollEnabled={false}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <Pressable onPress={() => openTask(item._id, item.status)}>
                <Card elevated style={styles.taskCard}>
                  <View style={styles.taskAccent} />
                  <View style={styles.taskContent}>
                    <TaskTypeBadge type="active" />
                    <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
                    <Text style={styles.address}>{riderTaskStatusLabel(item.status)}</Text>
                  </View>
                </Card>
              </Pressable>
            )}
            ListEmptyComponent={
              <EmptyState
                title="No active tasks"
                message="Accepted pickups and assigned deliveries appear here."
              />
            }
          />
        </>
      ) : (
        <View style={styles.offlineSection}>
          <EmptyState
            title="Start your shift"
            message="Go online from Home to receive pickup offers, view the delivery queue, and manage active tasks."
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  offlineSection: { marginTop: spacing.sm },
  offerCard: { marginBottom: spacing.sm + 2, gap: spacing.xs },
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
  type: {
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'capitalize',
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  address: {
    ...typography.bodySm,
    textTransform: 'capitalize',
  },
  meta: { ...typography.caption },
  action: { marginTop: spacing.sm, fontSize: 13, color: colors.primary, fontWeight: '600' },
  actionAccent: { color: colors.accentDark },
});
