import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/components/ui/card';
import { DataLoadState } from '../src/components/data-load-state';
import { Screen } from '../src/components/ui/screen';
import { useAuthStore } from '../src/store/auth';
import { colors, radius, spacing, typography } from '../src/theme';

const RESOLVED_STATUSES = new Set(['resolved', 'closed']);

interface RiderTicket {
  _id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  orderId?: string;
  createdAt?: string;
  updatedAt?: string;
}

function ticketIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'damaged_item') return 'alert-circle-outline';
  if (type === 'delivery_delay') return 'time-outline';
  return 'chatbubble-ellipses-outline';
}

export default function MyReportsScreen() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [tickets, setTickets] = useState<RiderTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiFetch<RiderTicket[]>('/support/rider-issues');
      setTickets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
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
    <Screen
      inStack
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.sub}>Issues you have reported to dispatch.</Text>

      <DataLoadState
        loading={loading}
        error={error}
        loadingMessage="Loading reports…"
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />

      {!loading && !error ? (
        tickets.length === 0 ? (
          <Card muted style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="clipboard-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.emptyText}>No reports yet.</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {tickets.map((t) => {
              const resolved = RESOLVED_STATUSES.has(t.status);
              return (
                <Card key={t._id} style={styles.row}>
                  <View style={styles.rowIcon}>
                    <Ionicons name={ticketIcon(t.type)} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{t.subject}</Text>
                    <Text style={styles.rowType}>{t.type.replace(/_/g, ' ')}</Text>
                  </View>
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
                </Card>
              );
            })}
          </View>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.bodySm, marginBottom: spacing.lg },
  list: { gap: spacing.sm },
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
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  rowType: { ...typography.caption, textTransform: 'capitalize' },
  statusPill: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
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
