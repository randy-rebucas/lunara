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
  description: string;
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

interface RewardsBalance {
  balance: number;
  tier: string;
  nextTier: string | null;
  pointsToNextTier: number;
  transactions: RewardsTransaction[];
}

const CATALOG_STYLE: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  'free-pickup': { icon: 'cube-outline', color: colors.primary, bg: colors.primaryLight },
  'free-delivery': { icon: 'bicycle-outline', color: colors.secondary, bg: colors.secondaryLight },
  'discount-10': { icon: 'pricetag-outline', color: colors.accentDark, bg: colors.accentLight },
  'discount-20': { icon: 'pricetag', color: '#D97706', bg: '#FEF3C7' },
  'free-wash-fold-3kg': { icon: 'water-outline', color: '#DB2777', bg: '#FCE7F3' },
};
const DEFAULT_ITEM_STYLE = { icon: 'gift-outline' as const, color: colors.primary, bg: colors.primaryLight };

const TIER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Moon: 'moon',
  Star: 'star',
  Comet: 'sparkles',
  Galaxy: 'planet',
};

function formatTransactionDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RewardsScreen() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [rewards, setRewards] = useState<RewardsBalance | null>(null);
  const [catalog, setCatalog] = useState<RewardsCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [balance, items] = await Promise.all([
        apiFetch<RewardsBalance>('/rewards/me'),
        apiFetch<RewardsCatalogItem[]>('/rewards/catalog'),
      ]);
      setRewards(balance);
      setCatalog(Array.isArray(items) ? items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function redeem(item: RewardsCatalogItem) {
    setRedeemingId(item.id);
    try {
      const result = await apiFetch<{ voucher: { code: string }; balance: number }>('/rewards/redeem', {
        method: 'POST',
        body: JSON.stringify({ catalogItemId: item.id }),
      });
      Alert.alert(
        'Reward redeemed!',
        `Use code ${result.voucher.code} on your next order to get "${item.title}".`,
      );
      await load();
    } catch (e) {
      Alert.alert('Could not redeem', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setRedeemingId(null);
    }
  }

  const points = rewards?.balance ?? 0;
  const progress =
    rewards?.nextTier && rewards.pointsToNextTier + points > 0
      ? Math.min(1, Math.max(0, points / (rewards.pointsToNextTier + points)))
      : 1;

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
            <Ionicons name="sparkles" size={20} color="#F59E0B" />
          </Text>
          <Text style={styles.sub}>Earn points from completed orders, referrals, and promotions.</Text>
        </View>
        <View style={styles.heroIllustration}>
          <Ionicons name="gift" size={34} color={colors.onPrimary} />
        </View>
      </View>

      <DataLoadState loading={loading} error={error} loadingMessage="Loading rewards…" onRetry={load} />

      {!loading && !error && rewards ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View loyalty points details"
            onPress={() => setShowHistory((v) => !v)}
          >
            {({ pressed }) => (
              <Card style={[styles.pointsCard, pressed && styles.pressedCard]}>
                <View style={styles.pointsIcon}>
                  <Ionicons name="star" size={22} color={colors.onPrimary} />
                </View>
                <View style={styles.pointsTextCol}>
                  <Text style={styles.pointsLabel}>Your loyalty points</Text>
                  <Text style={styles.pointsValue}>{points}</Text>
                  <View style={styles.pointsHintPill}>
                    <Text style={styles.pointsHint}>100 pts per successful referral</Text>
                  </View>
                </View>
                <Ionicons name={showHistory ? 'chevron-up' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
              </Card>
            )}
          </Pressable>

          {showHistory ? (
            <Card style={styles.historyCard}>
              {rewards.transactions.length === 0 ? (
                <Text style={styles.historyEmpty}>No point activity yet.</Text>
              ) : (
                rewards.transactions.map((tx, i) => (
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

          <Card style={styles.tierCard}>
            <View style={styles.tierRow}>
              <View style={styles.tierIcon}>
                <Ionicons name={TIER_ICONS[rewards.tier] ?? 'star'} size={18} color={colors.primary} />
              </View>
              <View style={styles.tierTextCol}>
                <Text style={styles.tierTitle}>Your tier: {rewards.tier}</Text>
                <Text style={styles.tierHint}>
                  {rewards.nextTier
                    ? `Earn ${rewards.pointsToNextTier} more points to reach ${rewards.nextTier} tier`
                    : 'You’ve reached the highest tier'}
                </Text>
              </View>
              <View style={styles.tierBadge}>
                <Ionicons
                  name={TIER_ICONS[rewards.nextTier ?? rewards.tier] ?? 'star'}
                  size={16}
                  color={colors.primary}
                />
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              {points} pts{rewards.nextTier ? ` / ${points + rewards.pointsToNextTier} pts` : ''}
            </Text>
          </Card>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.catalogTitle}>Rewards catalog</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="How rewards work"
              style={({ pressed }) => [styles.howItWorks, pressed && styles.howItWorksPressed]}
              hitSlop={6}
              onPress={() =>
                Alert.alert(
                  'How rewards work',
                  'Earn points on completed orders, referrals, and promotions. Once you hit the points threshold for a reward, tap Redeem to get a voucher code for your next order.',
                )
              }
            >
              <Text style={styles.howItWorksText}>How it works</Text>
              <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.catalog}>
            {catalog.map((item) => {
              const style = CATALOG_STYLE[item.id] ?? DEFAULT_ITEM_STYLE;
              const canRedeem = points >= item.points;
              const toGo = item.points - points;
              return (
                <Card key={item.id} style={styles.rewardRow}>
                  <View style={[styles.rewardIcon, { backgroundColor: style.bg }]}>
                    <Ionicons name={style.icon} size={20} color={style.color} />
                  </View>
                  <View style={styles.rewardCopy}>
                    <Text style={styles.rewardTitle}>{item.title}</Text>
                    <Text style={[styles.rewardPoints, { color: style.color }]}>{item.points} pts</Text>
                    <Text style={styles.rewardDesc}>{item.description}</Text>
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
                    <Text style={[styles.toGoText, canRedeem && { color: colors.accentDark }]}>
                      {canRedeem ? 'Ready to redeem' : `${toGo} pts to go`}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>

          <Card style={styles.noteCard}>
            <View style={styles.noteIcon}>
              <Ionicons name="gift" size={16} color={colors.onPrimary} />
            </View>
            <View style={styles.noteTextCol}>
              <Text style={styles.noteTitle}>More rewards are coming soon!</Text>
              <Text style={styles.noteHint}>Keep earning points by ordering and referring friends.</Text>
            </View>
          </Card>
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
  tierCard: { marginBottom: spacing.xl },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  tierIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierTextCol: { flex: 1 },
  tierTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  tierHint: { ...typography.caption, marginTop: 2 },
  tierBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  progressLabel: { ...typography.caption, marginTop: spacing.xs, textAlign: 'right' },
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
  catalog: { gap: spacing.sm },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardCopy: { flex: 1 },
  rewardTitle: { fontWeight: '700', fontSize: 15, color: colors.foreground },
  rewardPoints: { fontSize: 13, fontWeight: '700', marginTop: 2 },
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
