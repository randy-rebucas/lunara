import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PartnerOrderSummary } from '@lunara/types';
import { formatCurrency, isPartnerLaundryProcessingStatus } from '@lunara/utils';
import { BranchBanner } from '../../src/components/branch-banner';
import { Card } from '../../src/components/ui/card';
import { EmptyState } from '../../src/components/ui/empty-state';
import { FilterChips } from '../../src/components/ui/filter-chips';
import { Screen } from '../../src/components/ui/screen';
import { StatusPill, type PillKind } from '../../src/components/ui/status-pill';
import { partnerFetch } from '../../src/api';
import { colors, radius, spacing, typography } from '../../src/theme';

const AUTO_REFRESH_MS = 25000;

type Stage = 'accept' | 'receive' | 'process' | 'deliver';

const STAGES: { id: Stage; label: string; shortLabel: string; kind: PillKind }[] = [
  { id: 'accept', label: '1. Accept', shortLabel: 'Accept', kind: 'warning' },
  { id: 'receive', label: '2. Receive & verify', shortLabel: 'Receive & verify', kind: 'primary' },
  { id: 'process', label: '3. Process', shortLabel: 'Process', kind: 'accent' },
  { id: 'deliver', label: '4. Request delivery', shortLabel: 'Request delivery', kind: 'neutral' },
];

const STAGE_PRIORITY: Record<Stage, number> = { accept: 0, receive: 1, deliver: 2, process: 3 };

type FilterValue = Stage | 'all';

const FILTER_OPTIONS: { id: FilterValue; label: string }[] = [
  { id: 'all', label: 'All' },
  ...STAGES.map((s) => ({ id: s.id as FilterValue, label: s.shortLabel })),
];

export function stageOf(order: PartnerOrderSummary): Stage {
  if (order.canAccept) return 'accept';
  if (order.status === 'ready_for_delivery') return 'deliver';
  if (isPartnerLaundryProcessingStatus(order.status)) return 'process';
  return 'receive';
}

function matchesSearch(order: PartnerOrderSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    order._id.toLowerCase().includes(q) ||
    order.bookingType.toLowerCase().includes(q) ||
    (order.paymentLabel ?? '').toLowerCase().includes(q) ||
    (order.currentStepLabel ?? '').toLowerCase().includes(q)
  );
}

function OrderRow({ order }: { order: PartnerOrderSummary }) {
  const router = useRouter();
  const stage = stageOf(order);
  const stageMeta = STAGES.find((s) => s.id === stage)!;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/order/[id]',
          params: {
            id: order._id,
            canAccept: String(!!order.canAccept),
            canRequestDelivery: String(!!order.canRequestDelivery),
          },
        })
      }
      accessibilityRole="button"
      style={({ pressed }) => pressed && styles.cardPressed}
    >
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bookingType} numberOfLines={1}>
              {order.bookingType.replace(/_/g, ' ')}
            </Text>
            <Text style={styles.orderId} numberOfLines={1}>
              #{order._id.slice(-6).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.price}>{formatCurrency(order.total)}</Text>
        </View>
        <View style={styles.pillRow}>
          <StatusPill label={stageMeta.label} kind={stageMeta.kind} />
          {order.paymentLabel ? (
            <View style={styles.paymentPill}>
              <Text style={styles.paymentPillText} numberOfLines={1}>
                {order.paymentLabel}
              </Text>
            </View>
          ) : null}
        </View>
        {order.currentStepLabel ? (
          <Text style={styles.stepLabel} numberOfLines={1}>
            {order.currentStepLabel}
          </Text>
        ) : null}
        {order.slaLabel ? (
          <View style={styles.slaRow}>
            <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
            <Text style={styles.slaLabel} numberOfLines={1}>
              {order.slaLabel}
            </Text>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function OrderSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonBlock, { width: '55%', height: 15 }]} />
      <View style={[styles.skeletonBlock, { width: '30%', height: 20, marginTop: spacing.sm }]} />
      <View style={[styles.skeletonBlock, { width: '70%', height: 12, marginTop: spacing.md }]} />
    </View>
  );
}

export default function OrdersScreen() {
  const [items, setItems] = useState<PartnerOrderSummary[]>([]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const data = await partnerFetch<{ items: PartnerOrderSummary[] }>('/partner/orders/incoming');
      setItems(data.items);
      setError('');
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Failed to load orders');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));

      pollRef.current = setInterval(() => {
        void load(true);
      }, AUTO_REFRESH_MS);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const stageCounts = useMemo(() => {
    const counts: Record<Stage, number> = { accept: 0, receive: 0, process: 0, deliver: 0 };
    for (const o of items) counts[stageOf(o)] += 1;
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? items : items.filter((o) => stageOf(o) === filter);
    if (query.trim()) list = list.filter((o) => matchesSearch(o, query));
    if (filter === 'all') {
      list = [...list].sort((a, b) => STAGE_PRIORITY[stageOf(a)] - STAGE_PRIORITY[stageOf(b)]);
    }
    return list;
  }, [items, filter, query]);

  const needsAttention = stageCounts.accept;

  if (loading) {
    return (
      <Screen inTab>
        <BranchBanner />
        {[0, 1, 2].map((i) => (
          <OrderSkeleton key={i} />
        ))}
      </Screen>
    );
  }

  return (
    <Screen inTab>
      <BranchBanner />

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {items.length} order{items.length === 1 ? '' : 's'}
        </Text>
        {needsAttention > 0 ? (
          <View style={styles.attentionPill}>
            <Ionicons name="alert-circle" size={13} color={colors.warning} />
            <Text style={styles.attentionText}>
              {needsAttention} need{needsAttention === 1 ? 's' : ''} accepting
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.mutedForeground} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search order, service, payment…"
          placeholderTextColor={colors.mutedForeground}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FilterChips
        options={FILTER_OPTIONS.map((o) => ({
          ...o,
          label: o.id === 'all' ? o.label : `${o.label} (${stageCounts[o.id as Stage]})`,
        }))}
        value={filter}
        onChange={setFilter}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(o) => o._id}
        renderItem={({ item }) => <OrderRow order={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            title={query ? 'No matching orders' : 'No orders here'}
            message={
              query
                ? 'Try a different search term or clear the search.'
                : 'Orders assigned to your shop will show up here as they move through the pipeline.'
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryText: { ...typography.bodySm, fontWeight: '600' },
  attentionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  attentionText: { fontSize: 11, fontWeight: '700', color: colors.warning },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    color: colors.foreground,
  },
  card: { gap: spacing.xs },
  cardPressed: { opacity: 0.8 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  bookingType: {
    ...typography.subheading,
    fontSize: 15,
    textTransform: 'capitalize',
  },
  orderId: { ...typography.caption, marginTop: 2 },
  price: { fontSize: 15, fontWeight: '700', color: colors.primary },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  paymentPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  paymentPillText: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
  stepLabel: { ...typography.bodySm, marginTop: spacing.xs },
  slaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  slaLabel: { ...typography.caption },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  error: { color: colors.destructive, fontSize: 13, fontWeight: '500', flexShrink: 1 },
  retryText: { color: colors.destructive, fontSize: 13, fontWeight: '700' },
  listContainer: { paddingBottom: spacing.xxxl },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  skeletonBlock: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm },
});
