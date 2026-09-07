import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

const CIRCLE_SIZE = 56;

interface BookTabButtonProps {
  onPress?: (e: GestureResponderEvent) => void;
  accessibilityState?: { selected?: boolean };
}

export function BookTabButton({ onPress, accessibilityState }: BookTabButtonProps) {
  const focused = !!accessibilityState?.selected;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Book laundry"
      hitSlop={8}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View style={[styles.ring, focused && styles.ringFocused]}>
        <View style={styles.circle}>
          <Ionicons name="shirt" size={24} color={colors.onPrimary} />
        </View>
      </View>
      <Text style={[styles.label, focused && styles.labelFocused]}>Book</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.9 },
  ring: {
    width: CIRCLE_SIZE + 8,
    height: CIRCLE_SIZE + 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -18 }],
    ...shadow.elevated,
  },
  ringFocused: {
    backgroundColor: colors.primaryLight,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: -spacing.md,
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedForeground,
  },
  labelFocused: {
    color: colors.primary,
  },
});
