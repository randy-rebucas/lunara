import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RECOMMENDED_SERVICES } from '../lib/service-catalog';
import { colors, radius, spacing, typography } from '../theme';

export function HomeRecommendedServices() {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Recommended services</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {RECOMMENDED_SERVICES.map((service) => (
          <Pressable
            key={service.type}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/book', params: { service: service.type } })}
          >
            <Text style={styles.chipText}>{service.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xxl },
  title: { ...typography.subheading, fontSize: 17, marginBottom: spacing.md },
  row: { gap: spacing.sm, paddingRight: spacing.xl },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.9, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
});
