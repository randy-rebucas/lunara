import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function TasksHeaderActions() {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Scan a laundry tag"
        onPress={() => router.push('/scan?mode=lookup_tag')}
      >
        <Ionicons name="qr-code-outline" size={15} color={colors.primary} />
        <Text style={styles.btnText}>Scan tag</Text>
      </Pressable>
      <Pressable style={styles.btn} accessibilityRole="button" accessibilityLabel="Sort tasks">
        <Ionicons name="funnel-outline" size={15} color={colors.primary} />
        <Text style={styles.btnText}>Sort</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginRight: spacing.md,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
