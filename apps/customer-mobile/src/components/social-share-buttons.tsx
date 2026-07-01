import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SharePayload, SocialPlatform } from '@lunara/utils';
import { SOCIAL_SHARE_OPTIONS } from '@lunara/utils';
import { openSocialShare, shareNative } from '../lib/share';
import { Card } from './ui/card';
import { colors, radius, spacing, typography } from '../theme';

const PLATFORM_ICONS: Record<SocialPlatform, keyof typeof Ionicons.glyphMap> = {
  whatsapp: 'logo-whatsapp',
  facebook: 'logo-facebook',
  x: 'logo-twitter',
};

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  whatsapp: '#25D366',
  facebook: '#1877F2',
  x: '#0F172A',
};

interface SocialShareButtonsProps {
  payload: SharePayload;
  compact?: boolean;
}

export function SocialShareButtons({ payload, compact = false }: SocialShareButtonsProps) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {SOCIAL_SHARE_OPTIONS.map((option) => (
        <Pressable
          key={option.id}
          style={({ pressed }) => [styles.chip, compact && styles.chipCompact, pressed && styles.chipPressed]}
          onPress={() => openSocialShare(option.id, payload)}
          accessibilityRole="button"
          accessibilityLabel={`Share on ${option.label}`}
          hitSlop={4}
        >
          <View style={[styles.iconWrap, { backgroundColor: PLATFORM_COLORS[option.id] }]}>
            <Ionicons name={PLATFORM_ICONS[option.id]} size={compact ? 16 : 18} color="#fff" />
          </View>
          {!compact ? <Text style={styles.chipLabel}>{option.label}</Text> : null}
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [styles.chip, compact && styles.chipCompact, pressed && styles.chipPressed]}
        onPress={() => shareNative(payload)}
        accessibilityRole="button"
        accessibilityLabel="Share with other apps"
        hitSlop={4}
      >
        <View style={[styles.iconWrap, styles.moreIcon]}>
          <Ionicons name="share-social-outline" size={compact ? 16 : 18} color={colors.primary} />
        </View>
        {!compact ? <Text style={styles.chipLabel}>More</Text> : null}
      </Pressable>
    </View>
  );
}

interface ShareInviteCardProps {
  payload: SharePayload;
  title?: string;
  description?: string;
}

export function ShareInviteCard({
  payload,
  title = 'Share Lunara',
  description = 'Tell friends about pickup & delivery laundry in Metro Manila.',
}: ShareInviteCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIcon}>
          <Ionicons name="people-outline" size={16} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardBody}>{description}</Text>
      <SocialShareButtons payload={payload} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rowCompact: {
    gap: spacing.xs + 2,
  },
  chip: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 64,
  },
  chipCompact: {
    minWidth: 40,
  },
  chipPressed: { opacity: 0.85 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreIcon: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  card: {
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...typography.subheading, fontSize: 16 },
  cardBody: { ...typography.bodySm },
});
