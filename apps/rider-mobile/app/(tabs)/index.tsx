import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '@lunara/utils';
import { ActiveAssignmentCard } from '../../src/components/active-assignment-card';
import { ComplianceBanner } from '../../src/components/compliance-banner';
import { OfflineBanner } from '../../src/components/offline-banner';
import { useRiderOperations } from '../../src/context/rider-operations';
import { RouteGuideCarousel } from '../../src/components/route-guide-carousel';
import { LocationPermissionBanner } from '../../src/components/ui/location-permission-banner';
import { Screen } from '../../src/components/ui/screen';
import { ShiftPanel } from '../../src/components/ui/shift-panel';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { promptNavigate } from '../../src/lib/task-contact';
import type { DeliveryOffer, PickupOffer } from '../../src/lib/rider-types';
import { colors, radius, spacing, typography } from '../../src/theme';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatOfferTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Earnings card ─────────────────────────────────────────────────────────────
interface EarnCardProps {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  valueColor: string;
}

function EarnCard({ label, value, icon, iconBg, iconColor, valueColor }: EarnCardProps) {
  return (
    <View style={earnStyles.card}>
      <View style={[earnStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={earnStyles.label}>{label}</Text>
      <Text style={[earnStyles.value, { color: valueColor }]}>{formatCurrency(value)}</Text>
    </View>
  );
}

const earnStyles = StyleSheet.create({
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  label: { ...typography.label },
  value: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
});

// ── Pickup offer card ─────────────────────────────────────────────────────────
interface PickupOfferCardProps {
  offer: PickupOffer;
  shopName: string;
  onAccept: () => void;
  onDecline: () => void;
}

function PickupOfferCard({ offer, shopName, onAccept, onDecline }: PickupOfferCardProps) {
  const pickupTime = formatOfferTime(offer.scheduledPickupAt);
  const fromLabel = offer.pickupAddress?.label ?? 'Customer address';
  const fromCity = offer.pickupAddress?.city ?? '';

  return (
    <View style={offerStyles.card}>
      <View style={offerStyles.topRow}>
        <View style={offerStyles.typePill}>
          <Text style={offerStyles.typePillText}>PICKUP</Text>
        </View>
      </View>

      {/* Route visualization */}
      <View style={offerStyles.route}>
        <View style={offerStyles.routeLeft}>
          <View style={offerStyles.routeDotOrigin} />
          <View style={offerStyles.routeLine} />
          <Ionicons name="location" size={16} color={colors.accent} />
        </View>
        <View style={offerStyles.routeAddresses}>
          <View style={offerStyles.routeAddress}>
            <Text style={offerStyles.routeAddressMain}>{fromLabel}</Text>
            {fromCity ? <Text style={offerStyles.routeAddressCity}>{fromCity}</Text> : null}
          </View>
          <View style={offerStyles.routeAddress}>
            <Text style={offerStyles.routeAddressMain}>{shopName}</Text>
            <Text style={offerStyles.routeAddressCity}>Drop-off at shop</Text>
          </View>
        </View>
      </View>

      {pickupTime ? (
        <View style={offerStyles.timePill}>
          <Ionicons name="time-outline" size={13} color={colors.primary} />
          <Text style={offerStyles.timePillText}>Pick up by {pickupTime}</Text>
        </View>
      ) : null}

      <View style={offerStyles.actions}>
        <Pressable style={offerStyles.declineBtn} onPress={onDecline} accessibilityRole="button">
          <Text style={offerStyles.declineBtnText}>Decline</Text>
        </Pressable>
        <Pressable style={offerStyles.acceptBtn} onPress={onAccept} accessibilityRole="button">
          <Text style={offerStyles.acceptBtnText}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Delivery offer card ───────────────────────────────────────────────────────
interface DeliveryOfferCardProps {
  offer: DeliveryOffer;
  shopName: string;
  onAccept: () => void;
  onDecline: () => void;
}

function DeliveryOfferCard({ offer, shopName, onAccept, onDecline }: DeliveryOfferCardProps) {
  const toLabel = offer.deliveryAddress?.label ?? 'Customer address';
  const toCity = offer.deliveryAddress?.city ?? '';

  return (
    <View style={offerStyles.card}>
      <View style={offerStyles.topRow}>
        <View style={[offerStyles.typePill, offerStyles.typePillDelivery]}>
          <Text style={offerStyles.typePillText}>DELIVERY</Text>
        </View>
      </View>

      <View style={offerStyles.route}>
        <View style={offerStyles.routeLeft}>
          <View style={offerStyles.routeDotOrigin} />
          <View style={offerStyles.routeLine} />
          <Ionicons name="location" size={16} color={colors.accent} />
        </View>
        <View style={offerStyles.routeAddresses}>
          <View style={offerStyles.routeAddress}>
            <Text style={offerStyles.routeAddressMain}>{shopName}</Text>
            <Text style={offerStyles.routeAddressCity}>Pick up from shop</Text>
          </View>
          <View style={offerStyles.routeAddress}>
            <Text style={offerStyles.routeAddressMain}>{toLabel}</Text>
            {toCity ? <Text style={offerStyles.routeAddressCity}>{toCity}</Text> : null}
          </View>
        </View>
      </View>

      <View style={offerStyles.actions}>
        <Pressable style={offerStyles.declineBtn} onPress={onDecline} accessibilityRole="button">
          <Text style={offerStyles.declineBtnText}>Decline</Text>
        </Pressable>
        <Pressable style={offerStyles.acceptBtn} onPress={onAccept} accessibilityRole="button">
          <Text style={offerStyles.acceptBtnText}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

const offerStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  typePill: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  typePillDelivery: {
    backgroundColor: colors.accentLight,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  route: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  routeLeft: {
    alignItems: 'center',
    paddingTop: 3,
    gap: 0,
  },
  routeDotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 3,
    borderStyle: 'dashed',
  },
  routeAddresses: {
    flex: 1,
    gap: spacing.md + 4,
  },
  routeAddress: {},
  routeAddressMain: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  routeAddressCity: {
    ...typography.caption,
    marginTop: 1,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  timePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  declineBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.destructive,
  },
  acceptBtn: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

// ── Home screen ───────────────────────────────────────────────────────────────
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
    acceptPickupOffer,
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
          style={[styles.onlinePill, online ? styles.onlinePillActive : styles.onlinePillOff]}
          onPress={online ? goOffline : goOnline}
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

      {/* ── Earnings grid ── */}
      <View style={styles.earningsGrid}>
        <EarnCard
          label="TODAY'S EARNINGS"
          value={me?.todayEarnings ?? 0}
          icon="wallet-outline"
          iconBg={colors.accentLight}
          iconColor={colors.accentDark}
          valueColor={colors.accentDark}
        />
        <EarnCard
          label="THIS WEEK"
          value={weekEarnings}
          icon="calendar-outline"
          iconBg={colors.primaryLight}
          iconColor={colors.primary}
          valueColor={colors.primary}
        />
        <EarnCard
          label="THIS MONTH"
          value={monthEarnings}
          icon="bar-chart-outline"
          iconBg="#EFF6FF"
          iconColor="#3B82F6"
          valueColor="#3B82F6"
        />
        <EarnCard
          label="LIFETIME"
          value={me?.totalEarnings ?? 0}
          icon="star-outline"
          iconBg={colors.warningBg}
          iconColor={colors.warning}
          valueColor={colors.warning}
        />
      </View>

      <Pressable style={styles.earnLink} onPress={() => router.push('/earnings')}>
        <Text style={styles.earnLinkText}>View earnings history</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </Pressable>

      <ComplianceBanner compliance={me?.compliance} />
      <LocationPermissionBanner
        denied={locationDenied && online}
        onRequestPermission={requestLocationPermission}
      />

      {/* ── Shift panel ── */}
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
          feeAmount={
            me?.feeRates
              ? activeAssignment.leg === 'delivery'
                ? me.feeRates.delivery
                : me.feeRates.pickup
              : undefined
          }
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
              offer={offer}
              shopName={shopName}
              onAccept={() => acceptPickupOffer(offer._id)}
              onDecline={() => setDismissedPickup((s) => new Set([...s, offer._id]))}
            />
          ))}

          {visibleDeliveries.map((offer) => (
            <DeliveryOfferCard
              key={offer._id}
              offer={offer}
              shopName={shopName}
              onAccept={() => previewDeliveryQueue(offer._id)}
              onDecline={() => setDismissedDelivery((s) => new Set([...s, offer._id]))}
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

  // ── Earnings ──
  earningsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
  },
  earnLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  earnLinkText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },

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
