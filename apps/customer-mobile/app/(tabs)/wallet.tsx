import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { formatCurrency } from '@lunara/utils';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { colors, spacing, typography } from '../../src/theme';
import { DataLoadState } from '../../src/components/data-load-state';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { useAuthStore } from '../../src/store/auth';

interface WalletTransaction {
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
}

function formatTransactionDate(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function WalletScreen() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const tabPadding = useTabScreenPadding();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [wallet, txns] = await Promise.all([
        apiFetch<{ balance: number }>('/wallets/me'),
        apiFetch<WalletTransaction[]>('/wallets/me/transactions'),
      ]);
      setBalance(wallet.balance);
      setTransactions(txns);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load wallet');
      setTransactions([]);
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

  async function topUp() {
    setTopUpLoading(true);
    try {
      const data = await apiFetch<{ balance: number }>('/wallets/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: 500 }),
      });
      setBalance(data.balance);
      await load();
      Alert.alert('Wallet topped up', formatCurrency(500));
    } catch (e) {
      Alert.alert('Top up failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setTopUpLoading(false);
    }
  }

  const listHeader = (
    <>
      <DataLoadState
        loading={loading && !refreshing}
        error={error}
        loadingMessage="Loading wallet…"
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />

      {!loading && !error ? (
        <Card elevated style={styles.balanceCard}>
          <Text style={styles.label}>Available balance</Text>
          <Text style={styles.balance}>{formatCurrency(balance)}</Text>
          <Text style={styles.hint}>Use your Lunara wallet to pay for laundry orders</Text>
          <Button
            label={topUpLoading ? 'Processing…' : 'Top up ₱500'}
            variant="accent"
            onPress={topUp}
            disabled={topUpLoading}
            style={styles.topUpBtn}
          />
        </Card>
      ) : null}

      {!loading && !error ? (
        <Text style={styles.sectionTitle}>Top-up history</Text>
      ) : null}
    </>
  );

  return (
    <Screen inTab padded={false}>
      <FlatList
        data={loading || error ? [] : transactions}
        keyExtractor={(item, index) => `${item.createdAt}-${index}`}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabPadding }]}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Card muted style={styles.emptyCard}>
              <Text style={styles.emptyText}>No top-ups yet</Text>
              <Text style={styles.emptyHint}>Your wallet transactions will appear here</Text>
            </Card>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.txCard}>
            <View style={styles.txRow}>
              <View style={styles.txMain}>
                <Text style={styles.txDescription}>{item.description}</Text>
                <Text style={styles.txDate}>{formatTransactionDate(item.createdAt)}</Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  item.type === 'credit' ? styles.txCredit : styles.txDebit,
                ]}
              >
                {item.type === 'credit' ? '+' : '-'}
                {formatCurrency(item.amount)}
              </Text>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  balanceCard: {
    alignItems: 'center',
    borderWidth: 0,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },
  label: { ...typography.label, marginBottom: spacing.sm },
  balance: { fontSize: 40, fontWeight: '700', color: colors.primary, letterSpacing: -0.5 },
  hint: { ...typography.caption, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xxl },
  topUpBtn: { width: '100%' },
  sectionTitle: { ...typography.subheading, marginBottom: spacing.sm },
  txCard: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  txMain: { flex: 1 },
  txDescription: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  txDate: { ...typography.caption, marginTop: spacing.xs },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txCredit: { color: colors.accent },
  txDebit: { color: colors.destructive },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { ...typography.body, fontWeight: '600' },
  emptyHint: { ...typography.caption, marginTop: spacing.xs, textAlign: 'center' },
});
