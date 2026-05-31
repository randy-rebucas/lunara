import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

interface LocationPermissionBannerProps {
  denied: boolean;
  onRequestPermission: () => void;
}

export function LocationPermissionBanner({
  denied,
  onRequestPermission,
}: LocationPermissionBannerProps) {
  if (!denied) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Location access is off</Text>
      <Text style={styles.body}>
        Lunara needs your location while you are on an active task so customers and dispatch can
        track your route.
      </Text>
      <Pressable style={styles.btn} onPress={onRequestPermission}>
        <Text style={styles.btnText}>Enable location</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openSettings()}>
        <Text style={styles.settings}>Open device settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  title: { fontWeight: '700', color: colors.warning, fontSize: 15 },
  body: { ...typography.bodySm, marginTop: spacing.sm, color: colors.warning },
  btn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  btnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  settings: {
    marginTop: spacing.sm,
    color: colors.warning,
    fontWeight: '600',
    fontSize: 13,
  },
});
