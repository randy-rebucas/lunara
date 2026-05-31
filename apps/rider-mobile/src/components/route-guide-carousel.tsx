import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from 'react-native';
import { Card } from './ui/card';
import { colors, radius, spacing, typography } from '../theme';

export const ROUTE_GUIDE_STEPS = [
  {
    title: 'Sign in',
    description: 'Open the rider app and sign in with your Lunara account.',
  },
  {
    title: 'Start shift',
    description: 'Tap Start shift to go online and become visible to dispatch.',
  },
  {
    title: 'Get assignment',
    description: 'Pickup offers and delivery queue items appear while you are on shift.',
  },
  {
    title: 'Accept task',
    description: 'Accept a pickup or open an assigned delivery to begin the workflow.',
  },
  {
    title: 'Complete route',
    description: 'Follow each pickup and delivery step until the order is finished.',
  },
] as const;

type RouteGuideStep = (typeof ROUTE_GUIDE_STEPS)[number];

const AUTO_ADVANCE_MS = 4500;
const STEP_COUNT = ROUTE_GUIDE_STEPS.length;
const LOOP_COPIES = 3;
const MIDDLE_COPY = 1;

const LOOPED_SLIDES: RouteGuideStep[] = Array.from({ length: LOOP_COPIES }, () => [
  ...ROUTE_GUIDE_STEPS,
]).flat();

function toRealIndex(listIndex: number): number {
  return ((listIndex % STEP_COUNT) + STEP_COUNT) % STEP_COUNT;
}

function toMiddleListIndex(realIndex: number): number {
  return MIDDLE_COPY * STEP_COUNT + realIndex;
}

interface RouteGuideCarouselProps {
  progressIndex: number;
}

export function RouteGuideCarousel({ progressIndex }: RouteGuideCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<RouteGuideStep>>(null);
  const listIndexRef = useRef(toMiddleListIndex(progressIndex));
  const pauseUntilRef = useRef(0);
  const slideWidth = screenWidth - spacing.xl * 2 - spacing.lg * 2;
  const [activeIndex, setActiveIndex] = useState(progressIndex);

  const scrollToListIndex = useCallback(
    (listIndex: number, animated = true) => {
      listIndexRef.current = listIndex;
      listRef.current?.scrollToOffset({ offset: slideWidth * listIndex, animated });
      setActiveIndex(toRealIndex(listIndex));
    },
    [slideWidth],
  );

  const recenterIfNeeded = useCallback(
    (listIndex: number) => {
      const copy = Math.floor(listIndex / STEP_COUNT);
      if (copy === MIDDLE_COPY) {
        listIndexRef.current = listIndex;
        return listIndex;
      }

      const realIndex = toRealIndex(listIndex);
      const centered = toMiddleListIndex(realIndex);
      listIndexRef.current = centered;
      listRef.current?.scrollToOffset({ offset: slideWidth * centered, animated: false });
      return centered;
    },
    [slideWidth],
  );

  useEffect(() => {
    scrollToListIndex(toMiddleListIndex(progressIndex), false);
  }, [progressIndex, scrollToListIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return;
      scrollToListIndex(listIndexRef.current + 1);
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(timer);
  }, [scrollToListIndex]);

  function handleMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const listIndex = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    const clamped = Math.max(0, Math.min(listIndex, LOOPED_SLIDES.length - 1));
    const centered = recenterIfNeeded(clamped);
    setActiveIndex(toRealIndex(centered));
    pauseUntilRef.current = Date.now() + AUTO_ADVANCE_MS;
  }

  function handleDotPress(realIndex: number) {
    scrollToListIndex(toMiddleListIndex(realIndex));
    pauseUntilRef.current = Date.now() + AUTO_ADVANCE_MS;
  }

  const renderItem: ListRenderItem<RouteGuideStep> = ({ item, index }) => {
    const realIndex = toRealIndex(index);
    const done = realIndex < progressIndex;
    const current = realIndex === progressIndex;
    const active = realIndex === activeIndex;

    return (
      <View style={[styles.slide, { width: slideWidth }]}>
        <View style={styles.slideHeader}>
          <Text style={styles.stepCount}>
            Step {realIndex + 1} of {STEP_COUNT}
          </Text>
          {current ? (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Up next</Text>
            </View>
          ) : done ? (
            <View style={styles.doneBadge}>
              <Text style={styles.doneBadgeText}>Done</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.slideBody}>
          <View
            style={[
              styles.stepCircle,
              done && styles.stepCircleDone,
              current && styles.stepCircleCurrent,
              active && !done && !current && styles.stepCircleFocused,
            ]}
          >
            <Text
              style={[
                styles.stepCircleText,
                (done || current) && styles.stepCircleTextOn,
                active && !done && !current && styles.stepCircleTextFocused,
              ]}
            >
              {done ? '✓' : realIndex + 1}
            </Text>
          </View>
          <Text style={[styles.slideTitle, active && styles.slideTitleActive]}>{item.title}</Text>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </View>
      </View>
    );
  };

  const progressPercent = ((progressIndex + 1) / STEP_COUNT) * 100;

  return (
    <Card muted style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Route guide</Text>
        <Text style={styles.hint}>Loops · swipe to browse</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${progressPercent}%` }]} />
      </View>

      <FlatList
        ref={listRef}
        data={LOOPED_SLIDES}
        keyExtractor={(_, index) => `route-guide-${index}`}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: slideWidth,
          offset: slideWidth * index,
          index,
        })}
      />

      <View style={styles.dots}>
        {ROUTE_GUIDE_STEPS.map((step, index) => (
          <Pressable
            key={step.title}
            onPress={() => handleDotPress(index)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Go to step ${index + 1}: ${step.title}`}
          >
            <View style={[styles.dot, index === activeIndex && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg, borderWidth: 0, paddingBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...typography.label },
  hint: { ...typography.caption },
  track: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  trackFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  slide: {
    minHeight: 148,
  },
  slideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepCount: { ...typography.bodySm },
  currentBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  doneBadge: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  doneBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentDark,
  },
  slideBody: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  stepCircleDone: { backgroundColor: colors.accent },
  stepCircleCurrent: { backgroundColor: colors.primary },
  stepCircleFocused: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  stepCircleText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.mutedForeground,
  },
  stepCircleTextOn: { color: colors.onPrimary },
  stepCircleTextFocused: { color: colors.primary },
  slideTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate700,
    textAlign: 'center',
  },
  slideTitleActive: { color: colors.foreground },
  slideDescription: {
    ...typography.bodySm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 280,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
});
