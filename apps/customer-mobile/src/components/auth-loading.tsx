import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { brandName, colors, radius, spacing, typography } from '../theme';

const BUBBLES = [
  { size: 16, left: '12%', delay: 0, duration: 3400 },
  { size: 9, left: '24%', delay: 700, duration: 2800 },
  { size: 12, left: '80%', delay: 300, duration: 3100 },
  { size: 20, left: '90%', delay: 1100, duration: 3600 },
  { size: 8, left: '52%', delay: 1500, duration: 2600 },
  { size: 14, left: '38%', delay: 1900, duration: 3300 },
  { size: 11, left: '68%', delay: 500, duration: 3000 },
] as const;

function Bubble({ size, left, delay, duration }: (typeof BUBBLES)[number]) {
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(rise, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [rise, delay, duration]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -520] });
  const translateX = rise.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 12, -8] });
  const opacity = rise.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.9, 0.5, 0] });

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left,
          opacity,
          transform: [{ translateY }, { translateX }],
        },
      ]}
    />
  );
}

export function AuthLoadingScreen() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [progress]);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['15%', '100%'] });

  return (
    <View style={styles.wrap}>
      <Image
        source={require('../../assets/lunara-logo.png')}
        style={styles.bg}
        resizeMode="cover"
        accessibilityLabel={brandName}
      />

      <View style={styles.bubbleField} pointerEvents="none">
        {BUBBLES.map((b, i) => (
          <Bubble key={i} {...b} />
        ))}
      </View>

      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading…</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.primaryLight,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  bubbleField: {
    ...StyleSheet.absoluteFillObject,
  },
  bubble: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  loadingWrap: {
    position: 'absolute',
    bottom: spacing.xxxl + spacing.lg,
    left: spacing.xxl,
    right: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
});
