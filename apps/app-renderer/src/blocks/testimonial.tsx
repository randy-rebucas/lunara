import { View, Text, StyleSheet } from 'react-native';
import type { TestimonialProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function Testimonial({ quote, authorName, authorRole }: TestimonialProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.muted }]}>
      <Text style={[styles.quote, { color: theme.foreground }]}>&ldquo;{quote}&rdquo;</Text>
      <Text style={[styles.author, { color: theme.primary }]}>
        {authorName}
        {authorRole ? <Text style={{ color: theme.foreground }}>{` · ${authorRole}`}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, borderRadius: 10, marginBottom: 16 },
  quote: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  author: { fontSize: 12, fontWeight: '600', marginTop: 8 },
});
