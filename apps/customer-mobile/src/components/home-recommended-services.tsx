import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookingType } from '@lunara/types';
import { RECOMMENDED_SERVICES } from '../lib/service-catalog';
import { colors, radius, shadow, spacing, typography } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

const SERVICE_ICONS: Partial<Record<BookingType, IconName>> = {
  [BookingType.WASH_FOLD]: 'shirt-outline',
  [BookingType.WASH_DRY]: 'sunny-outline',
  [BookingType.WASH_DRY_FOLD]: 'layers-outline',
  [BookingType.WASH_DRY_FOLD_IRON]: 'flame-outline',
  [BookingType.DRY_CLEANING]: 'sparkles-outline',
  [BookingType.COMFORTERS]: 'bed-outline',
  [BookingType.CURTAINS]: 'reader-outline',
  [BookingType.SHOES]: 'footsteps-outline',
  [BookingType.UNIFORMS]: 'shirt-outline',
  [BookingType.IRONING]: 'flame-outline',
  [BookingType.RUGS]: 'square-outline',
  [BookingType.UPHOLSTERY]: 'home-outline',
  [BookingType.BAGS]: 'bag-outline',
  [BookingType.LEATHER]: 'briefcase-outline',
  [BookingType.ALTERATION]: 'cut-outline',
  [BookingType.PREMIUM_WASH_FOLD]: 'diamond-outline',
  [BookingType.BABY_CLOTHES_WASH]: 'happy-outline',
  [BookingType.DELICATES_WASH]: 'flower-outline',
  [BookingType.COLOR_SEPARATION_WASH]: 'color-palette-outline',
  [BookingType.WHITE_GARMENTS_WASH]: 'contrast-outline',
  [BookingType.HAND_WASH]: 'hand-left-outline',
  [BookingType.MACHINE_WASH]: 'sync-outline',
  [BookingType.ECO_FRIENDLY_WASH]: 'leaf-outline',
  [BookingType.HYPOALLERGENIC_WASH]: 'shield-checkmark-outline',
  [BookingType.SANITIZING_DISINFECTION]: 'medkit-outline',
  [BookingType.WEDDING_GOWN_PRESERVATION]: 'heart-outline',
  [BookingType.SPECIALTY_ITEMS]: 'star-outline',
};

const DEFAULT_ICON: IconName = 'shirt-outline';

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
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/book', params: { service: service.type } })}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={SERVICE_ICONS[service.type] ?? DEFAULT_ICON} size={20} color={colors.primary} />
            </View>
            <Text style={styles.cardLabel} numberOfLines={2}>
              {service.label}
            </Text>
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
  card: {
    width: 92,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.card,
  },
  pressed: { opacity: 0.9, borderColor: colors.primaryBorder, transform: [{ scale: 0.98 }] },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
    lineHeight: 16,
  },
});
