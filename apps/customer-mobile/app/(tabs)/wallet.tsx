import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PaymentMethod } from '@lunara/types';
import { CUSTOMER_PAYMENT_OPTIONS, formatCurrency } from '@lunara/utils';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { colors, radius, spacing, typography } from '../../src/theme';
import { DataLoadState } from '../../src/components/data-load-state';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { useAuthStore } from '../../src/store/auth';
import { getCustomerClientOrigin } from '../../src/lib/client-origin';

const TOP_UP_AMOUNT = 500;
const PAYMONGO_OPTIONS = CUSTOMER_PAYMENT_OPTIONS.filter((o) => o.channel === 'paymongo');

const METHOD_ICONS: Partial<Record<PaymentMethod, keyof typeof Ionicons.glyphMap>> = {
  [PaymentMethod.GCASH]: 'phone-portrait-outline',
  [PaymentMethod.MAYA]: 'wallet-outline',
  [PaymentMethod.STRIPE]: 'card-outline',
};

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
  const [topUpMethod, setTopUpMethod] = useState<PaymentMethod>(PaymentMethod.GCASH);
  const pendingTopupIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const wallet = await apiFetch<{ balance: number }>('/wallets/me');
      setBalance(wallet.balance ?? 0);
      const txns = await apiFetch<WalletTransaction[]>('/wallets/me/transactions');
      setTransactions(Array.isArray(txns) ? txns : []);
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

  // If the customer left a pending top-up's PayMongo checkout in the browser, nudge a sync as
  // soon as they return to the app instead of relying entirely on a manual pull-to-refresh —
  // mirrors the pending-payment sync `PaymentCheckout` already does on its own load().
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !pendingTopupIdRef.current) return;
      const paymentId = pendingTopupIdRef.current;
      pendingTopupIdRef.current = null;
      apiFetch<{ status: string }>(`/payments/${paymentId}/sync`, { method: 'POST' })
        .then((synced) => {
          void load();
          if (synced.status === 'paid') {
            Alert.alert('Top-up confirmed', 'Your wallet balance has been updated.');
          } else if (synced.status === 'failed') {
            Alert.alert('Payment did not go through', 'No funds were added — please try again.');
          }
        })
        .catch(() => void load());
    });
    return () => sub.remove();
  }, [apiFetch, load]);

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
      const data = await apiFetch<{ checkoutUrl?: string; payment?: { _id: string } }>(
        '/payments/wallet-topup/intent',
        {
          method: 'POST',
          body: JSON.stringify({
            amount: TOP_UP_AMOUNT,
            method: topUpMethod,
            clientOrigin: getCustomerClientOrigin(),
          }),
        },
      );

      if (data.checkoutUrl) {
        pendingTopupIdRef.current = data.payment?._id ?? null;
        await Linking.openURL(data.checkoutUrl);
        Alert.alert(
          'Complete top-up',
          'Finish payment in your browser, then return here — we’ll check your balance automatically.',
        );
        return;
      }

      Alert.alert('Top up failed', 'Could not start PayMongo checkout');
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
          void load();
        }}
      />

      {!loading && !error ? (
        <Card elevated style={styles.balanceCard}>
          <View style={styles.balanceGlowPrimary} />
          <View style={styles.balanceGlowSecondary} />
          <View style={styles.balanceRow}>
            <View style={styles.balanceTextCol}>
              <View style={styles.balanceLabelRow}>
                <Text style={styles.label}>Available Balance</Text>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color="rgba(255,255,255,0.9)"
                  accessible={false}
                />
              </View>
              <Text style={styles.balance} accessibilityRole="text">
                {formatCurrency(balance)}
              </Text>
              <Text style={styles.hint}>Use your wallet for fast and secure laundry payments.</Text>
            </View>
            <View style={styles.walletIllustration}>
              <Ionicons name="wallet" size={36} color={colors.surface} />
            </View>
          </View>
        </Card>
      ) : null}

      {!loading && !error ? (
        <Card style={styles.topUpCard}>
          <Text style={styles.topUpLabel}>TOP UP VIA</Text>
          <View style={styles.methodRow}>
            {PAYMONGO_OPTIONS.map((opt, index) => {
              const selected = topUpMethod === opt.method;
              return (
                <Pressable
                  key={opt.method}
                  onPress={() => setTopUpMethod(opt.method)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Top up via ${opt.label}${index === 0 ? ', recommended' : ''}`}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.methodTile,
                    selected && styles.methodTileSelected,
                    pressed && styles.methodTilePressed,
                  ]}
                >
                  {index === 0 ? (
                    <View style={styles.recommendedBadge}>
                      <Ionicons name="checkmark" size={11} color={colors.onPrimary} />
                    </View>
                  ) : null}
                  <View style={styles.methodIcon}>
                    <Ionicons
                      name={METHOD_ICONS[opt.method] ?? 'card-outline'}
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.methodLabel}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={topUp}
            disabled={topUpLoading}
            accessibilityRole="button"
            accessibilityLabel={`Top up ${formatCurrency(TOP_UP_AMOUNT)}`}
            accessibilityState={{ disabled: topUpLoading, busy: topUpLoading }}
            style={({ pressed }) => [
              styles.topUpBtn,
              topUpLoading && styles.topUpBtnDisabled,
              pressed && !topUpLoading && styles.topUpBtnPressed,
            ]}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.onPrimary} />
            <Text style={styles.topUpBtnText}>
              {topUpLoading ? 'Processing…' : `Top up ${formatCurrency(TOP_UP_AMOUNT)}`}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onPrimary} />
          </Pressable>
        </Card>
      ) : null}

      {!loading && !error ? (
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Transaction history</Text>
        </View>
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
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptyHint}>Top-ups and order payments will appear here</Text>
            </Card>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.txCard}>
            <View style={styles.txRow}>
              <View
                style={[
                  styles.txIcon,
                  { backgroundColor: item.type === 'credit' ? colors.accentLight : colors.primaryLight },
                ]}
              >
                <Ionicons
                  name={item.type === 'credit' ? 'arrow-down' : 'bag-outline'}
                  size={16}
                  color={item.type === 'credit' ? colors.accentDark : colors.primary}
                />
              </View>
              <View style={styles.txMain}>
                <Text style={styles.txDescription}>{item.description}</Text>
                <Text style={styles.txDate}>{formatTransactionDate(item.createdAt)}</Text>
              </View>
              <View style={styles.txAmountCol}>
                <Text
                  style={[
                    styles.txAmount,
                    item.type === 'credit' ? styles.txCredit : styles.txDebit,
                  ]}
                >
                  {item.type === 'credit' ? '+' : '-'}
                  {formatCurrency(item.amount)}
                </Text>
                <Text style={styles.txStatus}>{item.type === 'credit' ? 'Successful' : 'Completed'}</Text>
              </View>
            </View>
          </Card>
        )}
        ListFooterComponent={
          !loading && !error ? (
            <Card
              style={styles.secureCard}
              accessible
              accessibilityRole="text"
              accessibilityLabel="Your payments are 100% secure. We never store your card details."
            >
              <View style={styles.secureIcon}>
                <Ionicons name="shield-checkmark" size={18} color={colors.onPrimary} />
              </View>
              <View style={styles.secureTextCol}>
                <Text style={styles.secureTitle}>Your payments are 100% secure.</Text>
                <Text style={styles.secureHint}>We never store your card details.</Text>
              </View>
            </Card>
          ) : null
        }
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
    borderRadius: radius.xxl,
    borderWidth: 0,
    backgroundColor: colors.primary,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  balanceGlowPrimary: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -110,
    right: -50,
  },
  balanceGlowSecondary: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(67, 56, 202, 0.35)',
    bottom: -90,
    left: -60,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  balanceTextCol: { flex: 1, paddingRight: spacing.md },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...typography.label, color: 'rgba(255,255,255,0.97)' },
  balance: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: -0.5,
    marginTop: spacing.sm,
  },
  hint: { ...typography.caption, color: 'rgba(255,255,255,0.97)', marginTop: spacing.md },
  walletIllustration: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUpCard: { borderWidth: 0, marginBottom: spacing.lg },
  topUpLabel: { ...typography.label, marginBottom: spacing.md },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  methodTile: {
    flex: 1,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  methodTileSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.primaryLight,
  },
  methodTilePressed: {
    opacity: 0.85,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  methodLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
  },
  topUpBtnDisabled: { opacity: 0.6 },
  topUpBtnPressed: { opacity: 0.88 },
  topUpBtnText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.subheading },
  txCard: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMain: { flex: 1 },
  txDescription: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  txDate: { ...typography.caption, marginTop: spacing.xs },
  txAmountCol: { alignItems: 'flex-end' },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txStatus: { ...typography.caption, marginTop: spacing.xs },
  txCredit: { color: colors.accent },
  txDebit: { color: colors.primary },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl, borderWidth: 0 },
  emptyText: { ...typography.body, fontWeight: '600' },
  emptyHint: { ...typography.caption, marginTop: spacing.xs, textAlign: 'center' },
  secureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
  },
  secureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secureTextCol: { flex: 1 },
  secureTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  secureHint: { ...typography.caption, marginTop: 2 },
});
