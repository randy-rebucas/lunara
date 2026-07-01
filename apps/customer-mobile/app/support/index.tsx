import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/ui/card';
import { DataLoadState } from '../../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../src/store/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

const RESOLVED_STATUSES = new Set(['resolved', 'closed']);

function ticketIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'lost_item') return 'help-buoy-outline';
  return 'chatbubble-ellipses-outline';
}

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
            <View style={styles.emptyIcon}>
              <Ionicons name="help-buoy-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.emptyText}>
              No tickets yet. Report a missing item from a completed order.
            </Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {tickets.map((t) => {
              const resolved = RESOLVED_STATUSES.has(t.status);
              return (
                <Pressable
                  key={t._id}
                  onPress={() => router.push(`/support/${t._id}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.subject}, ${t.status.replace(/_/g, ' ')}`}
                  style={({ pressed }) => pressed && styles.rowPressed}
                >
                  <Card style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Ionicons name={ticketIcon(t.type)} size={20} color={colors.primary} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{t.subject}</Text>
                      <Text style={styles.rowType}>{t.type.replace(/_/g, ' ')}</Text>
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
                          {t.status.replace(/_/g, ' ')}
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
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
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
  rowType: { ...typography.caption, textTransform: 'capitalize' },
  rowRight: { alignItems: 'flex-end', gap: spacing.xs },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPillOpen: { backgroundColor: colors.primaryLight },
  statusPillResolved: { backgroundColor: colors.accentLight },
  statusPillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  empty: { padding: spacing.xl, alignItems: 'center', borderWidth: 0 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyText: { ...typography.bodySm, color: colors.muted, textAlign: 'center' },
});
