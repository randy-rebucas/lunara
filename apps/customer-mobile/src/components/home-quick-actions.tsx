import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface HomeQuickActionsProps {
  firstActiveOrderId?: string;
}

const ACTIONS = [
  {
    id: 'book',
    label: 'Book Laundry',
    icon: 'calendar-outline' as const,
    color: colors.primary,
    bg: colors.primaryLight,
  },
  {
    id: 'track',
    label: 'Track Order',
    icon: 'navigate-outline' as const,
    color: colors.secondary,
    bg: colors.secondaryLight,
  },
  {
    id: 'history',
    label: 'Order History',
    icon: 'receipt-outline' as const,
    color: colors.accent,
    bg: colors.accent + '18',
  },
  {
    id: 'rewards',
    label: 'Rewards',
    icon: 'gift-outline' as const,
    color: colors.warning,
    bg: colors.warningBg,
  },
] as const;

export function HomeQuickActions({ firstActiveOrderId }: HomeQuickActionsProps) {
  const router = useRouter();

  function handlePress(id: (typeof ACTIONS)[number]['id']) {
    switch (id) {
      case 'book':
        router.push('/book');
        break;
      case 'track':
        if (firstActiveOrderId) {
          router.push(`/orders/${firstActiveOrderId}` as Href);
        } else {
          router.push('/(tabs)/orders');
        }
        break;
      case 'history':
        router.push('/(tabs)/orders');
        break;
      case 'rewards':
        router.push('/rewards' as Href);
        break;
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Quick actions</Text>
      <View style={styles.grid}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            onPress={() => handlePress(action.id)}
          >
            <View style={[styles.iconWrap, { backgroundColor: action.bg }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={styles.label}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xxl },
  title: { ...typography.subheading, fontSize: 17, marginBottom: spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    minWidth: 148,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.92 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
  },
});
