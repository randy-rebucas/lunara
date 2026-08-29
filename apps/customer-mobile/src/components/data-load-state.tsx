import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from './ui/button';
import { colors, radius, spacing, typography } from '../theme';

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

  if (error) {
    return (
      <View style={styles.wrap}>
        <View style={styles.errorIconWrap}>
          <Ionicons name="alert-circle-outline" size={26} color={colors.destructive} />
        </View>
        <Text style={styles.errorText}>{error}</Text>
        {onRetry ? <Button label="Try again" variant="outline" size="sm" onPress={onRetry} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.muted}>{loadingMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  muted: { ...typography.bodySm, color: colors.mutedForeground },
  errorIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.destructive + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.foreground,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
});
