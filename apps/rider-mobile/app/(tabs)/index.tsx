import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '@lunara/utils';
import { ActiveAssignmentCard } from '../../src/components/active-assignment-card';
import { ComplianceBanner } from '../../src/components/compliance-banner';
import { OfflineBanner } from '../../src/components/offline-banner';
import { useRiderOperations } from '../../src/context/rider-operations';
import { RouteGuideCarousel } from '../../src/components/route-guide-carousel';
import { Card } from '../../src/components/ui/card';
import { LocationPermissionBanner } from '../../src/components/ui/location-permission-banner';
import { Screen } from '../../src/components/ui/screen';
import { ShiftPanel } from '../../src/components/ui/shift-panel';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { promptNavigate } from '../../src/lib/task-contact';
import { colors, spacing, typography } from '../../src/theme';

export default function HomeScreen() {
  const router = useRouter();
  const tabPadding = useTabScreenPadding();
  const {
    me,
    name,
    online,
    shiftStatus,
    weekEarnings,
    monthEarnings,
    refreshing,
    routeProgressIndex,
    onRefresh,
    goOnline,
    goOffline,
    startBreak,
    endBreak,
    locationDenied,
    requestLocationPermission,
    activeAssignment,
    openTask,
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

      <View style={styles.earningsGrid}>
        <Card elevated style={styles.earnBox}>
          <Text style={styles.earnLabel}>Today</Text>
          <Text style={styles.earnValue}>{formatCurrency(me?.todayEarnings ?? 0)}</Text>
        </Card>
        <Card elevated style={styles.earnBox}>
          <Text style={styles.earnLabel}>This week</Text>
          <Text style={styles.earnValueMuted}>{formatCurrency(weekEarnings)}</Text>
        </Card>
        <Card elevated style={styles.earnBox}>
          <Text style={styles.earnLabel}>This month</Text>
          <Text style={styles.earnValueMuted}>{formatCurrency(monthEarnings)}</Text>
        </Card>
        <Card elevated style={styles.earnBox}>
          <Text style={styles.earnLabel}>Lifetime</Text>
          <Text style={styles.earnValueMuted}>{formatCurrency(me?.totalEarnings ?? 0)}</Text>
        </Card>
      </View>
      <Pressable style={styles.earnLink} onPress={() => router.push('/earnings')}>
        <Text style={styles.earnLinkText}>View earnings history →</Text>
      </Pressable>

      <ComplianceBanner compliance={me?.compliance} />

      <LocationPermissionBanner
        denied={locationDenied && online}
        onRequestPermission={requestLocationPermission}
      />

      <ShiftPanel
        shiftStatus={shiftStatus}
        canGoOnline={Boolean(me?.compliance?.isCompliant)}
        complianceHint={
          me?.compliance && !me.compliance.isCompliant
            ? 'Complete profile and document verification on the Profile tab before going online.'
            : undefined
        }
        onGoOnline={goOnline}
        onGoOffline={goOffline}
        onStartBreak={startBreak}
        onEndBreak={endBreak}
      />

      {online && activeAssignment ? (
        <ActiveAssignmentCard
          assignment={activeAssignment}
          onViewTask={() => openTask(activeAssignment.orderId, activeAssignment.status)}
          onNavigate={() => promptNavigate(activeAssignment.navigateTarget)}
        />
      ) : null}

      <OfflineBanner embedded />

      <RouteGuideCarousel progressIndex={routeProgressIndex} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { ...typography.title, fontSize: 22 },
  sub: { ...typography.bodySm, marginTop: spacing.xs, marginBottom: spacing.lg },
  earningsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
  },
  earnBox: { width: '48%', flexGrow: 1, padding: spacing.md },
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
  earnLink: { paddingVertical: spacing.sm, marginBottom: spacing.md },
  earnLinkText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
