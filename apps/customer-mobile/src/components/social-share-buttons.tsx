import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SharePayload, SocialPlatform } from '@lunara/utils';
import { SOCIAL_SHARE_OPTIONS } from '@lunara/utils';
import { openSocialShare, shareNative } from '../lib/share';
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
          style={[styles.chip, compact && styles.chipCompact]}
          onPress={() => openSocialShare(option.id, payload)}
          accessibilityLabel={`Share on ${option.label}`}
        >
          <View style={[styles.iconWrap, { backgroundColor: PLATFORM_COLORS[option.id] }]}>
            <Ionicons name={PLATFORM_ICONS[option.id]} size={compact ? 16 : 18} color="#fff" />
          </View>
          {!compact ? <Text style={styles.chipLabel}>{option.label}</Text> : null}
        </Pressable>
      ))}
      <Pressable
        style={[styles.chip, compact && styles.chipCompact]}
        onPress={() => shareNative(payload)}
        accessibilityLabel="Share with other apps"
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
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{description}</Text>
      <SocialShareButtons payload={payload} />
    </View>
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
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { ...typography.subheading, fontSize: 16 },
  cardBody: { ...typography.bodySm },
});
