import { View, Text, StyleSheet } from 'react-native';
import type { PromoProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function Promo({ title, description, code }: PromoProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { borderColor: theme.primary }]}>
      <Text style={[styles.title, { color: theme.primary }]}>{title}</Text>
      {description ? <Text style={[styles.description, { color: theme.foreground }]}>{description}</Text> : null}
      {code ? (
        <View style={[styles.codeBadge, { backgroundColor: theme.primary }]}>
          <Text style={[styles.codeLabel, { color: theme.background }]}>{code}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', marginBottom: 16 },
  title: { fontSize: 15, fontWeight: '700' },
  description: { fontSize: 13, marginTop: 4 },
  codeBadge: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  codeLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
