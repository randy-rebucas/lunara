import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { formatRefundStatus } from '@lunara/utils';
import { Card } from '../../src/components/ui/card';
import { DataLoadState } from '../../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../src/store/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

// 'approved' still styles as open (payout hasn't happened yet); 'rejected' is a closed-out state
// even though nothing was paid — matches the semantics of customer-web's isOpenRefundStatus.
const RESOLVED_STATUSES = new Set(['processed', 'closed', 'rejected']);

interface RefundRow {
  _id: string;
  orderId: string;
  status: string;
  stage: string;
  requestedAmount: number;
  approvedAmount?: number;
  updatedAt?: string;
}

export default function RefundsListScreen() {
  const router = useRouter();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [items, setItems] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiFetch<RefundRow[]>('/refunds');
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load refunds');
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

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.sub}>Track status from submission through payout.</Text>

      <DataLoadState
        loading={loading}
        error={error}
        loadingMessage="Loading refunds…"
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />

      {!loading && !error ? (
        items.length === 0 ? (
          <Card muted style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No refund requests yet</Text>
            <Text style={styles.emptyText}>
              If something goes wrong with an order, you can request a refund from the order
              details screen.
            </Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {items.map((r) => {
              const resolved = RESOLVED_STATUSES.has(r.status);
              return (
                <Pressable
                  key={r._id}
                  onPress={() => router.push(`/refunds/${r._id}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${r.orderId.slice(-6)}, ${formatRefundStatus(r.status)}, ₱${r.requestedAmount}`}
                  style={({ pressed }) => pressed && styles.rowPressed}
                >
                  <Card style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="cash-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>Order …{r.orderId.slice(-6)}</Text>
                      <Text style={styles.rowAmount}>₱{r.requestedAmount}</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <View
                        style={[styles.statusPill, resolved ? styles.statusPillResolved : styles.statusPillOpen]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            { color: resolved ? colors.accentDark : colors.primary },
                          ]}
                        >
                          {formatRefundStatus(r.status)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
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
  rowPressed: { opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  rowAmount: { ...typography.caption },
  rowRight: { alignItems: 'flex-end', gap: spacing.xs },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPillOpen: { backgroundColor: colors.primaryLight },
  statusPillResolved: { backgroundColor: colors.accentLight },
  statusPillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
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
