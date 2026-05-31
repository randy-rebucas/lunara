import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { appConfig } from '@lunara/config';
import { BrandMark } from '../src/components/ui/brand-mark';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { Screen } from '../src/components/ui/screen';
import { colors, spacing, typography } from '../src/theme';

const FEATURES = [
  { label: 'Book pickup', desc: 'Schedule in minutes', color: colors.primary },
  { label: 'Track orders', desc: 'Live status updates', color: colors.secondary },
  { label: 'Pay securely', desc: 'Wallet & checkout', color: colors.accent },
] as const;

export default function SplashScreen() {
  return (
    <Screen centered padded={false}>
      <View style={styles.content}>
        <Card elevated style={styles.heroCard}>
          <View style={styles.heroInner}>
            <BrandMark size="lg" />
            <Text style={styles.title}>{appConfig.name}</Text>
            <Text style={styles.subtitle}>{appConfig.tagline}</Text>
            <View style={styles.actions}>
              <Link href="/(auth)/signup" asChild>
                <Button label="Get started" size="lg" style={styles.primaryBtn} />
              </Link>
              <Link href="/(auth)/login" asChild>
                <Button label="Sign in" variant="outline" size="lg" style={styles.secondaryBtn} />
              </Link>
            </View>
            <Text style={styles.hint}>
              Sign in with your mobile number to book laundry pickup and delivery.
            </Text>
          </View>
        </Card>

        <View style={styles.features}>
          {FEATURES.map((item) => (
            <Card key={item.label} style={styles.featureCard}>
              <Text style={[styles.featureLabel, { color: item.color }]}>{item.label}</Text>
              <Text style={styles.featureDesc}>{item.desc}</Text>
            </Card>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  heroCard: { borderWidth: 0 },
  heroInner: { alignItems: 'center', gap: spacing.sm },
  title: {
    ...typography.hero,
    fontSize: 28,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  actions: { width: '100%', gap: spacing.md, marginTop: spacing.xxl },
  primaryBtn: { width: '100%' },
  secondaryBtn: { width: '100%' },
  hint: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  features: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  featureCard: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  featureLabel: { fontSize: 12, fontWeight: '600' },
  featureDesc: { ...typography.caption, marginTop: spacing.xs, textAlign: 'center' },
});
