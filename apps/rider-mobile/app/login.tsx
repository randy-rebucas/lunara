import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { appConfig } from '@lunara/config';
import { BrandMark } from '../src/components/ui/brand-mark';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { Input } from '../src/components/ui/input';
import { Screen } from '../src/components/ui/screen';
import { colors, spacing, typography } from '../src/theme';
import { riderLogin } from '../src/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('rider@lunara.dev');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await riderLogin(email.trim(), password);
      router.replace('/(tabs)' as Href);
    } catch (e) {
      Alert.alert('Login failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll centered>
      <View style={styles.header}>
        <BrandMark size="lg" />
        <View>
          <Text style={styles.brand}>{appConfig.name}</Text>
          <Text style={styles.brandSub}>Rider · Field ops</Text>
        </View>
      </View>

      <Card elevated style={styles.formCard}>
        <Text style={styles.title}>Sign in to your shift</Text>
        <Text style={styles.subtitle}>
          Access pickups, deliveries, and earnings for today&apos;s route.
        </Text>

        <Input
          style={styles.field}
          placeholder="Work email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          style={styles.field}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          label={loading ? 'Signing in…' : 'Start session'}
          onPress={handleLogin}
          disabled={loading}
          size="lg"
          style={styles.submitBtn}
        />
      </Card>

      <Text style={styles.devHint}>Dev: rider@lunara.dev / password123</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  brandSub: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  formCard: { borderWidth: 0, width: '100%' },
  title: { ...typography.title, fontSize: 22 },
  subtitle: { ...typography.bodySm, marginTop: spacing.xs, marginBottom: spacing.xl },
  field: { marginBottom: spacing.md },
  submitBtn: { marginTop: spacing.sm },
  devHint: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
});
