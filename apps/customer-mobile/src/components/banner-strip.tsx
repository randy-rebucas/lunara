import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { useAuthStore } from '../store/auth';

interface Banner {
  _id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
}

const SCREEN_PADDING = spacing.xl;
const CARD_HEIGHT = 120;

function chunkPairs<T>(items: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }
  return pairs;
}

export function BannerStrip() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [banners, setBanners] = useState<Banner[]>([]);
  const { width: windowWidth } = useWindowDimensions();

  useEffect(() => {
    apiFetch<Banner[]>('/banners')
      .then(setBanners)
      .catch(() => {});
  }, [apiFetch]);

  if (banners.length === 0) return null;

  const slideWidth = windowWidth - SCREEN_PADDING * 2;
  const cardWidth = (slideWidth - spacing.sm) / 2;
  const slides = chunkPairs(banners);

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={slideWidth}
      snapToAlignment="start"
      style={styles.container}
      contentContainerStyle={styles.track}
    >
      {slides.map((pair, index) => (
        <View key={index} style={[styles.slide, { width: slideWidth }]}>
          {pair.map((b) => (
            <Pressable
              key={b._id}
              disabled={!b.linkUrl}
              onPress={() => b.linkUrl && Linking.openURL(b.linkUrl)}
              style={[styles.card, { width: cardWidth }]}
              accessibilityRole={b.linkUrl ? 'button' : 'image'}
              accessibilityLabel={b.title}
            >
              <Image source={{ uri: b.imageUrl }} style={styles.image} resizeMode="contain" />
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.xl },
  track: { paddingBottom: spacing.xs },
  slide: { flexDirection: 'row', gap: spacing.sm },
  card: {
    height: CARD_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  image: { width: '100%', height: '100%' },
});
