import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomerMessageBadge } from '../../hooks/use-customer-message-badge';
import { resolveMediaUrl } from '../../lib/media-url';
import { useAuthStore } from '../../store/auth';
import { NotificationBell } from '../notifications-preview';
import { brandName, colors, spacing, typography } from '../../theme';
import { BrandMark } from './brand-mark';

const AVATAR_SIZE = 32;

/** Small account button — mirrors customer-web's header avatar (photo when set, e.g. from Google
 * sign-in, else initials) and opens the Profile tab. Fetched once per header mount; the Profile
 * tab itself is the source of truth for keeping it in sync after an upload. */
function AccountAvatarButton() {
  const router = useRouter();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const user = useAuthStore((s) => s.user);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ avatarUrl?: string }>('/customers/me')
      .then((profile) => {
        if (!cancelled) setAvatarUrl(profile.avatarUrl ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const imageUri = resolveMediaUrl(avatarUrl);
  const initial = (user?.email?.trim() || user?.phone?.trim() || 'C').charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/profile')}
      hitSlop={12}
      style={styles.avatarBtn}
      accessibilityRole="button"
      accessibilityLabel="Your profile"
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
    </Pressable>
  );
}

function MessagesBell() {
  const router = useRouter();
  const unreadCount = useCustomerMessageBadge();

  return (
    <Pressable
      onPress={() => router.push('/messages')}
      hitSlop={12}
      style={styles.bellBtn}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
      {unreadCount > 0 ? (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

interface AppHeaderProps {
  subtitle?: string;
}

/** Branded tab header — mirrors rider-mobile's AppHeader (brand mark + wordmark + notification
 * bell) so the customer app reads as the same product family instead of a generic native-stack
 * title bar. `subtitle` carries the current tab's title (e.g. "Home", "Orders"). */
export function AppHeader({ subtitle }: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.brandRow}>
        <BrandMark size="sm" />
        <View style={styles.wordmarkBlock}>
          <Text style={styles.wordmark} numberOfLines={1}>
            {brandName.toUpperCase()}
          </Text>
          {subtitle ? (
            <Text style={styles.wordmarkSub} numberOfLines={1}>
              {subtitle.toUpperCase()}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <MessagesBell />
        <NotificationBell />
        <AccountAvatarButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  wordmarkBlock: { flexShrink: 1 },
  wordmark: { ...typography.subheading, fontSize: 16, color: colors.primary, letterSpacing: 0.5 },
  wordmarkSub: { ...typography.label, fontSize: 10 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  bellBtn: {
    marginRight: spacing.md,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    paddingHorizontal: 4,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  bellBadgeText: { color: colors.onPrimary, fontSize: 9, fontWeight: '700' },
  avatarBtn: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: colors.border },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.onPrimary, fontSize: 13, fontWeight: '700' },
});
