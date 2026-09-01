import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from 'react-native';
import { INTRO_SLIDES, type IntroSlide } from '../lib/intro-slides';
import { markIntroSeen } from '../lib/intro-slider';
import { brandName } from '../theme';
import { Button } from './ui/button';
import { colors, radius, spacing, typography } from '../theme';

interface IntroSliderProps {
  onDone: () => void;
}

const BUBBLE_COUNT = 12;

interface BubbleConfig {
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  sway: number;
  drift: number;
}

function makeBubbles(): BubbleConfig[] {
  return Array.from({ length: BUBBLE_COUNT }, (_, i) => {
    const seed = (i * 37) % 100;
    const seed2 = (i * 53) % 100;
    return {
      left: `${(seed * 0.9 + (i % 3) * 6) % 92}%`,
      top: `${(seed2 * 0.85 + (i % 4) * 5) % 88}%`,
      size: 26 + (seed % 5) * 9,
      duration: 4200 + (seed % 6) * 650,
      delay: (seed % 8) * 240,
      opacity: 0.35 + (seed % 4) * 0.08,
      sway: (seed % 2 === 0 ? 1 : -1) * (8 + (seed % 14)),
      drift: 18 + (seed2 % 20),
    };
  });
}

function Bubble({ config }: { config: BubbleConfig }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: config.duration,
        delay: config.delay,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [config, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -config.drift, 0],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, config.sway, 0],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [config.opacity * 0.4, config.opacity, config.opacity, config.opacity * 0.4],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.9, 1.08, 0.9],
  });

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          left: config.left,
          top: config.top,
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        },
      ]}
    >
      <View style={[styles.bubbleGlint, { width: config.size * 0.32, height: config.size * 0.32 }]} />
    </Animated.View>
  );
}

function IntroBubbles() {
  const bubbles = useMemo(() => makeBubbles(), []);
  return (
    <View style={styles.bubbleField} pointerEvents="none">
      {bubbles.map((config, i) => (
        <Bubble key={i} config={config} />
      ))}
    </View>
  );
}

export function IntroSlider({ onDone }: IntroSliderProps) {
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<IntroSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isLastSlide = activeIndex === INTRO_SLIDES.length - 1;

  async function finish() {
    await markIntroSeen();
    onDone();
  }

  function goNext() {
    if (isLastSlide) {
      void finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
  }

  function handleMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setActiveIndex(Math.max(0, Math.min(index, INTRO_SLIDES.length - 1)));
  }

  const renderItem: ListRenderItem<IntroSlide> = ({ item }) => (
    <View style={[styles.slide, { width: screenWidth }]}>
      <IntroBubbles />
      <View style={styles.iconWrap}>
        <Ionicons name={item.icon} size={56} color={colors.primary} />
      </View>
      <Text style={styles.title}>{item.key === 'welcome' ? `${item.title} to ${brandName}` : item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <Modal
      visible
      animationType="fade"
      transparent={false}
      onRequestClose={() => void finish()}
    >
      <View style={styles.wrap}>
        <Pressable
          onPress={() => void finish()}
          style={styles.skipBtn}
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          hitSlop={12}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <FlatList
          ref={listRef}
          data={INTRO_SLIDES}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          style={styles.list}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {INTRO_SLIDES.map((slide, index) => (
              <View key={slide.key} style={[styles.dot, index === activeIndex && styles.dotActive]} />
            ))}
          </View>

          <Button
            label={isLastSlide ? 'Get started' : 'Next'}
            size="lg"
            style={styles.nextBtn}
            onPress={goNext}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  skipBtn: {
    position: 'absolute',
    top: spacing.xxl,
    right: spacing.xl,
    zIndex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  skipText: {
    ...typography.body,
    color: colors.muted,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    overflow: 'hidden',
  },
  bubbleField: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
  },
  bubbleGlint: {
    position: 'absolute',
    top: '18%',
    left: '18%',
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
    opacity: 0.7,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm - 2,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.primary,
  },
  nextBtn: {
    width: '100%',
  },
});
