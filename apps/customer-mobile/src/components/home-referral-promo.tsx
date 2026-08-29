import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { appConfig, getShareWebsiteUrl } from '@lunara/config';
import { buildAppSharePayload, buildReferralSharePayload } from '@lunara/utils';
import { useAuthStore } from '../store/auth';
import { SocialShareButtons } from './social-share-buttons';
import { Card } from './ui/card';
import { colors, radius, spacing, typography } from '../theme';

export function HomeReferralPromo() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ referralCode: string }>('/rewards/me/referral-code')
      .then((res) => {
        if (!cancelled) setReferralCode(res.referralCode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const payload = referralCode
    ? buildReferralSharePayload(referralCode, getShareWebsiteUrl(), appConfig.name)
    : buildAppSharePayload(getShareWebsiteUrl(), appConfig.name);

  return (
    <Card style={styles.card}>
      <View style={styles.glow} />

      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="gift" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Refer & earn</Text>
          <Text style={styles.body} numberOfLines={2}>
            You both earn points when they finish their first order.
          </Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsValue}>100</Text>
          <Text style={styles.pointsUnit}>PTS</Text>
        </View>
      </View>

      {referralCode ? (
        <View style={styles.codeChip}>
          <Text style={styles.codeLabel}>YOUR CODE</Text>
          <Text style={styles.code}>{referralCode}</Text>
        </View>
      ) : null}

      <SocialShareButtons payload={payload} compact />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.xxl,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    gap: spacing.md,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    top: -60,
    right: -40,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { ...typography.subheading, fontSize: 16, color: colors.primaryDark },
  body: { ...typography.bodySm, marginTop: 2 },
  pointsBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  pointsValue: { fontSize: 16, fontWeight: '800', color: colors.primary },
  pointsUnit: { fontSize: 9, fontWeight: '700', color: colors.mutedForeground, letterSpacing: 0.5 },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
  },
  codeLabel: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground, letterSpacing: 0.4 },
  code: { fontSize: 14, fontWeight: '800', color: colors.primaryDark, letterSpacing: 1 },
});
