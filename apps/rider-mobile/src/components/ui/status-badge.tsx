import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import type { ShiftStatus } from '../../lib/rider-types';

interface StatusBadgeProps {
  online?: boolean;
  shiftStatus?: ShiftStatus;
}

function resolveShiftStatus(online: boolean | undefined, shiftStatus?: ShiftStatus): ShiftStatus {
  if (shiftStatus) return shiftStatus;
  return online ? 'online' : 'offline';
}

const LABELS: Record<ShiftStatus, string> = {
  online: 'Online — receiving assignments',
  offline: 'Offline',
  break: 'On break — not receiving assignments',
};

export function StatusBadge({ online, shiftStatus }: StatusBadgeProps) {
  const status = resolveShiftStatus(online, shiftStatus);
  const isOnline = status === 'online';
  const isBreak = status === 'break';

  return (
    <View
      style={[
        styles.badge,
        isOnline ? styles.online : isBreak ? styles.break : styles.offline,
      ]}
    >
      <View
        style={[
          styles.dot,
          isOnline ? styles.dotOnline : isBreak ? styles.dotBreak : styles.dotOffline,
        ]}
      />
      <Text
        style={[
          styles.text,
          isOnline ? styles.textOnline : isBreak ? styles.textBreak : styles.textOffline,
        ]}
      >
        {LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  online: {
    backgroundColor: colors.accentLight,
  },
  break: {
    backgroundColor: '#FEF3C7',
  },
  offline: {
    backgroundColor: colors.surfaceMuted,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: colors.accent,
  },
  dotBreak: {
    backgroundColor: '#D97706',
  },
  dotOffline: {
    backgroundColor: colors.mutedForeground,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textOnline: {
    color: colors.accentDark,
  },
  textBreak: {
    color: '#92400E',
  },
  textOffline: {
    color: colors.muted,
  },
});
