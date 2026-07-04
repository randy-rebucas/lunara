import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '@lunara/utils';
import { ComplianceBanner } from '../../src/components/compliance-banner';
import { useRiderOperations } from '../../src/context/rider-operations';
import { LocationPermissionBanner } from '../../src/components/ui/location-permission-banner';
import { Screen } from '../../src/components/ui/screen';
import { StatusBadge } from '../../src/components/ui/status-badge';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { useAuthStore } from '../../src/store/auth';
import { colors, radius, shadow, spacing, typography } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View style={avatarStyles.wrap}>
      <Text style={avatarStyles.text}>{initials || '?'}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  text: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
});

// ── Menu row ──────────────────────────────────────────────────────────────────

interface MenuRowProps {
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
  title: string;
  hint?: string;
  badge?: number;
  danger?: boolean;
  onPress: () => void;
}

function MenuRow({ icon, iconBg, iconColor, title, hint, badge, danger, onPress }: MenuRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [menuStyles.row, pressed && menuStyles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[menuStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={menuStyles.textWrap}>
        <Text style={[menuStyles.title, danger && menuStyles.titleDanger]}>{title}</Text>
        {hint ? <Text style={menuStyles.hint}>{hint}</Text> : null}
      </View>
      {badge && badge > 0 ? (
        <View style={menuStyles.badge}>
          <Text style={menuStyles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
      <Ionicons
        name="chevron-forward"
        size={16}
        color={danger ? colors.destructive : colors.mutedForeground}
      />
    </Pressable>
  );
}

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowPressed: { opacity: 0.7 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  titleDanger: { color: colors.destructive },
  hint: {
    ...typography.caption,
    marginTop: 1,
  },
  badge: {
    backgroundColor: colors.destructive,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

// ── Section card ──────────────────────────────────────────────────────────────

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.label}>{label}</Text>
      <View style={sectionStyles.card}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
});

function SectionDivider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />;
}

// ── Profile screen ────────────────────────────────────────────────────────────

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
  const vehicleType = me?.vehicleType ?? 'Motorcycle';
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
      <LocationPermissionBanner
        denied={locationDenied}
        onRequestPermission={requestLocationPermission}
      />

      {/* ── Profile hero ── */}
      <View style={styles.hero}>
        <Avatar name={name} />
        <Text style={styles.heroName}>{name}</Text>
        <Text style={styles.heroContact}>{email}</Text>
        {phone !== '—' ? <Text style={styles.heroContact}>{phone}</Text> : null}
        <View style={styles.heroStatus}>
          <StatusBadge shiftStatus={shiftStatus} />
        </View>
      </View>

      {/* ── Earnings summary ── */}
      <View style={styles.earningsRow}>
        <View style={styles.earnBox}>
          <Text style={styles.earnLabel}>TODAY&apos;S EARNINGS</Text>
          <Text style={[styles.earnValue, { color: colors.accentDark }]}>
            {formatCurrency(me?.todayEarnings ?? 0)}
          </Text>
        </View>
        <View style={styles.earnDivider} />
        <View style={styles.earnBox}>
          <Text style={styles.earnLabel}>ALL TIME</Text>
          <Text style={[styles.earnValue, { color: colors.primary }]}>
            {formatCurrency(me?.totalEarnings ?? 0)}
          </Text>
        </View>
      </View>

      {/* ── Account ── */}
      <MenuSection label="ACCOUNT">
        <MenuRow
          icon="person-outline"
          iconBg={colors.primaryLight}
          iconColor={colors.primary}
          title="Edit profile"
          hint="Name, address, and contact info"
          onPress={() => router.push('/profile/edit')}
        />
        <SectionDivider />
        <MenuRow
          icon="document-text-outline"
          iconBg={colors.primaryLight}
          iconColor={colors.primary}
          title="Documents"
          hint={
            compliance?.isCompliant
              ? 'All documents verified'
              : `${approvedDocs} of 4 documents approved`
          }
          onPress={() => router.push('/documents')}
        />
        <SectionDivider />
        <MenuRow
          icon="bicycle-outline"
          iconBg={colors.secondaryLight}
          iconColor={colors.secondaryDark}
          title="Vehicle info"
          hint={`${vehicleType} · Plate ${plateNumber}`}
          onPress={() => router.push('/profile/edit')}
        />
      </MenuSection>

      {/* ── Activity ── */}
      <MenuSection label="ACTIVITY">
        <MenuRow
          icon="receipt-outline"
          iconBg={colors.accentLight}
          iconColor={colors.accentDark}
          title="Task history"
          hint="Completed pickups and deliveries"
          onPress={() =>
            router.push('/(tabs)/tasks?filter=completed' as import('expo-router').Href)
          }
        />
        <SectionDivider />
        <MenuRow
          icon="bar-chart-outline"
          iconBg={colors.primaryLight}
          iconColor={colors.primary}
          title="Performance"
          hint="Completion, acceptance, and ratings"
          onPress={() => router.push('/performance')}
        />
        <SectionDivider />
        <MenuRow
          icon="wallet-outline"
          iconBg={colors.accentLight}
          iconColor={colors.accentDark}
          title="Earnings history"
          hint="Daily breakdown and totals"
          onPress={() => router.push('/earnings')}
        />
        <SectionDivider />
        <MenuRow
          icon="cash-outline"
          iconBg="#ECFDF5"
          iconColor="#059669"
          title="Wallet & withdrawals"
          hint="Balance, payouts, and remittance"
          onPress={() => router.push('/wallet' as import('expo-router').Href)}
        />
      </MenuSection>

      {/* ── More ── */}
      <MenuSection label="MORE">
        <MenuRow
          icon="notifications-outline"
          iconBg={colors.warningBg}
          iconColor={colors.warning}
          title="Notifications"
          hint="Dispatch alerts and updates"
          badge={unreadCount}
          onPress={() => router.push('/notifications')}
        />
        <SectionDivider />
        <MenuRow
          icon="help-circle-outline"
          iconBg={colors.surfaceMuted}
          iconColor={colors.slate700}
          title="Help & support"
          hint="FAQs, contact dispatch, and SOS"
          onPress={() => router.push('/support')}
        />
        <SectionDivider />
        <MenuRow
          icon="log-out-outline"
          iconBg="#FEF2F2"
          iconColor={colors.destructive}
          title="Sign out"
          danger
          onPress={handleLogout}
        />
      </MenuSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  heroContact: {
    ...typography.bodySm,
    marginTop: spacing.xs,
  },
  heroStatus: {
    marginTop: spacing.md,
  },

  // ── Earnings ──
  earningsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  earnBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  earnDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  earnLabel: { ...typography.label },
  earnValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: spacing.xs,
    letterSpacing: -0.3,
  },
});
