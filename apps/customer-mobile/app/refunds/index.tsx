import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { formatRefundStatus } from '@lunara/utils';
import { Card } from '../../src/components/ui/card';
import { DataLoadState } from '../../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../src/store/auth';
import { colors, spacing, typography } from '../../src/theme';

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
            <Text style={styles.emptyText}>No refund requests yet.</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {items.map((r) => (
              <Pressable key={r._id} onPress={() => router.push(`/refunds/${r._id}` as Href)}>
                <Card style={styles.row}>
                  <Text style={styles.rowTitle}>Order …{r.orderId.slice(-6)}</Text>
                  <Text style={styles.rowMeta}>
                    {formatRefundStatus(r.status)} · ₱{r.requestedAmount}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )
      ) : null}
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  sub: { ...typography.bodySm, marginBottom: spacing.lg },
  list: { gap: spacing.sm },
  row: { gap: spacing.xs },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  rowMeta: { ...typography.bodySm, textTransform: 'capitalize' },
  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { ...typography.bodySm, color: colors.muted },
});
