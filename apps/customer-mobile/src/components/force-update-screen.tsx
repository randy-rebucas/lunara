import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { appConfig } from '@lunara/config';
import { Button } from './ui/button';
import { BrandMark } from './ui/brand-mark';
import { colors, spacing, typography } from '../theme';

export function ForceUpdateScreen({ storeUrl }: { storeUrl: string }) {
  return (
    <View style={styles.wrap}>
      <BrandMark size="lg" />
      <View style={styles.iconWrap}>
        <Ionicons name="arrow-up-circle" size={40} color={colors.primary} />
      </View>
      <Text style={styles.title}>Update required</Text>
      <Text style={styles.body}>
        A new version of {appConfig.name} is available. Please update to keep booking and tracking
        your laundry.
      </Text>
      {storeUrl ? (
        <Button
          label="Update now"
          variant="primary"
          onPress={() => Linking.openURL(storeUrl)}
          style={styles.button}
        />
      ) : (
        <Text style={styles.hint}>Check your device&apos;s app store for the latest version.</Text>
      )}
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
  iconWrap: { marginTop: spacing.lg },
  title: { ...typography.title, marginTop: spacing.md, color: colors.foreground },
  body: {
    ...typography.bodySm,
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.mutedForeground,
  },
  button: { marginTop: spacing.xxl, minWidth: 220 },
  hint: { ...typography.caption, marginTop: spacing.xxl, textAlign: 'center' },
});
