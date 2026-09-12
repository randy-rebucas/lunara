import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ActiveAssignmentCard } from '../../src/components/active-assignment-card';
import { ComplianceBanner } from '../../src/components/compliance-banner';
import { OfflineBanner } from '../../src/components/offline-banner';
import { useRiderOperations } from '../../src/context/rider-operations';
import { PickupOfferCard, DeliveryOfferCard } from '../../src/components/rider-offer-card';
import { RouteGuideCarousel } from '../../src/components/route-guide-carousel';
import { LocationPermissionBanner } from '../../src/components/ui/location-permission-banner';
import { Screen } from '../../src/components/ui/screen';
import { ShiftPanel } from '../../src/components/ui/shift-panel';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { promptNavigate } from '../../src/lib/task-contact';
import { colors, radius, spacing, typography } from '../../src/theme';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ── Home screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const tabPadding = useTabScreenPadding();
  const {
    me,
    name,
    online,
    shiftStatus,
    shiftBusy,
    refreshing,
    routeProgressIndex,
    offers,
    deliveryOffers,
    onRefresh,
    goOnline,
    goOffline,
    startBreak,
    endBreak,
    locationDenied,
    requestLocationPermission,
    activeAssignment,
    acceptingOfferId,
    acceptPickupOffer,
    declinePickupOffer,
    declineDeliveryOffer,
    previewDeliveryQueue,
    openTask,
  } = useRiderOperations();

  const [dismissedPickup, setDismissedPickup] = useState<Set<string>>(new Set());
  const [dismissedDelivery, setDismissedDelivery] = useState<Set<string>>(new Set());

  const visiblePickups = offers.filter((o) => !dismissedPickup.has(o._id));
  const visibleDeliveries = deliveryOffers.filter((o) => !dismissedDelivery.has(o._id));
  const totalTaskCount = visiblePickups.length + visibleDeliveries.length;
  const shopName = me?.shopLocation?.name ?? 'Lunara Hub';
  const greeting = getGreeting();

  return (
    <Screen
      inTab
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentStyle={{ paddingBottom: tabPadding }}
    >
      {/* ── Greeting + online pill ── */}
      <View style={styles.greetingRow}>
        <View style={styles.greetingLeft}>
          <Text style={styles.greeting}>
            {greeting}, <Text style={styles.greetingName}>{name}!</Text>
          </Text>
          <Text style={styles.greetingSub}>Here&apos;s your overview for today.</Text>
        </View>
        <Pressable
          style={[
            styles.onlinePill,
            online ? styles.onlinePillActive : styles.onlinePillOff,
            shiftBusy && styles.onlinePillDisabled,
          ]}
          onPress={online ? goOffline : goOnline}
          disabled={shiftBusy}
          accessibilityRole="button"
          accessibilityLabel={online ? 'Go offline' : 'Go online'}
        >
          <View style={[styles.onlineDot, online ? styles.onlineDotActive : styles.onlineDotOff]} />
          <Text style={[styles.onlinePillText, online ? styles.onlinePillTextActive : styles.onlinePillTextOff]}>
            {online ? 'Online' : 'Offline'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={13}
            color={online ? colors.accentDark : colors.mutedForeground}
          />
        </Pressable>
      </View>

      <ComplianceBanner compliance={me?.compliance} />
      <LocationPermissionBanner
        denied={locationDenied && online}
        onRequestPermission={requestLocationPermission}
      />

      {/* ── Shift panel ── */}
      <ShiftPanel
        shiftStatus={shiftStatus}
        canGoOnline={Boolean(me?.compliance?.isCompliant)}
        busy={shiftBusy}
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

      {/* ── Available tasks ── */}
      {totalTaskCount > 0 ? (
        <View style={styles.tasksSection}>
          <View style={styles.tasksSectionHeader}>
            <Text style={styles.tasksSectionLabel}>AVAILABLE TASKS</Text>
            <Pressable
              onPress={() => router.push('/(tabs)/tasks' as never)}
              style={styles.seeAllBtn}
              hitSlop={8}
            >
              <Text style={styles.seeAllText}>See all ({totalTaskCount})</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </Pressable>
          </View>

          {visiblePickups.map((offer) => (
            <PickupOfferCard
              key={offer._id}
              item={offer}
              shopName={shopName}
              accepting={acceptingOfferId === offer._id}
              onAccept={() => acceptPickupOffer(offer._id)}
              onDecline={() => {
                setDismissedPickup((s) => new Set([...s, offer._id]));
                declinePickupOffer(offer._id);
              }}
            />
          ))}

          {visibleDeliveries.map((offer) => (
            <DeliveryOfferCard
              key={offer._id}
              item={offer}
              shopName={shopName}
              onAccept={() => previewDeliveryQueue(offer._id)}
              onDecline={() => {
                setDismissedDelivery((s) => new Set([...s, offer._id]));
                declineDeliveryOffer(offer._id);
              }}
            />
          ))}
        </View>
      ) : null}

      <RouteGuideCarousel progressIndex={routeProgressIndex} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // ── Greeting ──
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  greetingLeft: { flex: 1, paddingRight: spacing.md },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  greetingName: {
    color: colors.foreground,
  },
  greetingSub: {
    ...typography.bodySm,
    marginTop: spacing.xs,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    marginTop: 2,
  },
  onlinePillActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  onlinePillOff: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  onlinePillDisabled: {
    opacity: 0.6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineDotActive: { backgroundColor: colors.accent },
  onlineDotOff: { backgroundColor: colors.mutedForeground },
  onlinePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  onlinePillTextActive: { color: colors.accentDark },
  onlinePillTextOff: { color: colors.muted },

  // ── Available tasks ──
  tasksSection: {
    marginTop: spacing.xl,
  },
  tasksSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  tasksSectionLabel: { ...typography.label },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
