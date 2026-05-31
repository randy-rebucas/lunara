import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

interface StatusBadgeProps {
  online: boolean;
}

export function StatusBadge({ online }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, online ? styles.online : styles.offline]}>
      <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
      <Text style={[styles.text, online ? styles.textOnline : styles.textOffline]}>
        {online ? 'Online — receiving assignments' : 'Offline'}
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
  textOffline: {
    color: colors.muted,
  },
});
