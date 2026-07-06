import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRiderOperations } from '../../src/context/rider-operations';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Screen } from '../../src/components/ui/screen';
import { riderFetch } from '../../src/api';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import {
  buildTaskListRows,
  classifyTask,
  TASK_LIST_FILTERS,
  taskListEmptyMessage,
  type TaskListFilter,
  type TaskListRow,
} from '../../src/lib/task-list-filters';
import type {
  CancelledTaskItem,
  DeliveryOffer,
  PickupOffer,
  Task,
  TaskHistoryItem,
} from '../../src/lib/rider-types';
import { riderTaskStatusLabel } from '../../src/rider-labels';
import { colors, radius, spacing, typography } from '../../src/theme';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatOfferTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatCardDate(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatBookingType(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Route visualization ───────────────────────────────────────────────────────

interface RouteRowProps {
  fromLabel: string;
  fromCity?: string;
  fromSub?: string;
  toLabel: string;
  toCity?: string;
  toSub?: string;
}

function RouteRow({ fromLabel, fromCity, fromSub, toLabel, toCity, toSub }: RouteRowProps) {
  return (
    <View style={routeStyles.wrap}>
      <View style={routeStyles.left}>
        <View style={routeStyles.dotOrigin} />
        <View style={routeStyles.line} />
        <Ionicons name="location" size={16} color={colors.accent} />
      </View>
      <View style={routeStyles.addresses}>
        <View style={routeStyles.address}>
          <Text style={routeStyles.addrMain}>{fromLabel}</Text>
          {fromCity ? <Text style={routeStyles.addrSub}>{fromCity}</Text> : null}
          {fromSub ? <Text style={routeStyles.addrSub}>{fromSub}</Text> : null}
        </View>
        <View style={routeStyles.address}>
          <Text style={routeStyles.addrMain}>{toLabel}</Text>
          {toCity ? <Text style={routeStyles.addrSub}>{toCity}</Text> : null}
          {toSub ? <Text style={routeStyles.addrSub}>{toSub}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const routeStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.sm },
  left: { alignItems: 'center', paddingTop: 3 },
  dotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 3,
  },
  addresses: { flex: 1, gap: spacing.md + 4 },
  address: {},
  addrMain: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  addrSub: { ...typography.caption, marginTop: 1 },
});

// ── Time chip ─────────────────────────────────────────────────────────────────

function TimeChip({ label }: { label: string }) {
  return (
    <View style={chipStyles.wrap}>
      <Ionicons name="time-outline" size={13} color={colors.primary} />
      <Text style={chipStyles.text}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  text: { fontSize: 12, fontWeight: '600', color: colors.primary },
});

// ── Offer card (shared shell) ─────────────────────────────────────────────────

interface OfferCardShellProps {
  typeLabel: string;
  typeColor: string;
  typeBg: string;
  onAccept: () => void;
  onDecline: () => void;
  children: React.ReactNode;
}

function OfferCardShell({
  typeLabel,
  typeColor,
  typeBg,
  onAccept,
  onDecline,
  children,
}: OfferCardShellProps) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.typePill, { backgroundColor: typeBg }]}>
          <Text style={[cardStyles.typePillText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        <View style={cardStyles.newBadge}>
          <Ionicons name="radio-outline" size={11} color={colors.warning} />
          <Text style={cardStyles.newBadgeText}>New offer</Text>
        </View>
      </View>
      {children}
      <View style={cardStyles.actions}>
        <Pressable
          style={({ pressed }) => [cardStyles.declineBtn, pressed && cardStyles.btnPressed]}
          onPress={onDecline}
          accessibilityRole="button"
          accessibilityLabel="Decline"
        >
          <Ionicons name="close-outline" size={16} color={colors.destructive} />
          <Text style={cardStyles.declineBtnText}>Decline</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [cardStyles.acceptBtn, pressed && cardStyles.btnPressed]}
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel="Accept"
        >
          <Ionicons name="checkmark-outline" size={16} color="#fff" />
          <Text style={cardStyles.acceptBtnText}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Pickup offer card ─────────────────────────────────────────────────────────

const PickupOfferCard = React.memo(function PickupOfferCard({
  item,
  shopName,
  onAccept,
  onDecline,
}: {
  item: PickupOffer;
  shopName: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const pickupTime = formatOfferTime(item.scheduledPickupAt);
  return (
    <OfferCardShell
      typeLabel="PICKUP"
      typeColor={colors.primary}
      typeBg={colors.primaryLight}
      onAccept={onAccept}
      onDecline={onDecline}
    >
      <RouteRow
        fromLabel={item.pickupAddress?.label ?? 'Customer address'}
        fromCity={item.pickupAddress?.city}
        toLabel={shopName}
        toSub="Drop-off at shop"
      />
      {pickupTime ? <TimeChip label={`Pick up by ${pickupTime}`} /> : null}
    </OfferCardShell>
  );
});

// ── Delivery offer card ───────────────────────────────────────────────────────

const DeliveryOfferCard = React.memo(function DeliveryOfferCard({
  item,
  shopName,
  onAccept,
  onDecline,
}: {
  item: DeliveryOffer;
  shopName: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <OfferCardShell
      typeLabel="DELIVERY"
      typeColor={colors.accentDark}
      typeBg={colors.accentLight}
      onAccept={onAccept}
      onDecline={onDecline}
    >
      <RouteRow
        fromLabel={shopName}
        fromSub="Pick up from shop"
        toLabel={item.deliveryAddress?.label ?? 'Customer address'}
        toCity={item.deliveryAddress?.city}
      />
    </OfferCardShell>
  );
});

// ── Active task card ──────────────────────────────────────────────────────────

const TaskCard = React.memo(function TaskCard({ item, onPress }: { item: Task; onPress: () => void }) {
  const isDelivery = item.leg === 'delivery';
  const typeLabel = isDelivery ? 'DELIVERY' : 'PICKUP';
  const typeBg = isDelivery ? colors.accentLight : colors.primaryLight;
  const typeColor = isDelivery ? colors.accentDark : colors.primary;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && cardStyles.cardPressed}>
      <View style={cardStyles.card}>
        <View style={cardStyles.topRow}>
          <View style={[cardStyles.typePill, { backgroundColor: typeBg }]}>
            <Text style={[cardStyles.typePillText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
        </View>
        <RouteRow
          fromLabel={item.pickupAddress?.label ?? 'Pickup address'}
          fromCity={item.pickupAddress?.city}
          toLabel={item.deliveryAddress?.label ?? item.branchName ?? 'Drop-off'}
          toCity={item.deliveryAddress?.city}
        />
        <View style={cardStyles.statusRow}>
          <Text style={cardStyles.statusText}>{riderTaskStatusLabel(item.status)}</Text>
          <View style={cardStyles.viewTaskBtn}>
            <Text style={cardStyles.viewTaskBtnText}>View task</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

// ── History / cancelled card ──────────────────────────────────────────────────

const ArchiveCard = React.memo(function ArchiveCard({
  typePill,
  typeColor,
  typeBg,
  dateLabel,
  bookingType,
  statusLabel,
  branchName,
  onPress,
}: {
  typePill: string;
  typeColor: string;
  typeBg: string;
  dateLabel: string;
  bookingType: string;
  statusLabel: string;
  branchName?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && cardStyles.cardPressed}>
      <View style={cardStyles.card}>
        <View style={cardStyles.topRow}>
          <View style={[cardStyles.typePill, { backgroundColor: typeBg }]}>
            <Text style={[cardStyles.typePillText, { color: typeColor }]}>{typePill}</Text>
          </View>
          <Text style={cardStyles.dateText}>{dateLabel}</Text>
        </View>
        <Text style={cardStyles.bookingType}>{bookingType}</Text>
        <Text style={cardStyles.statusMuted}>{statusLabel}</Text>
        {branchName ? <Text style={cardStyles.branchText}>{branchName}</Text> : null}
      </View>
    </Pressable>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  typePill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateText: { ...typography.caption },
  bookingType: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  statusMuted: { ...typography.bodySm, marginTop: spacing.xs, textTransform: 'capitalize' },
  branchText: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  statusText: {
    ...typography.bodySm,
    color: colors.accentDark,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  viewTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewTaskBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.destructive,
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 0.2,
  },
  btnPressed: { opacity: 0.8 },
  cardPressed: { opacity: 0.9 },
});

// ── Tasks screen ──────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const router = useRouter();
  const tabPadding = useTabScreenPadding();
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const initialFilter =
    filterParam && TASK_LIST_FILTERS.some((f) => f.id === filterParam)
      ? (filterParam as TaskListFilter)
      : 'assigned';

  const [filter, setFilter] = useState<TaskListFilter>(initialFilter);
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [cancelled, setCancelled] = useState<CancelledTaskItem[]>([]);
  const [dismissedPickup, setDismissedPickup] = useState<Set<string>>(new Set());
  const [dismissedDelivery, setDismissedDelivery] = useState<Set<string>>(new Set());

  const {
    me,
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

  const shopName = me?.shopLocation?.name ?? 'Lunara Hub';

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

  // Active counts per filter for chip badges
  const filterCounts = useMemo(() => {
    const assignedCount =
      offers.filter((o) => !dismissedPickup.has(o._id)).length +
      deliveryOffers.filter((o) => !dismissedDelivery.has(o._id)).length +
      tasks.filter((t) => classifyTask(t) === 'assigned').length;
    const acceptedCount = tasks.filter((t) => classifyTask(t) === 'accepted').length;
    const inProgressCount = tasks.filter((t) => classifyTask(t) === 'in_progress').length;
    return { assigned: assignedCount, accepted: acceptedCount, in_progress: inProgressCount };
  }, [offers, deliveryOffers, tasks, dismissedPickup, dismissedDelivery]);

  const rows = useMemo(
    () =>
      buildTaskListRows(
        filter,
        offers.filter((o) => !dismissedPickup.has(o._id)),
        deliveryOffers.filter((o) => !dismissedDelivery.has(o._id)),
        tasks,
        history,
        cancelled,
      ),
    [filter, offers, deliveryOffers, tasks, history, cancelled, dismissedPickup, dismissedDelivery],
  );

  const renderRow = useCallback(function renderRow({ item: row }: { item: TaskListRow }) {
    if (row.kind === 'pickup_offer') {
      return (
        <PickupOfferCard
          item={row.item}
          shopName={shopName}
          onAccept={() => void acceptPickupOffer(row.item._id)}
          onDecline={() => setDismissedPickup((s) => new Set([...s, row.item._id]))}
        />
      );
    }

    if (row.kind === 'delivery_offer') {
      return (
        <DeliveryOfferCard
          item={row.item}
          shopName={shopName}
          onAccept={() => previewDeliveryQueue(row.item._id)}
          onDecline={() => setDismissedDelivery((s) => new Set([...s, row.item._id]))}
        />
      );
    }

    if (row.kind === 'task') {
      return (
        <TaskCard
          item={row.item}
          onPress={() => openTask(row.item._id, row.item.status)}
        />
      );
    }

    if (row.kind === 'history') {
      const item = row.item;
      return (
        <ArchiveCard
          typePill={item.leg === 'delivery' ? 'DELIVERY' : 'PICKUP'}
          typeColor={item.leg === 'delivery' ? colors.accentDark : colors.primary}
          typeBg={item.leg === 'delivery' ? colors.accentLight : colors.primaryLight}
          dateLabel={formatCardDate(item.completedAt)}
          bookingType={formatBookingType(item.bookingType)}
          statusLabel={riderTaskStatusLabel(item.status)}
          branchName={item.branchName}
          onPress={() => openTask(item._id, item.status)}
        />
      );
    }

    if (row.kind === 'cancelled') {
      const item = row.item;
      return (
        <ArchiveCard
          typePill={item.leg === 'delivery' ? 'DELIVERY' : 'PICKUP'}
          typeColor={colors.destructive}
          typeBg="#FEF2F2"
          dateLabel={formatCardDate(item.cancelledAt)}
          bookingType={formatBookingType(item.bookingType)}
          statusLabel="Cancelled"
          branchName={item.branchName}
          onPress={() => openTask(item._id, item.status)}
        />
      );
    }

    return null;
  }, [shopName, acceptPickupOffer, previewDeliveryQueue, openTask]);

  const showOfflineGate = !online && filter !== 'completed' && filter !== 'cancelled';

  const keyExtractor = useCallback((row: TaskListRow, index: number) => {
    const id =
      row.kind === 'pickup_offer' ||
      row.kind === 'delivery_offer' ||
      row.kind === 'task' ||
      row.kind === 'history' ||
      row.kind === 'cancelled'
        ? row.item._id
        : String(index);
    return `${row.kind}-${id}`;
  }, []);

  const listHeader = (
    <>
      {/* ── Title row ── */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Tasks</Text>
          <Text style={styles.subtitle}>Filter by assignment stage.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            style={styles.sortBtn}
            accessibilityRole="button"
            accessibilityLabel="Scan a laundry tag"
            onPress={() => router.push('/scan?mode=lookup_tag')}
          >
            <Ionicons name="qr-code-outline" size={15} color={colors.primary} />
            <Text style={styles.sortBtnText}>Scan tag</Text>
          </Pressable>
          <Pressable style={styles.sortBtn} accessibilityRole="button" accessibilityLabel="Sort tasks">
            <Ionicons name="funnel-outline" size={15} color={colors.primary} />
            <Text style={styles.sortBtnText}>Sort</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Filter chips with counts ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {TASK_LIST_FILTERS.map((opt) => {
          const active = opt.id === filter;
          const count =
            opt.id === 'assigned'
              ? filterCounts.assigned
              : opt.id === 'accepted'
                ? filterCounts.accepted
                : opt.id === 'in_progress'
                  ? filterCounts.in_progress
                  : 0;
          return (
            <Pressable
              key={opt.id}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.chipPressed]}
              onPress={() => setFilter(opt.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              android_ripple={{ color: 'transparent' }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              {count > 0 ? (
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );

  const listEmpty = showOfflineGate ? (
    <EmptyState title="Start your shift" message={taskListEmptyMessage(filter, online)} />
  ) : (
    <EmptyState
      title={`No ${TASK_LIST_FILTERS.find((f) => f.id === filter)?.label ?? ''} tasks`}
      message={taskListEmptyMessage(filter, online)}
    />
  );

  return (
    <Screen inTab contentStyle={{ paddingBottom: 0 }}>
      <FlatList
        data={showOfflineGate ? [] : rows}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingBottom: tabPadding, flexGrow: 1 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // ── Title ──
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  // ── Filter chips ──
  chipsRow: {
    paddingBottom: spacing.lg,
    paddingRight: spacing.xl,
  },
  chip: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.bodySm,
    fontWeight: '600',
    color: colors.slate700,
    lineHeight: 18,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: spacing.xs,
  },
  chipBadgeActive: {
    backgroundColor: '#fff',
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  chipBadgeTextActive: {
    color: colors.primary,
  },
});
