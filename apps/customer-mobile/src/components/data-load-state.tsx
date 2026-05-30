import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lunara/config';

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
          <ActivityIndicator color={theme.colors.primary} />
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
  wrap: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  muted: { color: '#94a3b8', fontSize: 14 },
  error: { color: '#ef4444', fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  retryText: { color: theme.colors.primary, fontWeight: '600', fontSize: 14 },
});
