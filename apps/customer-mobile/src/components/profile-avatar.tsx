import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { resolveMediaUrl } from '../lib/media-url';
import { colors, shadow, spacing, typography } from '../theme';

interface ProfileAvatarProps {
  name: string;
  avatarUrl?: string | null;
  uploading: boolean;
  onUpload: (formData: FormData) => Promise<void>;
}

const AVATAR_SIZE = 88;

export function ProfileAvatar({ name, avatarUrl, uploading, onUpload }: ProfileAvatarProps) {
  const [picking, setPicking] = useState(false);
  const imageUri = resolveMediaUrl(avatarUrl);
  const initial = name.charAt(0).toUpperCase();

  async function pickAndUpload() {
    if (uploading || picking) return;

    setPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photos access needed',
          'Allow photo library access to choose a profile picture.',
        );
        return;
      }

      // No native crop step: Android's system Photo Picker doesn't support one, and the
      // legacy picker's crop screen doesn't account for edge-to-edge system bars, leaving
      // its Done/Cancel buttons hidden underneath them. The avatar is displayed in a fixed
      // circular frame with cover fill, so an uncropped image still looks correct.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('avatar', {
        uri: asset.uri,
        name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob);

      await onUpload(formData);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload photo');
    } finally {
      setPicking(false);
    }
  }

  const busy = uploading || picking;

  return (
    <Pressable
      onPress={pickAndUpload}
      disabled={busy}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={busy ? 'Uploading profile photo' : 'Change profile photo'}
    >
      <View style={styles.avatarShell}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}
        <View style={styles.editBadge}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="camera" size={14} color={colors.onPrimary} />
          )}
        </View>
      </View>
      <Text style={styles.hint}>{busy ? 'Uploading…' : 'Change photo'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing.md },
  avatarShell: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    position: 'relative',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  avatarText: { color: colors.onPrimary, fontSize: 32, fontWeight: '700' },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  hint: { ...typography.caption, marginTop: spacing.sm, color: colors.primary, fontWeight: '600' },
});
