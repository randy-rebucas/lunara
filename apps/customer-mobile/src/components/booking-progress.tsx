import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BOOKING_STEPS, type BookingStep } from '../lib/booking-flow';
import { colors, radius, spacing, typography } from '../theme';

interface BookingProgressProps {
  current: BookingStep;
}

const STEP_BLOCK_WIDTH = 68;

export function BookingProgress({ current }: BookingProgressProps) {
  const scrollRef = useRef<ScrollView>(null);
  const currentIndex = BOOKING_STEPS.findIndex((s) => s.id === current);
  const currentStep = BOOKING_STEPS[currentIndex];
  const progressPercent = ((currentIndex + 1) / BOOKING_STEPS.length) * 100;

  useEffect(() => {
    const x = Math.max(0, currentIndex * STEP_BLOCK_WIDTH - spacing.xxxl);
    scrollRef.current?.scrollTo({ x, animated: true });
  }, [currentIndex]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.stepCount}>
        Step {currentIndex + 1} of {BOOKING_STEPS.length}
        {currentStep ? ` · ${currentStep.label}` : ''}
      </Text>

      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${progressPercent}%` }]} />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stepsRow}
      >
        {BOOKING_STEPS.map((s, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;

          return (
            <View key={s.id} style={styles.stepItem}>
              <View style={styles.stepBlock}>
                <View
                  style={[
                    styles.circle,
                    done && styles.circleDone,
                    active && styles.circleActive,
                    !done && !active && styles.circlePending,
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                  ) : (
                    <Text style={[styles.circleText, active && styles.circleTextActive]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[styles.label, active && styles.labelActive, done && styles.labelDone]}
                  numberOfLines={1}
                >
                  {s.label}
                </Text>
              </View>
              {index < BOOKING_STEPS.length - 1 ? (
                <View style={[styles.connector, done && styles.connectorDone]} />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  stepCount: {
    ...typography.bodySm,
    marginBottom: spacing.md,
  },
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
  stepsRow: {
    alignItems: 'flex-start',
    paddingRight: spacing.xl,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepBlock: {
    width: STEP_BLOCK_WIDTH,
    alignItems: 'center',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePending: {
    backgroundColor: colors.border,
  },
  circleActive: {
    backgroundColor: colors.primary,
  },
  circleDone: {
    backgroundColor: colors.accent,
  },
  circleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  circleTextActive: {
    color: colors.onPrimary,
  },
  label: {
    marginTop: spacing.xs + 2,
    fontSize: 10,
    fontWeight: '500',
    color: colors.mutedForeground,
    textAlign: 'center',
    width: '100%',
  },
  labelActive: {
    color: colors.foreground,
    fontWeight: '700',
  },
  labelDone: {
    color: colors.slate700,
  },
  connector: {
    width: spacing.lg,
    height: 2,
    backgroundColor: colors.border,
    marginTop: 13,
  },
  connectorDone: {
    backgroundColor: colors.accent,
    opacity: 0.45,
  },
});
