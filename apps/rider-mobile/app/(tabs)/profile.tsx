import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AttendanceRecordView } from '@lunara/types';
import { ComplianceBanner } from '../../src/components/compliance-banner';
import { useRiderOperations } from '../../src/context/rider-operations';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { LocationPermissionBanner } from '../../src/components/ui/location-permission-banner';
import { Screen } from '../../src/components/ui/screen';
import { StatusBadge } from '../../src/components/ui/status-badge';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import { pickRiderAvatar, type AvatarSource } from '../../src/lib/rider-avatar';
import type { RiderMe } from '../../src/lib/rider-types';
import { riderFetch } from '../../src/api';
import { useAuthStore } from '../../src/store/auth';
import { colors, radius, shadow, spacing, typography } from '../../src/theme';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Attendance ("am I on the clock") is intentionally separate from shift status ("am I
 * receiving assignments") — see AttendanceRecord schema notes on the API side. */
function AttendanceCard() {
  const [current, setCurrent] = useState<AttendanceRecordView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await riderFetch<AttendanceRecordView | null>('/attendance/me/current');
      setCurrent(res);
    } catch {
      setCurrent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function clockIn() {
    setBusy(true);
    try {
      await riderFetch('/attendance/clock-in', { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (e) {
      Alert.alert('Could not clock in', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    setBusy(true);
    try {
      await riderFetch('/attendance/clock-out', { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (e) {
      Alert.alert('Could not clock out', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.label}>ATTENDANCE</Text>
      <Card style={attendanceStyles.card}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <View style={attendanceStyles.row}>
              <View
                style={[
                  attendanceStyles.dot,
                  { backgroundColor: current ? colors.accent : colors.mutedForeground },
                ]}
              />
              <Text style={attendanceStyles.status}>{current ? 'Clocked in' : 'Not clocked in'}</Text>
            </View>
            <Text style={attendanceStyles.hint}>
              {current ? `Since ${formatTime(current.clockInAt)}` : 'Clock in to start your shift.'}
            </Text>
            <Button
              label={current ? 'Clock out' : 'Clock in'}
              variant={current ? 'outline' : 'primary'}
              disabled={busy}
              onPress={current ? clockOut : clockIn}
              style={attendanceStyles.button}
            />
          </>
        )}
      </Card>
    </View>
  );
}

const attendanceStyles = StyleSheet.create({
  card: { alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  hint: { ...typography.caption, marginTop: spacing.xs, marginBottom: spacing.md },
  button: { alignSelf: 'stretch' },
});

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const AVATAR_SIZE = 64;

// ── Avatar ────────────────────────────────────────────────────────────────────

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  uploading: boolean;
  onPress: () => void;
}

function Avatar({ name, avatarUrl, uploading, onPress }: AvatarProps) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <Pressable
      onPress={onPress}
      disabled={uploading}
      style={avatarStyles.wrap}
      accessibilityRole="button"
      accessibilityLabel={uploading ? 'Uploading profile photo' : 'Change profile photo'}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={avatarStyles.image} />
      ) : (
        <View style={avatarStyles.fallback}>
          <Text style={avatarStyles.text}>{initials || '?'}</Text>
        </View>
      )}
      <View style={avatarStyles.editBadge}>
        {uploading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="camera" size={12} color="#fff" />
        )}
      </View>
    </Pressable>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginBottom: spacing.md,
  },
  image: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.border,
  },
  fallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
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
    refresh,
    handleLogout,
    locationDenied,
    requestLocationPermission,
  } = useRiderOperations();
  const apiUpload = useAuthStore((s) => s.apiUpload);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const email = authUser?.email ?? me?.user?.email ?? '—';
  const phone = me?.user?.phone ?? '—';
  const vehicleType = me?.vehicleType ?? 'Motorcycle';
  const plateNumber = me?.plateNumber ?? '—';
  const compliance = me?.compliance;

  async function uploadAvatar(source: AvatarSource) {
    try {
      const file = await pickRiderAvatar(source);
      if (!file) return;
      setAvatarUploading(true);
      await apiUpload<RiderMe>('/riders/me/avatar', file);
      await refresh();
    } catch (e) {
      Alert.alert(
        'Upload failed',
        e instanceof Error ? e.message : 'Could not upload your photo. Check your connection and try again.',
      );
    } finally {
      setAvatarUploading(false);
    }
  }

  function handleAvatarPress() {
    if (avatarUploading) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) uploadAvatar('camera');
          if (index === 2) uploadAvatar('library');
        },
      );
      return;
    }

    Alert.alert('Update profile photo', undefined, [
      { text: 'Take Photo', onPress: () => uploadAvatar('camera') },
      { text: 'Choose from Library', onPress: () => uploadAvatar('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

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
        <Avatar
          name={name}
          avatarUrl={me?.avatarUrl}
          uploading={avatarUploading}
          onPress={handleAvatarPress}
        />
        <Text style={styles.heroName}>{name}</Text>
        <Text style={styles.heroContact}>{email}</Text>
        {phone !== '—' ? <Text style={styles.heroContact}>{phone}</Text> : null}
        <View style={styles.heroStatus}>
          <StatusBadge shiftStatus={shiftStatus} />
        </View>
      </View>

      <AttendanceCard />

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
          icon="cash-outline"
          iconBg={colors.surfaceMuted}
          iconColor={colors.mutedForeground}
          title="Pay & payouts"
          hint="Managed by your shop, not through this app"
          onPress={() => {}}
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
});
