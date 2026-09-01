import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  formatCurrency,
  RIDER_MIN_WITHDRAWAL,
  type RiderPayoutMethod,
} from '@lunara/utils';
import { DataLoadState } from '../src/components/data-load-state';
import { Input } from '../src/components/ui/input';
import { Screen } from '../src/components/ui/screen';
import { riderFetch, riderUpload } from '../src/api';
import type { CashSummaryData, PayoutMethodData, WalletData, WithdrawalRequest } from '../src/lib/rider-types';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const MIN_WITHDRAWAL = typeof RIDER_MIN_WITHDRAWAL === 'number' ? RIDER_MIN_WITHDRAWAL : 100;

const PAYOUT_OPTIONS: { id: RiderPayoutMethod; label: string; icon: IoniconName }[] = [
  { id: 'gcash', label: 'GCash', icon: 'phone-portrait-outline' },
  { id: 'maya', label: 'Maya', icon: 'wallet-outline' },
  { id: 'bank', label: 'Bank Transfer', icon: 'business-outline' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── Balance card ──────────────────────────────────────────────────────────────

function BalanceCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  valueColor,
}: {
  label: string;
  value: number;
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}) {
  return (
    <View style={balStyles.card}>
      <View style={[balStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={balStyles.label}>{label}</Text>
      <Text style={[balStyles.value, { color: valueColor }]}>{formatCurrency(value)}</Text>
    </View>
  );
}

const balStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  label: { ...typography.label },
  value: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});

// ── Section block ─────────────────────────────────────────────────────────────

function SectionBlock({
  icon,
  iconBg,
  iconColor,
  title,
  children,
}: {
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sectionStyles.wrap}>
      <View style={sectionStyles.header}>
        <View style={[sectionStyles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={15} color={iconColor} />
        </View>
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      <View style={sectionStyles.card}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
});

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status, label }: { status: WithdrawalRequest['status']; label: string }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    paid: { bg: colors.accentLight, text: colors.accentDark },
    approved: { bg: colors.accentLight, text: colors.accentDark },
    pending: { bg: colors.warningBg, text: colors.warning },
    rejected: { bg: '#FEF2F2', text: colors.destructive },
    processing: { bg: colors.primaryLight, text: colors.primary },
  };
  const { bg, text } = cfg[status] ?? { bg: colors.surfaceMuted, text: colors.mutedForeground };
  return (
    <View style={[pillStyles.pill, { backgroundColor: bg }]}>
      <Text style={[pillStyles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
});

// ── Wallet screen ─────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [cashSummary, setCashSummary] = useState<CashSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [submittingRemittance, setSubmittingRemittance] = useState(false);
  const [proofImageUri, setProofImageUri] = useState<string | null>(null);
  const [remittanceTransactionId, setRemittanceTransactionId] = useState('');
  const [remittanceMode, setRemittanceMode] = useState<'net_of_fee' | 'full_amount'>('net_of_fee');

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

    try {
      const cashData = await riderFetch<CashSummaryData>('/riders/cash-summary');
      setCashSummary(cashData);
    } catch (e) {
      // Keep any previously-loaded summary on screen (a refresh failure shouldn't make a rider who
      // still owes cash think they're clear) — only fall back to an empty state on the very first load.
      setCashSummary((prev) => prev ?? { pendingRemittance: { count: 0, totalCashCollected: 0, totalEarningOffset: 0, totalNetRemittance: 0, items: [] }, recentRemitted: [] });
      setError((prev) => prev || (e instanceof Error ? e.message : 'Could not load cash summary'));
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

  async function pickProofImage(source: 'camera' | 'library') {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Camera access is required to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Photo library access is required.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    }
    if (!result.canceled && result.assets[0]) {
      setProofImageUri(result.assets[0].uri);
    }
  }

  function showProofPicker() {
    Alert.alert('Attach proof', 'Choose a source', [
      { text: 'Take photo', onPress: () => void pickProofImage('camera') },
      { text: 'Choose from library', onPress: () => void pickProofImage('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function submitRemittance() {
    const modeMessage =
      remittanceMode === 'full_amount'
        ? 'You are handing over the FULL cash amount, including your fee — your fee will be paid out separately.'
        : 'You are keeping your fee and handing over the remaining net amount.';
    Alert.alert(
      'Confirm remittance',
      `This tells Lunara admin you have handed over the cash. ${modeMessage} Make sure you have already given the money before confirming.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "I've handed it over",
          onPress: async () => {
            if (!hasProof) {
              Alert.alert('Proof required', 'Please attach a reference number or receipt photo before submitting.');
              return;
            }
            setSubmittingRemittance(true);
            try {
              const formData = new FormData();
              if (proofImageUri) {
                const ext = proofImageUri.split('.').pop() ?? 'jpg';
                formData.append('proof', {
                  uri: proofImageUri,
                  name: `remittance-proof.${ext}`,
                  type: 'image/jpeg',
                } as unknown as Blob);
              }
              if (remittanceTransactionId.trim()) {
                formData.append('transactionId', remittanceTransactionId.trim());
              }
              formData.append('mode', remittanceMode);
              const res = await riderUpload<{ submittedCount: number; totalNetRemittance: number }>(
                '/riders/remit-cash',
                formData,
              );
              setProofImageUri(null);
              setRemittanceTransactionId('');
              setRemittanceMode('net_of_fee');
              Alert.alert(
                'Remittance submitted',
                `${res.submittedCount} order${res.submittedCount !== 1 ? 's' : ''} · ${formatCurrency(res.totalNetRemittance)} — waiting for admin confirmation.`,
              );
              await load();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not submit remittance');
            } finally {
              setSubmittingRemittance(false);
            }
          },
        },
      ],
    );
  }

  async function requestWithdrawal() {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      Alert.alert('Invalid amount', `Minimum withdrawal is ${formatCurrency(MIN_WITHDRAWAL)}`);
      return;
    }
    Alert.alert(
      'Confirm withdrawal',
      `Withdraw ${formatCurrency(amount)} to your ${PAYOUT_OPTIONS.find((o) => o.id === method)?.label ?? 'payout method'} on file?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async () => {
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
          },
        },
      ],
    );
  }

  const hasProof = proofImageUri !== null || remittanceTransactionId.trim().length > 0;

  const renderWithdrawalItem = useCallback(({ item, index }: { item: WithdrawalRequest; index: number }) => (
    <View style={[styles.withdrawalCard, index === 0 && styles.withdrawalCardFirst]}>
      {index > 0 ? <View style={styles.rowDivider} /> : null}
      <View style={styles.withdrawalRow}>
        <View style={styles.withdrawalLeft}>
          <Text style={styles.withdrawalAmount}>{formatCurrency(item.amount)}</Text>
          <Text style={styles.withdrawalMeta}>
            {item.methodLabel} · {formatDate(item.createdAt)}
          </Text>
          {item.adminNote ? (
            <Text style={styles.withdrawalNote}>{item.adminNote}</Text>
          ) : null}
        </View>
        <StatusPill status={item.status} label={item.statusLabel} />
      </View>
    </View>
  ), []);
  const pendingItems = cashSummary?.pendingRemittance.items.filter((i) => i.status === 'pending') ?? [];

  if (loading && !wallet) {
    return (
      <Screen inStack>
        <DataLoadState loading error="" loadingMessage="Loading wallet…" />
      </Screen>
    );
  }

  const listHeader = (
    <>
      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Wallet</Text>
        <Text style={styles.pageSubtitle}>Manage your balance, payouts, and cash remittance.</Text>
      </View>

      {/* ── Error banner ── */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ── Balance row ── */}
      <Text style={styles.sectionLabel}>BALANCE</Text>
      <View style={styles.balanceRow}>
        <BalanceCard
          label="CURRENT"
          value={wallet?.currentBalance ?? 0}
          icon="wallet-outline"
          iconBg={colors.primaryLight}
          iconColor={colors.primary}
          valueColor={colors.primary}
        />
        <BalanceCard
          label="PENDING"
          value={wallet?.pendingEarnings ?? 0}
          icon="time-outline"
          iconBg={colors.warningBg}
          iconColor={colors.warning}
          valueColor={colors.warning}
        />
        <BalanceCard
          label="WITHDRAWABLE"
          value={wallet?.withdrawableBalance ?? 0}
          icon="arrow-up-circle-outline"
          iconBg={colors.accentLight}
          iconColor={colors.accentDark}
          valueColor={colors.accentDark}
        />
      </View>

      {/* ── Payout method ── */}
      <SectionBlock
        icon="card-outline"
        iconBg={colors.primaryLight}
        iconColor={colors.primary}
        title="Payout method"
      >
        <View style={styles.methodRow}>
          {PAYOUT_OPTIONS.map((opt) => {
            const active = method === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setMethod(opt.id)}
                style={[styles.methodChip, active && styles.methodChipActive]}
              >
                <Ionicons
                  name={opt.icon}
                  size={14}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {method === 'gcash' ? (
          <Input
            placeholder="GCash mobile (09XXXXXXXXX)"
            keyboardType="phone-pad"
            maxLength={11}
            value={gcashNumber}
            onChangeText={setGcashNumber}
          />
        ) : null}
        {method === 'maya' ? (
          <Input
            placeholder="Maya mobile (09XXXXXXXXX)"
            keyboardType="phone-pad"
            maxLength={11}
            value={mayaNumber}
            onChangeText={setMayaNumber}
          />
        ) : null}
        {method === 'bank' ? (
          <>
            <Input placeholder="Bank name" value={bankName} onChangeText={setBankName} />
            <Input placeholder="Account name" value={bankAccountName} onChangeText={setBankAccountName} />
            <Input placeholder="Account number" keyboardType="number-pad" value={bankAccountNumber} onChangeText={setBankAccountNumber} />
          </>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            savingPayout && styles.btnDisabled,
            pressed && !savingPayout && styles.btnPressed,
          ]}
          onPress={savePayoutMethod}
          disabled={savingPayout}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={styles.saveBtnText}>{savingPayout ? 'Saving…' : 'Save payout method'}</Text>
        </Pressable>
      </SectionBlock>

      {/* ── Cash to remit ── */}
      <SectionBlock
        icon="cash-outline"
        iconBg={colors.accentLight}
        iconColor={colors.accentDark}
        title="Cash to remit"
      >
        {!cashSummary ? (
          <Text style={styles.hint}>Loading…</Text>
        ) : cashSummary.pendingRemittance.count === 0 ? (
          <View style={styles.emptyRow}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.accentDark} />
            <Text style={styles.hint}>No pending cash to remit.</Text>
          </View>
        ) : (
          <>
            {/* Summary row */}
            <View style={styles.remitSummaryRow}>
              <View style={styles.remitSummaryCol}>
                <Text style={styles.remitLabel}>COLLECTED</Text>
                <Text style={styles.remitValue}>{formatCurrency(cashSummary.pendingRemittance.totalCashCollected)}</Text>
              </View>
              <View style={styles.remitDivider} />
              <View style={styles.remitSummaryCol}>
                <Text style={styles.remitLabel}>YOUR FEE</Text>
                <Text style={[styles.remitValue, { color: colors.warning }]}>− {formatCurrency(cashSummary.pendingRemittance.totalEarningOffset)}</Text>
              </View>
              <View style={styles.remitDivider} />
              <View style={styles.remitSummaryCol}>
                <Text style={styles.remitLabel}>HAND OVER</Text>
                <Text style={[styles.remitValue, { color: colors.accentDark }]}>
                  {formatCurrency(
                    remittanceMode === 'full_amount'
                      ? cashSummary.pendingRemittance.totalCashCollected
                      : cashSummary.pendingRemittance.totalNetRemittance,
                  )}
                </Text>
              </View>
            </View>

            {/* Remittance mode picker */}
            {pendingItems.length > 0 ? (
              <>
                <Text style={styles.proofLabel}>HOW ARE YOU REMITTING?</Text>
                <View style={styles.modeToggleRow}>
                  <Pressable
                    style={[styles.modeOption, remittanceMode === 'net_of_fee' && styles.modeOptionActive]}
                    onPress={() => setRemittanceMode('net_of_fee')}
                  >
                    <Text style={[styles.modeOptionTitle, remittanceMode === 'net_of_fee' && styles.modeOptionTitleActive]}>
                      I'm keeping my fee
                    </Text>
                    <Text style={styles.modeOptionSub}>
                      Hand over {formatCurrency(cashSummary.pendingRemittance.totalNetRemittance)} now
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modeOption, remittanceMode === 'full_amount' && styles.modeOptionActive]}
                    onPress={() => setRemittanceMode('full_amount')}
                  >
                    <Text style={[styles.modeOptionTitle, remittanceMode === 'full_amount' && styles.modeOptionTitleActive]}>
                      I'm remitting everything
                    </Text>
                    <Text style={styles.modeOptionSub}>
                      Hand over {formatCurrency(cashSummary.pendingRemittance.totalCashCollected)} · get fee at settlement
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {/* Item rows */}
            {cashSummary.pendingRemittance.items.map((item) => (
              <View key={item._id} style={styles.remitItemRow}>
                <View style={styles.remitItemLeft}>
                  <Ionicons
                    name={item.stage === 'pickup' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                    size={14}
                    color={item.stage === 'pickup' ? colors.primary : colors.accentDark}
                  />
                  <Text style={styles.remitItemStage}>{item.stage === 'pickup' ? 'Pickup' : 'Delivery'}</Text>
                  <Text style={styles.remitItemOrder}>#{item.orderId.slice(-6).toUpperCase()}</Text>
                </View>
                <View style={styles.remitItemRight}>
                  <Text style={styles.remitItemAmount}>{formatCurrency(item.netRemittance)}</Text>
                  {item.status === 'submitted' ? (
                    <View style={styles.submittedPill}>
                      <Text style={styles.submittedText}>Submitted</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}

            {/* Proof + submit */}
            {pendingItems.length > 0 ? (
              <>
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
                  <Text style={styles.infoText}>Hand the net amount to a Lunara admin in person, then submit below.</Text>
                </View>

                <Text style={styles.proofLabel}>PROOF OF REMITTANCE</Text>
                <Text style={styles.hint}>Attach a GCash/Maya reference no. or a receipt photo — at least one is required.</Text>

                <TextInput
                  style={styles.proofInput}
                  placeholder="GCash / Maya reference no."
                  placeholderTextColor={colors.mutedForeground}
                  value={remittanceTransactionId}
                  onChangeText={setRemittanceTransactionId}
                  autoCapitalize="none"
                />

                {proofImageUri ? (
                  <View style={styles.proofThumbRow}>
                    <Image source={{ uri: proofImageUri }} style={styles.proofThumb} />
                    <Pressable onPress={() => setProofImageUri(null)} hitSlop={8}>
                      <Text style={styles.proofClearText}>Remove photo</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={showProofPicker} style={styles.proofPickerBtn}>
                    <Ionicons name="attach-outline" size={16} color={colors.primary} />
                    <Text style={styles.proofPickerText}>Attach receipt photo</Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.remitBtn,
                    (!hasProof || submittingRemittance) && styles.btnDisabled,
                    pressed && hasProof && !submittingRemittance && styles.btnPressed,
                  ]}
                  onPress={submitRemittance}
                  disabled={submittingRemittance || !hasProof}
                >
                  <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
                  <Text style={styles.remitBtnText}>
                    {submittingRemittance ? 'Submitting…' : "I've handed over the cash"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.infoBox}>
                <Ionicons name="hourglass-outline" size={14} color={colors.warning} />
                <Text style={[styles.infoText, { color: colors.warning }]}>All submitted — waiting for admin confirmation.</Text>
              </View>
            )}
          </>
        )}
      </SectionBlock>

      {/* ── Recent remitted ── */}
      {cashSummary && cashSummary.recentRemitted.length > 0 ? (
        <SectionBlock
          icon="receipt-outline"
          iconBg={colors.secondaryLight}
          iconColor={colors.secondaryDark}
          title="Recent remitted"
        >
          {cashSummary.recentRemitted.slice(0, 5).map((item, i) => (
            <View key={item._id}>
              {i > 0 ? <View style={styles.rowDivider} /> : null}
              <View style={styles.withdrawalRow}>
                <View style={styles.withdrawalLeft}>
                  <Text style={styles.withdrawalAmount}>{formatCurrency(item.netRemittance)}</Text>
                  <Text style={styles.withdrawalMeta}>
                    {item.stage === 'pickup' ? 'Pickup' : 'Delivery'} · #{item.orderId.slice(-6).toUpperCase()} · {item.remittedAt ? formatDate(item.remittedAt) : '—'}
                  </Text>
                </View>
                <View style={[pillStyles.pill, { backgroundColor: colors.accentLight }]}>
                  <Text style={[pillStyles.text, { color: colors.accentDark }]}>Remitted</Text>
                </View>
              </View>
            </View>
          ))}
        </SectionBlock>
      ) : null}

      {/* ── Withdraw ── */}
      <SectionBlock
        icon="arrow-up-circle-outline"
        iconBg={colors.warningBg}
        iconColor={colors.warning}
        title="Request withdrawal"
      >
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
          <Text style={styles.infoText}>
            Minimum {formatCurrency(wallet?.minWithdrawal ?? MIN_WITHDRAWAL)} · Admin approval required
          </Text>
        </View>
        {!wallet?.payoutMethod.configured ? (
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
            <Text style={[styles.infoText, { color: colors.warning }]}>Set a payout method above before withdrawing.</Text>
          </View>
        ) : null}
        <Input
          placeholder="Amount to withdraw"
          keyboardType="decimal-pad"
          value={withdrawAmount}
          onChangeText={setWithdrawAmount}
        />
        <Pressable
          style={({ pressed }) => [
            styles.withdrawBtn,
            (withdrawing || !wallet?.payoutMethod.configured) && styles.btnDisabled,
            pressed && wallet?.payoutMethod.configured && !withdrawing && styles.btnPressed,
          ]}
          onPress={requestWithdrawal}
          disabled={withdrawing || !wallet?.payoutMethod.configured}
        >
          <Ionicons name="arrow-up-circle-outline" size={16} color="#fff" />
          <Text style={styles.withdrawBtnText}>{withdrawing ? 'Submitting…' : 'Request withdrawal'}</Text>
        </Pressable>
      </SectionBlock>

      {/* ── Withdrawal requests header ── */}
      <Text style={styles.sectionLabel}>WITHDRAWAL REQUESTS</Text>
    </>
  );

  return (
    <Screen inStack>
      <FlatList
        style={styles.list}
        data={withdrawals}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-outline" size={24} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No withdrawal requests yet</Text>
            <Text style={styles.hint}>Requests you submit will appear here.</Text>
          </View>
        }
        renderItem={renderWithdrawalItem}
        ListFooterComponent={<View style={{ height: spacing.xxxl }} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },

  pageHeader: { marginBottom: spacing.xl },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  pageSubtitle: { ...typography.bodySm, marginTop: spacing.xs },

  sectionLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.destructive,
  },

  balanceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },

  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  methodChipActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  methodChipText: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  methodChipTextActive: { color: colors.primary },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    marginTop: spacing.xs,
    ...shadow.card,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  remitSummaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  remitSummaryCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
  remitDivider: { width: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  remitLabel: { ...typography.label },
  remitValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.2,
  },

  remitItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  remitItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  remitItemStage: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  remitItemOrder: { ...typography.caption, flex: 1 },
  remitItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  remitItemAmount: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  submittedPill: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  submittedText: { fontSize: 10, fontWeight: '700', color: colors.warning, letterSpacing: 0.3 },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
    lineHeight: 18,
  },

  proofLabel: { ...typography.label },
  hint: { ...typography.bodySm },
  modeToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  modeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  modeOptionTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  modeOptionTitleActive: { color: colors.primary },
  modeOptionSub: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  proofInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  proofPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.lg,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryLight,
  },
  proofPickerText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  proofThumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  proofThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  proofClearText: { fontSize: 13, fontWeight: '600', color: colors.destructive },

  remitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    marginTop: spacing.xs,
    ...shadow.card,
  },
  remitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warning,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    ...shadow.card,
  },
  withdrawBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },

  rowDivider: { height: 1, backgroundColor: colors.border },

  withdrawalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  withdrawalCardFirst: {},
  withdrawalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  withdrawalLeft: { flex: 1, gap: spacing.xs },
  withdrawalAmount: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  withdrawalMeta: { ...typography.caption },
  withdrawalNote: { ...typography.bodySm, color: colors.mutedForeground },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
