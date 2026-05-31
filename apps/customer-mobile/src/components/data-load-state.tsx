import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function DataLoadState({
  loading,
  error,
  loadingMessage = 'Loading…',
  onRetry,
}: {
  loading: boolean;
  error: string;
  loadingMessage?: string;
  onRetry?: () => void;
}) {
  if (!loading && !error) return null;

  return (
    <View style={styles.wrap}>
      {loading && !error ? (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>{loadingMessage}</Text>
        </>
      ) : null}
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          {onRetry ? (
            <Pressable style={styles.retryBtn} onPress={onRetry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md - 2 },
  muted: { color: colors.mutedForeground, fontSize: 14 },
  error: { color: colors.destructive, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.lg },
  retryBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
