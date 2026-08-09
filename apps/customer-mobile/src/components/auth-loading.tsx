import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from './ui/brand-mark';
import { brandName, colors, spacing, typography } from '../theme';

export function AuthLoadingScreen() {
  return (
    <View style={styles.wrap}>
      <BrandMark size="lg" />
      <Text style={styles.title}>{brandName}</Text>
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
      <Text style={styles.hint}>Loading your session…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    padding: spacing.xxl,
  },
  title: { ...typography.title, marginTop: spacing.lg, color: colors.primary },
  spinner: { marginTop: spacing.xxl },
  hint: { ...typography.caption, marginTop: spacing.md },
});
