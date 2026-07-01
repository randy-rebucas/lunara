import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { appConfig } from '@lunara/config';
import { BrandMark } from '../src/components/ui/brand-mark';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { Screen } from '../src/components/ui/screen';
import { colors, radius, spacing, typography } from '../src/theme';

const FEATURES = [
  { label: 'Book pickup', desc: 'Schedule in minutes', icon: 'calendar-outline' as const, color: colors.primary, bg: colors.primaryLight },
  { label: 'Track orders', desc: 'Live status updates', icon: 'cube-outline' as const, color: colors.secondary, bg: colors.secondaryLight },
  { label: 'Pay securely', desc: 'Wallet & checkout', icon: 'wallet-outline' as const, color: colors.accentDark, bg: colors.accentLight },
] as const;

const PAYMENT_METHODS = ['GCash', 'Maya', 'Visa', 'Mastercard'];

export default function SplashScreen() {
  return (
    <Screen padded={false} scroll>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <BrandMark size="lg" />
        <Text style={styles.brandWord}>{appConfig.name.toUpperCase()}</Text>
        <Text style={styles.title}>Laundry{'\n'}made simple</Text>
        <Text style={styles.subtitle}>{appConfig.tagline}</Text>
      </View>

      <View style={styles.content}>
        <Card elevated style={styles.actionsCard}>
          <Link href="/(auth)/signup" asChild>
            <Button label="Get started" size="lg" style={styles.primaryBtn} />
          </Link>
          <Link href="/(auth)/login" asChild>
            <Button label="Sign in" variant="outline" size="lg" style={styles.secondaryBtn} />
          </Link>

          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
            <Text style={styles.trustText}>Secure • Reliable • Convenient</Text>
          </View>
          <View style={styles.paymentRow}>
            {PAYMENT_METHODS.map((method) => (
              <Text key={method} style={styles.paymentText}>
                {method}
              </Text>
            ))}
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Everything you need in one app</Text>
        <View style={styles.features}>
          {FEATURES.map((item) => (
            <Card key={item.label} style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={[styles.featureLabel, { color: item.color }]}>{item.label}</Text>
              <Text style={styles.featureDesc}>{item.desc}</Text>
            </Card>
          ))}
        </View>

        <Card style={styles.promoCard}>
          <Text style={styles.promoEmoji}>%</Text>
          <Text style={styles.promoText}>
            New here? <Text style={styles.promoBold}>Get 20% off</Text> your first order!
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl + spacing.lg,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primaryLight,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(79, 70, 229, 0.10)',
    top: -120,
  },
  brandWord: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing.sm,
    letterSpacing: 2,
  },
  title: {
    ...typography.hero,
    fontSize: 30,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  content: {
    padding: spacing.xl,
    marginTop: -spacing.xxxl,
  },
  actionsCard: { borderWidth: 0, gap: spacing.md },
  primaryBtn: { width: '100%' },
  secondaryBtn: { width: '100%' },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  trustText: { ...typography.caption, color: colors.foreground, fontWeight: '600' },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  paymentText: { ...typography.caption, color: colors.mutedForeground },
  sectionTitle: {
    ...typography.subheading,
    textAlign: 'center',
    marginTop: spacing.xxxl,
    marginBottom: spacing.lg,
  },
  features: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  featureCard: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featureLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  featureDesc: { ...typography.caption, marginTop: spacing.xs, textAlign: 'center' },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
  },
  promoEmoji: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.surface,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  promoText: { ...typography.bodySm, color: colors.foreground, flex: 1 },
  promoBold: { fontWeight: '700', color: colors.primary },
});
