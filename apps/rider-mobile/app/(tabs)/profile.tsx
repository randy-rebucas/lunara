import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '@lunara/utils';
import { ComplianceBanner } from '../../src/components/compliance-banner';
import { useRiderOperations } from '../../src/context/rider-operations';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { LocationPermissionBanner } from '../../src/components/ui/location-permission-banner';
import { Screen } from '../../src/components/ui/screen';
import { StatusBadge } from '../../src/components/ui/status-badge';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { useAuthStore } from '../../src/store/auth';
import { colors, spacing, typography } from '../../src/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const tabPadding = useTabScreenPadding();
  const authUser = useAuthStore((s) => s.user);
  const {
    me,
    name,
    shiftStatus,
    unreadCount,
    refreshing,
    onRefresh,
    handleLogout,
    locationDenied,
    requestLocationPermission,
  } = useRiderOperations();

  const email = authUser?.email ?? me?.user?.email ?? '—';
  const phone = me?.user?.phone ?? '—';
  const vehicleType = me?.vehicleType ?? 'motorcycle';
  const plateNumber = me?.plateNumber ?? '—';
  const compliance = me?.compliance;
  const approvedDocs = compliance?.approvedDocumentCount ?? 0;

  return (
    <Screen
      inTab
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentStyle={{ paddingBottom: tabPadding }}
    >
      <ComplianceBanner compliance={compliance} />

      <Card elevated style={styles.profileCard}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.email}>{phone}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Shift status</Text>
          <StatusBadge shiftStatus={shiftStatus} />
        </View>
      </Card>

      <LocationPermissionBanner
        denied={locationDenied}
        onRequestPermission={requestLocationPermission}
      />

      <Card style={styles.linkCard}>
        <Text style={styles.cardLabel}>Verification</Text>
        <Text style={styles.cardHint}>
          {compliance?.isCompliant
            ? 'Profile and documents verified — you can go online.'
            : `${approvedDocs} of 4 documents approved.`}
        </Text>
        <Pressable onPress={() => router.push('/profile/edit')} style={styles.linkBtn}>
          <Text style={styles.linkText}>Edit profile →</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/documents')} style={styles.linkBtn}>
          <Text style={styles.linkText}>Documents →</Text>
        </Pressable>
      </Card>

      <Card style={styles.linkCard}>
        <Text style={styles.cardLabel}>Vehicle</Text>
        <Text style={styles.cardHint}>
          {vehicleType} · Plate {plateNumber}
        </Text>
      </Card>

      <Card style={styles.linkCard}>
        <Text style={styles.cardLabel}>Earnings</Text>
        <View style={styles.earningsRow}>
          <View>
            <Text style={styles.earnCaption}>Today</Text>
            <Text style={styles.earnToday}>{formatCurrency(me?.todayEarnings ?? 0)}</Text>
          </View>
          <View>
            <Text style={styles.earnCaption}>All time</Text>
            <Text style={styles.earnTotal}>{formatCurrency(me?.totalEarnings ?? 0)}</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/earnings')} style={styles.linkBtn}>
          <Text style={styles.linkText}>View earnings history →</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/wallet' as import('expo-router').Href)} style={styles.linkBtn}>
          <Text style={styles.linkText}>Wallet & withdrawals →</Text>
        </Pressable>
      </Card>

      <Pressable onPress={() => router.push('/(tabs)/tasks?filter=completed' as import('expo-router').Href)}>
        <Card style={styles.menuCard}>
          <Text style={styles.menuTitle}>Task history</Text>
          <Text style={styles.menuHint}>Completed pickups and deliveries</Text>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/performance')}>
        <Card style={styles.menuCard}>
          <Text style={styles.menuTitle}>Performance</Text>
          <Text style={styles.menuHint}>Completion, acceptance, and customer ratings</Text>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/support')}>
        <Card style={styles.menuCard}>
          <Text style={styles.menuTitle}>Help & support</Text>
          <Text style={styles.menuHint}>FAQs, contact dispatch, and emergency SOS</Text>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/notifications')}>
        <Card style={styles.menuCard}>
          <View style={styles.menuRow}>
            <Text style={styles.menuTitle}>Notifications</Text>
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.menuHint}>Dispatch alerts and assignment updates</Text>
        </Card>
      </Pressable>

      <Button
        label="Sign out"
        variant="outline"
        onPress={handleLogout}
        style={styles.logoutBtn}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: { gap: spacing.sm, marginBottom: spacing.md },
  name: { ...typography.subheading },
  email: { ...typography.bodySm },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statusLabel: { ...typography.label },
  linkCard: { marginBottom: spacing.md, gap: spacing.md },
  cardLabel: { ...typography.label },
  cardHint: { ...typography.bodySm },
  earningsRow: { flexDirection: 'row', gap: spacing.xxl },
  earnCaption: { ...typography.caption },
  earnToday: {
    marginTop: spacing.xs,
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
  },
  earnTotal: {
    marginTop: spacing.xs,
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  linkBtn: { marginTop: spacing.xs },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  menuCard: { marginBottom: spacing.md },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  menuTitle: { ...typography.subheading, fontSize: 16 },
  menuHint: { ...typography.bodySm, marginTop: spacing.xs },
  badge: {
    backgroundColor: colors.destructive,
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
  logoutBtn: { marginTop: spacing.sm },
});
