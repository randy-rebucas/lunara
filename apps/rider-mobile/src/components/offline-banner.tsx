import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useOfflineSync } from '../hooks/use-offline-sync';
import { colors, spacing, typography } from '../theme';

export function OfflineBanner({ embedded = false }: { embedded?: boolean }) {
  const { isOnline, pendingCount, syncing, syncNow } = useOfflineSync();

  if (isOnline && pendingCount === 0 && !syncing) {
    return null;
  }

  const message = !isOnline
    ? 'No connection — changes saved locally'
    : syncing
      ? 'Syncing offline changes…'
      : `${pendingCount} item${pendingCount === 1 ? '' : 's'} waiting to sync`;

  const onlineStyle = isOnline && !syncing;

  return (
    <Pressable
      style={[
        styles.wrap,
        !isOnline ? styles.offline : styles.pending,
        embedded && styles.embedded,
      ]}
      onPress={() => {
        if (isOnline && !syncing) void syncNow();
      }}
      disabled={!isOnline || syncing}
    >
      <View style={styles.row}>
        {syncing ? (
          <ActivityIndicator
            size="small"
            color={onlineStyle ? colors.onPrimary : colors.primary}
          />
        ) : null}
        <Text style={[styles.text, onlineStyle ? styles.textOnline : styles.textOffline]}>
          {message}
        </Text>
      </View>
      {isOnline && pendingCount > 0 && !syncing ? (
        <Text style={styles.action}>Tap to sync now</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
  },
  offline: {
    backgroundColor: colors.warningBg,
    borderBottomColor: colors.warningBorder,
  },
  pending: {
    backgroundColor: colors.primary,
    borderBottomColor: colors.primaryDark,
  },
  embedded: {
    marginTop: spacing.md,
    borderBottomWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    ...typography.bodySm,
    fontWeight: '600',
    flex: 1,
  },
  textOffline: {
    color: colors.foreground,
  },
  textOnline: {
    color: colors.onPrimary,
  },
  action: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
