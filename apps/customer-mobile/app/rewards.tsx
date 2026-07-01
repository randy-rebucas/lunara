import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { DataLoadState } from '../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../src/components/ui/keyboard-safe-scroll-view';
import { useHomeDashboard } from '../src/hooks/use-home-dashboard';
import { colors, radius, spacing, typography } from '../src/theme';

const REWARDS_CATALOG = [
  {
    title: 'Free pickup',
    points: 200,
    desc: 'Get free pickup on your next order',
    icon: 'cube-outline' as const,
    color: colors.primary,
    bg: colors.primaryLight,
  },
  {
    title: 'Free delivery',
    points: 150,
    desc: 'Get free delivery on your next order',
    icon: 'bicycle-outline' as const,
    color: colors.secondary,
    bg: colors.secondaryLight,
  },
  {
    title: '10% discount',
    points: 300,
    desc: 'Get 10% off on your next order',
    icon: 'pricetag-outline' as const,
    color: colors.accentDark,
    bg: colors.accentLight,
  },
  {
    title: '20% discount',
    points: 500,
    desc: 'Get 20% off on your next order',
    icon: 'pricetag' as const,
    color: '#D97706',
    bg: '#FEF3C7',
  },
  {
    title: 'Free wash & fold (3 kg)',
    points: 800,
    desc: 'Enjoy free wash & fold up to 3 kg',
    icon: 'water-outline' as const,
    color: '#DB2777',
    bg: '#FCE7F3',
  },
] as const;

const TIERS = [
  { name: 'Moon', icon: 'moon' as const, min: 0 },
  { name: 'Star', icon: 'star' as const, min: 500 },
  { name: 'Comet', icon: 'sparkles' as const, min: 1500 },
  { name: 'Galaxy', icon: 'planet' as const, min: 3000 },
] as const;

function getTierProgress(points: number) {
  let currentIndex = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].min) currentIndex = i;
  }
  const current = TIERS[currentIndex];
  const next = TIERS[currentIndex + 1];
  if (!next) {
    return { current, next: null, progress: 1, remaining: 0, floor: current.min, ceiling: current.min };
  }
  const span = next.min - current.min;
  const progress = span > 0 ? Math.min(1, Math.max(0, (points - current.min) / span)) : 1;
  return { current, next, progress, remaining: Math.max(0, next.min - points), floor: current.min, ceiling: next.min };
}

export default function RewardsScreen() {
  const { profile, loading, error, refresh } = useHomeDashboard();
  const points = profile?.loyaltyPoints ?? 0;
  const tier = getTierProgress(points);

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

      <DataLoadState
        loading={loading}
        error={error}
        loadingMessage="Loading rewards…"
        onRetry={refresh}
      />

      {!loading && !error ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View loyalty points details"
            onPress={() => Alert.alert('Loyalty points', 'Detailed point history is coming soon.')}
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
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Card>
            )}
          </Pressable>

          <Card style={styles.tierCard}>
            <View style={styles.tierRow}>
              <View style={styles.tierIcon}>
                <Ionicons name={tier.current.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.tierTextCol}>
                <Text style={styles.tierTitle}>Your tier: {tier.current.name}</Text>
                <Text style={styles.tierHint}>
                  {tier.next
                    ? `Earn ${tier.remaining} more points to reach ${tier.next.name} tier`
                    : 'You’ve reached the highest tier'}
                </Text>
              </View>
              <View style={styles.tierBadge}>
                <Ionicons name={tier.next?.icon ?? tier.current.icon} size={16} color={colors.primary} />
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${tier.progress * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              {points} / {tier.next ? tier.ceiling : tier.floor} pts
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
                  'Earn points on completed orders, referrals, and promotions. Once you hit the points threshold for a reward, tap Redeem to use it on your next order.',
                )
              }
            >
              <Text style={styles.howItWorksText}>How it works</Text>
              <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.catalog}>
            {REWARDS_CATALOG.map((item) => {
              const canRedeem = points >= item.points;
              const toGo = item.points - points;
              return (
                <Card key={item.title} style={styles.rewardRow}>
                  <View style={[styles.rewardIcon, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View style={styles.rewardCopy}>
                    <Text style={styles.rewardTitle}>{item.title}</Text>
                    <Text style={[styles.rewardPoints, { color: item.color }]}>{item.points} pts</Text>
                    <Text style={styles.rewardDesc}>{item.desc}</Text>
                  </View>
                  <View style={styles.rewardStatusCol}>
                    {canRedeem ? (
                      <Button
                        label="Redeem"
                        variant="primary"
                        size="sm"
                        onPress={() =>
                          Alert.alert('Redeem reward', `Redeeming "${item.title}" is coming soon.`)
                        }
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
