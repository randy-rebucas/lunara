import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { DataLoadState } from '../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../src/store/auth';
import { colors, radius, spacing, typography } from '../src/theme';

interface RewardsCatalogItem {
  id: string;
  title: string;
  description?: string;
  points: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
}

interface RewardsTransaction {
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
}

interface PartnerBalance {
  partnerUserId: string;
  partnerName: string;
  balance: number;
  tier: string;
  nextTier: string | null;
  pointsToNextTier: number;
  currentTierMin: number;
}

interface RewardsSummary {
  referralBalance: number;
  partners: PartnerBalance[];
}

const TIER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Moon: 'moon',
  Star: 'star',
  Comet: 'sparkles',
  Galaxy: 'planet',
};

function formatDiscount(item: RewardsCatalogItem) {
  return item.discountType === 'percent' ? `${item.discountValue}% off` : `₱${item.discountValue} off`;
}

function formatTransactionDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ShopRewardsCard({
  shop,
  referralBalance,
  apiFetch,
  onRedeemed,
}: {
  shop: PartnerBalance;
  referralBalance: number;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onRedeemed: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [catalog, setCatalog] = useState<RewardsCatalogItem[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const available = shop.balance + referralBalance;
  const nextTierMin = shop.balance + shop.pointsToNextTier;
  const progress =
    shop.nextTier && nextTierMin > shop.currentTierMin
      ? Math.min(1, Math.max(0, (shop.balance - shop.currentTierMin) / (nextTierMin - shop.currentTierMin)))
      : 1;

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && !catalog) {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        const items = await apiFetch<RewardsCatalogItem[]>(`/rewards/catalog?partnerId=${shop.partnerUserId}`);
        setCatalog(Array.isArray(items) ? items : []);
      } catch (e) {
        setCatalogError(e instanceof Error ? e.message : 'Could not load this shop’s rewards');
      } finally {
        setCatalogLoading(false);
      }
    }
  }

  async function redeem(item: RewardsCatalogItem) {
    setRedeemingId(item.id);
    try {
      const result = await apiFetch<{ voucher: { code: string } }>('/rewards/redeem', {
        method: 'POST',
        body: JSON.stringify({ partnerId: shop.partnerUserId, catalogItemId: item.id }),
      });
      Alert.alert(
        'Reward redeemed!',
        `Use code ${result.voucher.code} at ${shop.partnerName} to get "${item.title}".`,
      );
      onRedeemed();
    } catch (e) {
      Alert.alert('Could not redeem', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setRedeemingId(null);
    }
  }

  return (
    <Card style={styles.shopCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View rewards at ${shop.partnerName}`}
        onPress={() => void toggleExpanded()}
        style={styles.shopHeaderRow}
      >
        <View style={styles.tierIcon}>
          <Ionicons name={TIER_ICONS[shop.tier] ?? 'star'} size={18} color={colors.primary} />
        </View>
        <View style={styles.shopTextCol}>
          <Text style={styles.shopName}>{shop.partnerName}</Text>
          <Text style={styles.shopSub}>
            {shop.balance} pts · {shop.tier} tier
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
      </Pressable>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {shop.nextTier ? `Earn ${shop.pointsToNextTier} more points to reach ${shop.nextTier} tier` : 'Highest tier here'}
      </Text>

      {expanded ? (
        <View style={styles.catalog}>
          {catalogLoading ? <Text style={styles.historyEmpty}>Loading rewards…</Text> : null}
          {catalogError ? <Text style={[styles.historyEmpty, { color: '#B91C1C' }]}>{catalogError}</Text> : null}
          {catalog && catalog.length === 0 ? (
            <Text style={styles.historyEmpty}>This shop hasn&apos;t added any rewards yet.</Text>
          ) : null}
          {catalog?.map((item) => {
            const canRedeem = available >= item.points;
            const toGo = item.points - available;
            return (
              <Card key={item.id} style={styles.rewardRow}>
                <View style={styles.rewardCopy}>
                  <Text style={styles.rewardTitle}>{item.title}</Text>
                  <Text style={styles.rewardPoints}>
                    {item.points} pts · {formatDiscount(item)}
                  </Text>
                  {item.description ? <Text style={styles.rewardDesc}>{item.description}</Text> : null}
                </View>
                <View style={styles.rewardStatusCol}>
                  {canRedeem ? (
                    <Button
                      label={redeemingId === item.id ? 'Redeeming…' : 'Redeem'}
                      variant="primary"
                      size="sm"
                      disabled={redeemingId !== null}
                      onPress={() => redeem(item)}
                    />
                  ) : (
                    <View style={styles.lockedPill}>
                      <Ionicons name="lock-closed" size={12} color={colors.mutedForeground} />
                      <Text style={styles.lockedText}>Locked</Text>
                    </View>
                  )}
                  {!canRedeem ? <Text style={styles.toGoText}>{toGo} pts to go</Text> : null}
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

export default function RewardsScreen() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [summary, setSummary] = useState<RewardsSummary | null>(null);
  const [transactions, setTransactions] = useState<RewardsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [summaryRes, txRes] = await Promise.all([
        apiFetch<RewardsSummary>('/rewards/me'),
        apiFetch<RewardsTransaction[]>('/rewards/me/transactions'),
      ]);
      setSummary(summaryRes);
      setTransactions(Array.isArray(txRes) ? txRes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch/update-on-mount, not a synchronous render loop
    load();
  }, [load]);

  const referralBalance = summary?.referralBalance ?? 0;
  const partners = summary?.partners ?? [];

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
    >
      <View style={styles.heroRow}>
        <View style={styles.heroTextCol}>
          <Text style={styles.heroTitle}>
            Get rewarded for{'\n'}
            <Text style={styles.heroTitleAccent}>doing laundry!</Text>{' '}
            <Ionicons name="sparkles" size={20} color={colors.star} />
          </Text>
          <Text style={styles.sub}>Each shop runs its own rewards — earn there, redeem there.</Text>
        </View>
        <View style={styles.heroIllustration}>
          <Ionicons name="gift" size={34} color={colors.onPrimary} />
        </View>
      </View>

      <DataLoadState loading={loading} error={error} loadingMessage="Loading rewards…" onRetry={load} />

      {!loading && summary ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View points history"
            onPress={() => setShowHistory((v) => !v)}
          >
            {({ pressed }) => (
              <Card style={[styles.pointsCard, pressed && styles.pressedCard]}>
                <View style={styles.pointsIcon}>
                  <Ionicons name="star" size={22} color={colors.onPrimary} />
                </View>
                <View style={styles.pointsTextCol}>
                  <Text style={styles.pointsLabel}>Referral bonus balance</Text>
                  <Text style={styles.pointsValue}>{referralBalance}</Text>
                  <View style={styles.pointsHintPill}>
                    <Text style={styles.pointsHint}>Usable as a top-up at any shop below</Text>
                  </View>
                </View>
                <Ionicons name={showHistory ? 'chevron-up' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
              </Card>
            )}
          </Pressable>

          {showHistory ? (
            <Card style={styles.historyCard}>
              {transactions.length === 0 ? (
                <Text style={styles.historyEmpty}>No point activity yet.</Text>
              ) : (
                transactions.map((tx, i) => (
                  <View key={i} style={styles.historyRow}>
                    <View style={styles.historyTextCol}>
                      <Text style={styles.historyDesc}>{tx.description}</Text>
                      <Text style={styles.historyDate}>{formatTransactionDate(tx.createdAt)}</Text>
                    </View>
                    <Text style={[styles.historyAmount, tx.type === 'debit' && styles.historyAmountDebit]}>
                      {tx.type === 'credit' ? '+' : '-'}
                      {tx.amount} pts
                    </Text>
                  </View>
                ))
              )}
            </Card>
          ) : null}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.catalogTitle}>Your shops</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="How rewards work"
              style={({ pressed }) => [styles.howItWorks, pressed && styles.howItWorksPressed]}
              hitSlop={6}
              onPress={() =>
                Alert.alert(
                  'How rewards work',
                  'Each shop can run its own rewards program. Complete orders there to earn points, then redeem for a voucher good at that shop. A referral bonus can top up any shop’s redemption.',
                )
              }
            >
              <Text style={styles.howItWorksText}>How it works</Text>
              <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
            </Pressable>
          </View>

          {partners.length === 0 ? (
            <Card style={styles.noteCard}>
              <View style={styles.noteIcon}>
                <Ionicons name="gift" size={16} color={colors.onPrimary} />
              </View>
              <View style={styles.noteTextCol}>
                <Text style={styles.noteTitle}>No shop points yet</Text>
                <Text style={styles.noteHint}>Complete an order at a shop running a rewards program to start earning.</Text>
              </View>
            </Card>
          ) : (
            <View style={styles.shopList}>
              {partners.map((shop) => (
                <ShopRewardsCard
                  key={shop.partnerUserId}
                  shop={shop}
                  referralBalance={referralBalance}
                  apiFetch={apiFetch}
                  onRedeemed={() => void load()}
                />
              ))}
            </View>
          )}
        </>
      ) : null}
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  heroTextCol: { flex: 1, paddingRight: spacing.md },
  heroTitle: { ...typography.hero, fontSize: 26 },
  heroTitleAccent: { color: colors.primary },
  sub: { ...typography.bodySm, marginTop: spacing.sm },
  heroIllustration: {
    width: 72,
    height: 72,
    borderRadius: radius.xxl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedCard: { opacity: 0.9 },
  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 0,
    backgroundColor: colors.primaryLight,
  },
  pointsIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsTextCol: { flex: 1 },
  pointsLabel: { ...typography.caption, fontWeight: '600' },
  pointsValue: { fontSize: 34, fontWeight: '800', color: colors.primary, marginTop: 2 },
  pointsHintPill: { marginTop: spacing.xs },
  pointsHint: { ...typography.caption, color: colors.primaryDark },
  historyCard: { marginBottom: spacing.lg, gap: spacing.sm },
  historyEmpty: { ...typography.bodySm, color: colors.mutedForeground },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  historyTextCol: { flex: 1, paddingRight: spacing.sm },
  historyDesc: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  historyDate: { ...typography.caption, marginTop: 2 },
  historyAmount: { fontSize: 13, fontWeight: '700', color: colors.accentDark },
  historyAmountDebit: { color: colors.mutedForeground },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  catalogTitle: { ...typography.subheading },
  howItWorks: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  howItWorksPressed: { opacity: 0.7 },
  howItWorksText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  shopList: { gap: spacing.sm },
  shopCard: { marginBottom: 0 },
  shopHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  tierIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopTextCol: { flex: 1 },
  shopName: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  shopSub: { ...typography.caption, marginTop: 2 },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  progressLabel: { ...typography.caption, marginTop: spacing.xs },
  catalog: { gap: spacing.sm, marginTop: spacing.md },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rewardCopy: { flex: 1 },
  rewardTitle: { fontWeight: '700', fontSize: 15, color: colors.foreground },
  rewardPoints: { fontSize: 13, fontWeight: '700', marginTop: 2, color: colors.primary },
  rewardDesc: { ...typography.caption, marginTop: 2 },
  rewardStatusCol: { alignItems: 'flex-end', gap: spacing.xs },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  lockedText: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
  toGoText: { fontSize: 11, color: colors.mutedForeground, fontWeight: '600' },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
  },
  noteIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTextCol: { flex: 1 },
  noteTitle: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  noteHint: { ...typography.caption, marginTop: 2 },
});
