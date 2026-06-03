import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageStyle,
  StyleSheet,
  Text,
  View,
  type StyleProp,
} from 'react-native';
import { downloadAsync, cacheDirectory, getInfoAsync } from 'expo-file-system/legacy';
import { resolveMediaUrl } from '../lib/media-url';
import { getQueueItems } from '../lib/offline/queue-store';
import { useAuthStore } from '../store/auth';
import { colors, typography } from '../theme';

function pathNeedsAuth(path: string) {
  return path.includes('/uploads/rider-documents/') || path.includes('/uploads/task-photos/');
}

function cachePathForMedia(path: string) {
  const filename = path.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') ?? 'media.jpg';
  return `${cacheDirectory ?? ''}lunara-media-${filename}`;
}

interface AuthenticatedImageProps {
  path?: string | null;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

export function AuthenticatedImage({ path, style, accessibilityLabel }: AuthenticatedImageProps) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setFailed(false);
      setUri(null);

      if (!path) return;

      if (path.startsWith('file://')) {
        setUri(path);
        return;
      }

      if (path.startsWith('pending://')) {
        const orderId = path.replace('pending://', '').replace(/-photo$/, '');
        const items = await getQueueItems();
        const queued = items.find((i) => i.kind === 'photo' && i.orderId === orderId);
        if (queued?.kind === 'photo' && queued.localUri) {
          setUri(queued.localUri);
          return;
        }
        setFailed(true);
        return;
      }

      const remoteUrl = resolveMediaUrl(path);
      if (!remoteUrl) {
        setFailed(true);
        return;
      }

      if (!pathNeedsAuth(path)) {
        setUri(remoteUrl);
        return;
      }

      const token = useAuthStore.getState().tokens?.accessToken;
      const dest = cachePathForMedia(path);

      try {
        const cached = await getInfoAsync(dest);
        if (cached.exists) {
          if (!cancelled) setUri(dest);
          return;
        }

        const result = await downloadAsync(
          remoteUrl,
          dest,
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
        );

        if (!cancelled) {
          if (result.status >= 200 && result.status < 300) {
            setUri(result.uri);
          } else {
            setFailed(true);
          }
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) return null;

  if (failed) {
    return (
      <View style={[style, styles.placeholder]}>
        <Text style={styles.placeholderText}>Photo unavailable — pull to refresh</Text>
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={[style, styles.placeholder]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      accessibilityLabel={accessibilityLabel}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  placeholderText: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
