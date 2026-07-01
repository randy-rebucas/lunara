import { Image, StyleSheet, Text, View } from 'react-native';
import { Card } from './ui/card';
import { getDisplayName, getTimeOfDayGreeting } from '../lib/home-greeting';
import type { CustomerProfile } from '../lib/profile-types';
import { colors, radius, spacing, typography } from '../theme';

const brandIcon = require('../../assets/icon.png');

interface HomeWelcomeBannerProps {
  profile: CustomerProfile | null;
  user: { email?: string; phone?: string } | null;
}

export function HomeWelcomeBanner({ profile, user }: HomeWelcomeBannerProps) {
  const name = getDisplayName({
    firstName: profile?.firstName,
    lastName: profile?.lastName,
    email: user?.email,
    phone: user?.phone,
  });

  return (
    <Card elevated style={styles.banner}>
      <View style={styles.glow} />
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.greeting}>
            {getTimeOfDayGreeting()}, <Text style={styles.name}>{name}!</Text> 👋
          </Text>
          <Text style={styles.sub}>Fresh clothes, happy you.{'\n'}We handle the rest.</Text>
        </View>
        <View style={styles.illustration}>
          <Image
            source={brandIcon}
            style={styles.illustrationImage}
            resizeMode="contain"
            accessibilityLabel="Lunara"
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
    borderWidth: 0,
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    top: -60,
    right: -40,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  textCol: { flex: 1, paddingRight: spacing.md },
  greeting: { ...typography.title, fontSize: 22, color: colors.primaryDark },
  name: { fontWeight: '800' },
  sub: { ...typography.bodySm, marginTop: spacing.xs, color: colors.slate700 },
  illustration: {
    width: 76,
    height: 76,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illustrationImage: { width: 56, height: 56 },
});
