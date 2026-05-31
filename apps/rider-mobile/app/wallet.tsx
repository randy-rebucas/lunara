import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  formatCurrency,
  RIDER_MIN_WITHDRAWAL,
  type RiderPayoutMethod,
} from '@lunara/utils';
import { DataLoadState } from '../src/components/data-load-state';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { Input } from '../src/components/ui/input';
import { Screen } from '../src/components/ui/screen';
import { SectionHeader } from '../src/components/ui/section-header';
import { riderFetch } from '../src/api';
import type { PayoutMethodData, WalletData, WithdrawalRequest } from '../src/lib/rider-types';
import { colors, radius, spacing, typography } from '../src/theme';

const MIN_WITHDRAWAL = typeof RIDER_MIN_WITHDRAWAL === 'number' ? RIDER_MIN_WITHDRAWAL : 100;

const PAYOUT_OPTIONS: { id: RiderPayoutMethod; label: string }[] = [
  { id: 'gcash', label: 'GCash' },
  { id: 'maya', label: 'Maya' },
  { id: 'bank', label: 'Bank Transfer' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusColor(status: WithdrawalRequest['status']) {
  switch (status) {
    case 'paid':
      return colors.accent;
    case 'pending':
      return colors.warning;
    case 'rejected':
      return colors.destructive;
    default:
      return colors.primary;
  }
}

export default function WalletScreen() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const [method, setMethod] = useState<RiderPayoutMethod>('gcash');
  const [gcashNumber, setGcashNumber] = useState('');
  const [mayaNumber, setMayaNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [walletData, withdrawalData] = await Promise.all([
        riderFetch<WalletData>('/riders/wallet'),
        riderFetch<WithdrawalRequest[]>('/riders/wallet/withdrawals'),
      ]);
      setWallet(walletData);
      setWithdrawals(withdrawalData);

      const payout = walletData.payoutMethod;
      if (payout.method) {
        setMethod(payout.method);
        setGcashNumber(payout.gcashNumber ?? '');
        setMayaNumber(payout.mayaNumber ?? '');
        setBankName(payout.bankName ?? '');
        setBankAccountName(payout.bankAccountName ?? '');
        setBankAccountNumber(payout.bankAccountNumber ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

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

  async function savePayoutMethod() {
    setSavingPayout(true);
    try {
      const body: Record<string, string> = { method };
      if (method === 'gcash') body.gcashNumber = gcashNumber;
      if (method === 'maya') body.mayaNumber = mayaNumber;
      if (method === 'bank') {
        body.bankName = bankName;
        body.bankAccountName = bankAccountName;
        body.bankAccountNumber = bankAccountNumber;
      }

      await riderFetch<PayoutMethodData>('/riders/payout-method', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      Alert.alert('Saved', 'Payout method updated.');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save payout method');
    } finally {
      setSavingPayout(false);
    }
  }

  async function requestWithdrawal() {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      Alert.alert('Invalid amount', `Minimum withdrawal is ${formatCurrency(MIN_WITHDRAWAL)}`);
      return;
    }

    setWithdrawing(true);
    try {
      await riderFetch('/riders/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      setWithdrawAmount('');
      Alert.alert('Submitted', 'Your withdrawal request is pending admin review.');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading && !wallet) {
    return (
      <Screen inStack>
        <DataLoadState loading error="" loadingMessage="Loading wallet…" />
      </Screen>
    );
  }

  const listHeader = (
    <>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <View style={styles.balanceGrid}>
        <Card elevated style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>
            {formatCurrency(wallet?.currentBalance ?? 0)}
          </Text>
        </Card>
        <Card elevated style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Pending Earnings</Text>
          <Text style={[styles.balanceValue, styles.pendingValue]}>
            {formatCurrency(wallet?.pendingEarnings ?? 0)}
          </Text>
        </Card>
        <Card accent style={[styles.balanceCard, styles.withdrawableCard]}>
          <Text style={styles.balanceLabel}>Withdrawable</Text>
          <Text style={styles.balanceValue}>
            {formatCurrency(wallet?.withdrawableBalance ?? 0)}
          </Text>
        </Card>
      </View>

      <SectionHeader title="Payout method" />
      <Card elevated style={styles.sectionCard}>
        <View style={styles.methodRow}>
          {PAYOUT_OPTIONS.map((option) => {
            const active = method === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setMethod(option.id)}
                style={[styles.methodChip, active && styles.methodChipActive]}
              >
                <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {method === 'gcash' ? (
          <Input
            style={styles.field}
            placeholder="GCash mobile (09XXXXXXXXX)"
            keyboardType="phone-pad"
            maxLength={11}
            value={gcashNumber}
            onChangeText={setGcashNumber}
          />
        ) : null}

        {method === 'maya' ? (
          <Input
            style={styles.field}
            placeholder="Maya mobile (09XXXXXXXXX)"
            keyboardType="phone-pad"
            maxLength={11}
            value={mayaNumber}
            onChangeText={setMayaNumber}
          />
        ) : null}

        {method === 'bank' ? (
          <>
            <Input
              style={styles.field}
              placeholder="Bank name"
              value={bankName}
              onChangeText={setBankName}
            />
            <Input
              style={styles.field}
              placeholder="Account name"
              value={bankAccountName}
              onChangeText={setBankAccountName}
            />
            <Input
              style={styles.field}
              placeholder="Account number"
              keyboardType="number-pad"
              value={bankAccountNumber}
              onChangeText={setBankAccountNumber}
            />
          </>
        ) : null}

        <Button
          label={savingPayout ? 'Saving…' : 'Save payout method'}
          disabled={savingPayout}
          onPress={savePayoutMethod}
          style={styles.action}
        />
      </Card>

      <SectionHeader title="Withdraw" />
      <Card elevated style={styles.sectionCard}>
        <Text style={styles.hint}>
          Minimum {formatCurrency(wallet?.minWithdrawal ?? MIN_WITHDRAWAL)} · Admin approval
          required
        </Text>
        <Input
          style={styles.field}
          placeholder="Amount to withdraw"
          keyboardType="decimal-pad"
          value={withdrawAmount}
          onChangeText={setWithdrawAmount}
        />
        <Button
          label={withdrawing ? 'Submitting…' : 'Request withdrawal'}
          variant="accent"
          disabled={withdrawing || !wallet?.payoutMethod.configured}
          onPress={requestWithdrawal}
          style={styles.action}
        />
      </Card>

      <SectionHeader title="Withdrawal requests" />
    </>
  );

  return (
    <Screen inStack padded={false}>
      <FlatList
        style={styles.list}
        data={withdrawals}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Card muted style={styles.emptyCard}>
            <Text style={styles.emptyText}>No withdrawal requests yet</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.withdrawalCard}>
            <View style={styles.withdrawalRow}>
              <View style={styles.withdrawalMain}>
                <Text style={styles.withdrawalAmount}>{formatCurrency(item.amount)}</Text>
                <Text style={styles.withdrawalMeta}>
                  {item.methodLabel} · {formatDate(item.createdAt)}
                </Text>
                {item.adminNote ? (
                  <Text style={styles.withdrawalNote}>{item.adminNote}</Text>
                ) : null}
              </View>
              <Text style={[styles.withdrawalStatus, { color: statusColor(item.status) }]}>
                {item.statusLabel}
              </Text>
            </View>
          </Card>
        )}
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  error: {
    marginBottom: spacing.md,
    color: colors.destructive,
    fontWeight: '600',
  },
  balanceGrid: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  balanceCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  withdrawableCard: {
    borderWidth: 0,
  },
  balanceLabel: { ...typography.label },
  balanceValue: {
    marginTop: spacing.sm,
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  pendingValue: { color: colors.warning },
  sectionCard: { marginBottom: spacing.lg, gap: spacing.sm },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  methodChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  methodChipText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  methodChipTextActive: { color: colors.primaryDark },
  field: { marginTop: spacing.sm },
  action: { marginTop: spacing.md },
  hint: { ...typography.bodySm, color: colors.mutedForeground },
  withdrawalCard: { paddingVertical: spacing.md },
  withdrawalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  withdrawalMain: { flex: 1 },
  withdrawalAmount: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  withdrawalMeta: { ...typography.caption, marginTop: spacing.xs },
  withdrawalNote: { ...typography.bodySm, marginTop: spacing.xs, color: colors.mutedForeground },
  withdrawalStatus: { fontSize: 12, fontWeight: '700' },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { ...typography.bodySm },
});
