import { StyleSheet, Text } from 'react-native';
import { Card } from './ui/card';
import { getDisplayName, getTimeOfDayGreeting } from '../lib/home-greeting';
import type { CustomerProfile } from '../lib/profile-types';
import { colors, spacing, typography } from '../theme';

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
      <Text style={styles.greeting}>
        {getTimeOfDayGreeting()}, {name}!
      </Text>
      <Text style={styles.sub}>Ready for your next laundry service?</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
    borderWidth: 0,
    backgroundColor: colors.primaryLight,
  },
  greeting: { ...typography.title, fontSize: 22, color: colors.primaryDark },
  sub: { ...typography.bodySm, marginTop: spacing.xs, color: colors.slate700 },
});
