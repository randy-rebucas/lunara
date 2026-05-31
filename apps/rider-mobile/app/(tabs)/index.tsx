import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '@lunara/utils';
import { useRiderOperations } from '../../src/context/rider-operations';
import { RouteGuideCarousel } from '../../src/components/route-guide-carousel';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { ShiftPanel } from '../../src/components/ui/shift-panel';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { colors, spacing, typography } from '../../src/theme';

export default function HomeScreen() {
  const router = useRouter();
  const tabPadding = useTabScreenPadding();
  const {
    me,
    name,
    online,
    refreshing,
    routeProgressIndex,
    onRefresh,
    goOnline,
    goOffline,
  } = useRiderOperations();

  return (
    <Screen
      inTab
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentStyle={{ paddingBottom: tabPadding }}
    >
      <Text style={styles.greeting}>{name}</Text>
      <Text style={styles.sub}>Today&apos;s shift, earnings, and route guide.</Text>

      <View style={styles.earningsRow}>
        <Card elevated style={styles.earnBox}>
          <Text style={styles.earnLabel}>Today</Text>
          <Text style={styles.earnValue}>{formatCurrency(me?.todayEarnings ?? 0)}</Text>
        </Card>
        <Card elevated style={styles.earnBox}>
          <Text style={styles.earnLabel}>All time</Text>
          <Text style={styles.earnValueMuted}>{formatCurrency(me?.totalEarnings ?? 0)}</Text>
        </Card>
        <Pressable style={styles.earnLink} onPress={() => router.push('/earnings')}>
          <Text style={styles.earnLinkText}>Earnings →</Text>
        </Pressable>
      </View>

      <ShiftPanel online={online} onGoOnline={goOnline} onGoOffline={goOffline} />

      <RouteGuideCarousel progressIndex={routeProgressIndex} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { ...typography.title, fontSize: 22 },
  sub: { ...typography.bodySm, marginTop: spacing.xs, marginBottom: spacing.lg },
  earningsRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    alignItems: 'center',
  },
  earnBox: { flex: 1, padding: spacing.md },
  earnLabel: { ...typography.label },
  earnValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
    marginTop: spacing.xs,
  },
  earnValueMuted: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.xs,
  },
  earnLink: { padding: spacing.sm },
  earnLinkText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
