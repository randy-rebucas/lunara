import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { DataLoadState } from '../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../src/components/ui/keyboard-safe-scroll-view';
import { useHomeDashboard } from '../src/hooks/use-home-dashboard';
import { colors, spacing, typography } from '../src/theme';

const REWARDS_CATALOG = [
  { title: 'Free pickup', points: 200 },
  { title: 'Free delivery', points: 150 },
  { title: '10% discount', points: 300 },
  { title: '20% discount', points: 500 },
  { title: 'Free wash & fold (3 kg)', points: 800 },
] as const;

export default function RewardsScreen() {
  const { profile, loading, error, refresh } = useHomeDashboard();
  const points = profile?.loyaltyPoints ?? 0;

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
    >

      <Text style={styles.sub}>
        Earn points from completed orders, referrals, and promotions. Redeem rewards below.
      </Text>

      <DataLoadState
        loading={loading}
        error={error}
        loadingMessage="Loading rewards…"
        onRetry={refresh}
      />

      {!loading && !error ? (
        <>
          <Card style={styles.pointsCard}>
            <Text style={styles.pointsLabel}>Your loyalty points</Text>
            <Text style={styles.pointsValue}>{points}</Text>
            <Text style={styles.pointsHint}>100 points per successful referral</Text>
          </Card>

          <Text style={styles.catalogTitle}>Rewards catalog</Text>
          <View style={styles.catalog}>
            {REWARDS_CATALOG.map((item) => {
              const canRedeem = points >= item.points;
              return (
                <Card key={item.title} muted={!canRedeem} style={styles.rewardRow}>
                  <View style={styles.rewardCopy}>
                    <Text style={styles.rewardTitle}>{item.title}</Text>
                    <Text style={styles.rewardPoints}>{item.points} pts</Text>
                  </View>
                  <Button
                    label={canRedeem ? 'Redeem' : 'Locked'}
                    variant={canRedeem ? 'primary' : 'outline'}
                    disabled={!canRedeem}
                    onPress={() => {}}
                    style={styles.redeemBtn}
                  />
                </Card>
              );
            })}
          </View>

          <Text style={styles.note}>
            Reward redemption is coming soon. Keep earning points by booking and referring friends.
          </Text>
        </>
      ) : null}
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  sub: { ...typography.bodySm, marginBottom: spacing.lg },
  pointsCard: { alignItems: 'center', marginBottom: spacing.xl, gap: spacing.xs },
  pointsLabel: { ...typography.caption, fontWeight: '600' },
  pointsValue: { fontSize: 40, fontWeight: '800', color: colors.primary },
  pointsHint: { ...typography.caption },
  catalogTitle: { ...typography.subheading, marginBottom: spacing.md },
  catalog: { gap: spacing.sm },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rewardCopy: { flex: 1 },
  rewardTitle: { fontWeight: '600', fontSize: 15 },
  rewardPoints: { ...typography.caption, marginTop: 2 },
  redeemBtn: { paddingHorizontal: spacing.lg },
  note: { ...typography.caption, marginTop: spacing.xl, textAlign: 'center' },
});
