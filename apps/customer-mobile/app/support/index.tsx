import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/ui/card';
import { DataLoadState } from '../../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../src/store/auth';
import { colors, spacing, typography } from '../../src/theme';

interface Ticket {
  _id: string;
  subject: string;
  status: string;
  type: string;
  updatedAt?: string;
}

export default function SupportListScreen() {
  const router = useRouter();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiFetch<Ticket[]>('/support/tickets');
      setTickets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tickets');
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
      <Text style={styles.sub}>Track complaints including lost-item reports.</Text>

      <DataLoadState
        loading={loading}
        error={error}
        loadingMessage="Loading tickets…"
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />

      {!loading && !error ? (
        tickets.length === 0 ? (
          <Card muted style={styles.empty}>
            <Text style={styles.emptyText}>
              No tickets yet. Report a missing item from a completed order.
            </Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {tickets.map((t) => (
              <Pressable key={t._id} onPress={() => router.push(`/support/${t._id}` as Href)}>
                <Card style={styles.row}>
                  <Text style={styles.rowTitle}>{t.subject}</Text>
                  <Text style={styles.rowMeta}>
                    {t.type.replace(/_/g, ' ')} · {t.status.replace(/_/g, ' ')}
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
  emptyText: { ...typography.bodySm, color: colors.muted, textAlign: 'center' },
});
