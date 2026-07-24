import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { DataLoadState } from '../../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../src/store/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

interface SubscriptionRow {
  _id: string;
  bookingType: string;
  frequencyDays: number;
  nextRunAt: string;
  active: boolean;
  lastError?: string;
}

const FREQUENCY_LABELS: Record<number, string> = { 7: 'Weekly', 14: 'Biweekly', 30: 'Monthly' };

export default function SubscriptionsListScreen() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [items, setItems] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiFetch<SubscriptionRow[]>('/subscriptions');
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleActive(item: SubscriptionRow) {
    setActioningId(item._id);
    try {
      await apiFetch(`/subscriptions/${item._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active }),
      });
      await load();
    } finally {
      setActioningId(null);
    }
  }

  async function cancelSubscription(item: SubscriptionRow) {
    setActioningId(item._id);
    try {
      await apiFetch(`/subscriptions/${item._id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((s) => s._id !== item._id));
    } finally {
      setActioningId(null);
    }
  }

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.sub}>Manage your recurring pickups.</Text>

      <DataLoadState
        loading={loading}
        error={error}
        loadingMessage="Loading subscriptions…"
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />

      {!loading && !error ? (
        items.length === 0 ? (
          <Card muted style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="repeat-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No recurring pickups yet</Text>
            <Text style={styles.emptyText}>
              After placing an order, you&apos;ll be offered the option to repeat it automatically.
            </Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <Card key={item._id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle}>{item.bookingType.replace(/_/g, ' ')}</Text>
                  <View style={[styles.statusPill, item.active ? styles.statusPillActive : styles.statusPillPaused]}>
                    <Text style={styles.statusPillText}>{item.active ? 'Active' : 'Paused'}</Text>
                  </View>
                </View>
                <Text style={styles.rowMeta}>
                  {FREQUENCY_LABELS[item.frequencyDays] ?? `Every ${item.frequencyDays} days`} · Next:{' '}
                  {new Date(item.nextRunAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </Text>
                {item.lastError ? (
                  <Text style={styles.rowError}>Last attempt failed: {item.lastError}</Text>
                ) : null}
                <View style={styles.rowActions}>
                  <Button
                    label={item.active ? 'Pause' : 'Resume'}
                    variant="outline"
                    disabled={actioningId === item._id}
                    onPress={() => toggleActive(item)}
                    style={styles.rowBtn}
                  />
                  <Button
                    label="Cancel"
                    variant="outline"
                    disabled={actioningId === item._id}
                    onPress={() => cancelSubscription(item)}
                    style={styles.rowBtn}
                  />
                </View>
              </Card>
            ))}
          </View>
        )
      ) : null}
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.xxxl },
  sub: { ...typography.bodySm, marginBottom: spacing.lg },
  list: { gap: spacing.sm },
  row: { gap: spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground, textTransform: 'capitalize' },
  rowMeta: { ...typography.caption, color: colors.muted },
  rowError: { fontSize: 12, color: colors.destructive },
  rowActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  rowBtn: { flex: 1 },
  statusPill: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusPillActive: { backgroundColor: colors.accentLight },
  statusPillPaused: { backgroundColor: colors.surfaceMuted },
  statusPillText: { fontSize: 11, fontWeight: '700', color: colors.foreground },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderWidth: 0,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...typography.subheading, marginBottom: spacing.xs },
  emptyText: { ...typography.bodySm, color: colors.muted, textAlign: 'center' },
});
