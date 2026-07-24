import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet } from 'react-native';
import { radius, spacing } from '../theme';
import { useAuthStore } from '../store/auth';

interface Banner {
  _id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
}

export function BannerStrip() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    apiFetch<Banner[]>('/banners')
      .then(setBanners)
      .catch(() => {});
  }, [apiFetch]);

  if (banners.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {banners.map((b) => (
        <Pressable
          key={b._id}
          disabled={!b.linkUrl}
          onPress={() => b.linkUrl && Linking.openURL(b.linkUrl)}
          style={styles.card}
        >
          <Image source={{ uri: b.imageUrl }} style={styles.image} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingBottom: spacing.xs },
  card: { width: 280, height: 120, borderRadius: radius.lg, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
