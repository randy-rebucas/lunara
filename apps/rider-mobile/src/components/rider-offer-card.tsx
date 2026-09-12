import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DeliveryOffer, PickupOffer } from '../lib/rider-types';
import { colors, radius, spacing, typography } from '../theme';

/** Shared by the Home tab's "available tasks" preview and the Tasks tab's "assigned" list —
 * both render the same pickup/delivery offer cards, so the shape lives in one place. A prior
 * version of this component was copy-pasted into both screens; a decline-persistence fix only
 * landed in one copy because of it. */

function formatOfferTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Route visualization ───────────────────────────────────────────────────────

interface RouteRowProps {
  fromLabel: string;
  fromCity?: string;
  fromSub?: string;
  toLabel: string;
  toCity?: string;
  toSub?: string;
}

export function RouteRow({ fromLabel, fromCity, fromSub, toLabel, toCity, toSub }: RouteRowProps) {
  return (
    <View style={routeStyles.wrap}>
      <View style={routeStyles.left}>
        <View style={routeStyles.dotOrigin} />
        <View style={routeStyles.line} />
        <Ionicons name="location" size={16} color={colors.accent} />
      </View>
      <View style={routeStyles.addresses}>
        <View style={routeStyles.address}>
          <Text style={routeStyles.addrMain}>{fromLabel}</Text>
          {fromCity ? <Text style={routeStyles.addrSub}>{fromCity}</Text> : null}
          {fromSub ? <Text style={routeStyles.addrSub}>{fromSub}</Text> : null}
        </View>
        <View style={routeStyles.address}>
          <Text style={routeStyles.addrMain}>{toLabel}</Text>
          {toCity ? <Text style={routeStyles.addrSub}>{toCity}</Text> : null}
          {toSub ? <Text style={routeStyles.addrSub}>{toSub}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const routeStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.sm },
  left: { alignItems: 'center', paddingTop: 3 },
  dotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 3,
  },
  addresses: { flex: 1, gap: spacing.md + 4 },
  address: {},
  addrMain: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  addrSub: { ...typography.caption, marginTop: 1 },
});

// ── Time chip ─────────────────────────────────────────────────────────────────

function TimeChip({ label }: { label: string }) {
  return (
    <View style={chipStyles.wrap}>
      <Ionicons name="time-outline" size={13} color={colors.primary} />
      <Text style={chipStyles.text}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  text: { fontSize: 12, fontWeight: '600', color: colors.primary },
});

// ── Offer card shell ──────────────────────────────────────────────────────────

interface OfferCardShellProps {
  typeLabel: string;
  typeColor: string;
  typeBg: string;
  onAccept: () => void;
  onDecline: () => void;
  acceptDisabled?: boolean;
  accepting?: boolean;
  children: React.ReactNode;
}

function OfferCardShell({
  typeLabel,
  typeColor,
  typeBg,
  onAccept,
  onDecline,
  acceptDisabled,
  accepting,
  children,
}: OfferCardShellProps) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.typePill, { backgroundColor: typeBg }]}>
          <Text style={[cardStyles.typePillText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        <View style={cardStyles.newBadge}>
          <Ionicons name="radio-outline" size={11} color={colors.warning} />
          <Text style={cardStyles.newBadgeText}>New offer</Text>
        </View>
      </View>
      {children}
      <View style={cardStyles.actions}>
        <Pressable
          style={({ pressed }) => [
            cardStyles.declineBtn,
            pressed && cardStyles.btnPressed,
            acceptDisabled && cardStyles.btnDisabled,
          ]}
          onPress={onDecline}
          disabled={acceptDisabled}
          accessibilityRole="button"
          accessibilityLabel="Decline"
        >
          <Ionicons name="close-outline" size={16} color={colors.destructive} />
          <Text style={cardStyles.declineBtnText}>Decline</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            cardStyles.acceptBtn,
            pressed && cardStyles.btnPressed,
            acceptDisabled && cardStyles.btnDisabled,
          ]}
          onPress={onAccept}
          disabled={acceptDisabled}
          accessibilityRole="button"
          accessibilityLabel="Accept"
        >
          {accepting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark-outline" size={16} color="#fff" />
          )}
          <Text style={cardStyles.acceptBtnText}>{accepting ? 'Accepting…' : 'Accept'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Pickup offer card ─────────────────────────────────────────────────────────

export const PickupOfferCard = React.memo(function PickupOfferCard({
  item,
  shopName,
  onAccept,
  onDecline,
  accepting,
}: {
  item: PickupOffer;
  shopName: string;
  onAccept: () => void;
  onDecline: () => void;
  accepting?: boolean;
}) {
  const pickupTime = formatOfferTime(item.scheduledPickupAt);
  return (
    <OfferCardShell
      typeLabel="PICKUP"
      typeColor={colors.primary}
      typeBg={colors.primaryLight}
      onAccept={onAccept}
      onDecline={onDecline}
      acceptDisabled={accepting}
      accepting={accepting}
    >
      <RouteRow
        fromLabel={item.pickupAddress?.label ?? 'Customer address'}
        fromCity={item.pickupAddress?.city}
        toLabel={shopName}
        toSub="Drop-off at shop"
      />
      {pickupTime ? <TimeChip label={`Pick up by ${pickupTime}`} /> : null}
    </OfferCardShell>
  );
});

// ── Delivery offer card ───────────────────────────────────────────────────────

export const DeliveryOfferCard = React.memo(function DeliveryOfferCard({
  item,
  shopName,
  onAccept,
  onDecline,
}: {
  item: DeliveryOffer;
  shopName: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <OfferCardShell
      typeLabel="DELIVERY"
      typeColor={colors.accentDark}
      typeBg={colors.accentLight}
      onAccept={onAccept}
      onDecline={onDecline}
    >
      <RouteRow
        fromLabel={shopName}
        fromSub="Pick up from shop"
        toLabel={item.deliveryAddress?.label ?? 'Customer address'}
        toCity={item.deliveryAddress?.city}
      />
    </OfferCardShell>
  );
});

const cardStyles = StyleSheet.create({
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
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  typePill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 0.2,
  },
  btnPressed: { opacity: 0.8 },
  btnDisabled: { opacity: 0.55 },
});
