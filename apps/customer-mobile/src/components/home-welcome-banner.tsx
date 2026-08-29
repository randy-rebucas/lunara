import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from './ui/card';
import { getDisplayName, getTimeOfDayGreeting } from '../lib/home-greeting';
import type { CustomerProfile } from '../lib/profile-types';
import { colors, radius, spacing, typography } from '../theme';

interface HomeWelcomeBannerProps {
  profile: CustomerProfile | null;
  user: { email?: string; phone?: string } | null;
}

function getInitials(profile: CustomerProfile | null, fallbackName: string): string {
  const first = profile?.firstName?.trim()?.[0];
  const last = profile?.lastName?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  return fallbackName.slice(0, 2).toUpperCase();
}

export function HomeWelcomeBanner({ profile, user }: HomeWelcomeBannerProps) {
  const router = useRouter();
  const name = getDisplayName({
    firstName: profile?.firstName,
    lastName: profile?.lastName,
    email: user?.email,
    phone: user?.phone,
  });
  const initials = getInitials(profile, name);
  const hasPoints = typeof profile?.loyaltyPoints === 'number';

  return (
    <Card elevated style={styles.banner}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.row}>
        {profile?.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}

        <View style={styles.textCol}>
          <Text style={styles.greeting} numberOfLines={1}>
            {getTimeOfDayGreeting()}, <Text style={styles.name}>{name}</Text>
          </Text>
          <Text style={styles.sub}>Fresh clothes, happy you. We handle the rest.</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.pointsRow, pressed && styles.pointsRowPressed]}
        onPress={() => router.push('/rewards')}
        accessibilityRole="button"
        accessibilityLabel={hasPoints ? `${profile?.loyaltyPoints} loyalty points, view rewards` : 'View rewards'}
      >
        <View style={styles.pointsLeft}>
          <View style={styles.pointsIconWrap}>
            <Ionicons name="star" size={13} color={colors.star} />
          </View>
          <Text style={styles.pointsText}>
            {hasPoints ? `${profile!.loyaltyPoints} pts` : 'Rewards'}
          </Text>
          <Text style={styles.pointsHint}>{hasPoints ? '· tap to redeem' : '· start earning'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
    borderWidth: 0,
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
    gap: spacing.lg,
  },
  glowTop: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    top: -60,
    right: -40,
  },
  glowBottom: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
    bottom: -70,
    left: -50,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarText: { color: colors.onPrimary, fontWeight: '800', fontSize: 17 },
  textCol: { flex: 1 },
  greeting: { ...typography.title, fontSize: 20, color: colors.primaryDark },
  name: { fontWeight: '800' },
  sub: { ...typography.bodySm, marginTop: spacing.xs - 2, color: colors.slate700 },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  pointsRowPressed: { opacity: 0.85 },
  pointsLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  pointsIconWrap: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  pointsHint: { fontSize: 12, color: colors.mutedForeground },
});
