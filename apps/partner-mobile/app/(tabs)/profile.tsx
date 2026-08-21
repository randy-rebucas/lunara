import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PartnerOwnProfile } from '@lunara/types';
import { Screen } from '../../src/components/ui/screen';
import { useOwnBranch } from '../../src/hooks/use-own-branch';
import { partnerFetch, partnerUpload } from '../../src/api';
import { pickAvatarPhoto } from '../../src/lib/avatar-photo';
import { useAuthStore } from '../../src/store/auth';
import { colors, radius, shadow, spacing, typography } from '../../src/theme';

function Avatar({ name, avatarUrl, uploading }: { name: string; avatarUrl?: string; uploading: boolean }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View style={avatarStyles.wrap}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={avatarStyles.image} />
      ) : (
        <Text style={avatarStyles.text}>{initials || '?'}</Text>
      )}
      {uploading ? (
        <View style={avatarStyles.overlay}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <View style={avatarStyles.editBadge}>
          <Ionicons name="camera" size={13} color="#fff" />
        </View>
      )}
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
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  text: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.foreground,
    borderWidth: 2,
    borderColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { branch } = useOwnBranch();
  const [profile, setProfile] = useState<PartnerOwnProfile | null>(null);
  const [uploading, setUploading] = useState(false);

  const email = user?.email ?? '—';
  const role = user?.role ?? 'staff';
  const name = profile?.displayName || (email !== '—' ? email.split('@')[0] : 'Partner staff');

  useEffect(() => {
    partnerFetch<PartnerOwnProfile>('/partner/profile')
      .then(setProfile)
      .catch(() => {});
  }, []);

  function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  async function uploadFrom(source: 'camera' | 'library') {
    const picked = await pickAvatarPhoto(source);
    if (!picked) return;
    setUploading(true);
    try {
      const updated = await partnerUpload<PartnerOwnProfile>('/partner/profile/avatar', picked.formData);
      setProfile(updated);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setUploading(true);
    try {
      const updated = await partnerFetch<PartnerOwnProfile>('/partner/profile/avatar', { method: 'DELETE' });
      setProfile(updated);
    } catch (e) {
      Alert.alert('Failed to remove photo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleAvatarPress() {
    if (uploading) return;
    const options = [
      { text: 'Take photo', onPress: () => void uploadFrom('camera') },
      { text: 'Choose from library', onPress: () => void uploadFrom('library') },
      ...(profile?.avatarUrl
        ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => void removePhoto() }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert('Profile photo', undefined, options);
  }

  return (
    <Screen inTab>
      <View style={styles.hero}>
        <Pressable onPress={handleAvatarPress} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <Avatar name={name} avatarUrl={profile?.avatarUrl} uploading={uploading} />
        </Pressable>
        <Text style={styles.heroName}>{name}</Text>
        <Text style={styles.heroContact}>{email}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{role}</Text>
        </View>
      </View>

      {branch ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BRANCH</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="storefront-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{branch.name}</Text>
                <Text style={styles.branchSubtitle}>
                  {branch.city}, {branch.province}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={handleLogout}
            accessibilityRole="button"
          >
            <View style={[styles.iconWrap, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
            </View>
            <Text style={[styles.rowTitle, { color: colors.destructive }]}>Sign out</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.destructive} />
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.lg },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
    textTransform: 'capitalize',
  },
  heroContact: { ...typography.bodySm, marginTop: spacing.xs },
  rolePill: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    textTransform: 'capitalize',
  },
  section: { marginBottom: spacing.lg },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
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
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.foreground },
  branchSubtitle: { ...typography.bodySm, marginTop: 2 },
});
