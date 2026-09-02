import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { HeroProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function Hero({ headline, subheadline, ctaLabel }: HeroProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <Text style={[styles.headline, { color: theme.background }]}>{headline}</Text>
      {subheadline ? (
        <Text style={[styles.subheadline, { color: theme.background }]}>{subheadline}</Text>
      ) : null}
      {ctaLabel ? (
        <Pressable style={[styles.cta, { backgroundColor: theme.background }]}>
          <Text style={[styles.ctaLabel, { color: theme.primary }]}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, borderRadius: 12, marginBottom: 16 },
  headline: { fontSize: 24, fontWeight: '700' },
  subheadline: { fontSize: 15, marginTop: 4, opacity: 0.9 },
  cta: { marginTop: 16, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  ctaLabel: { fontWeight: '600' },
});
