import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appConfig } from '@lunara/config';
import { redirectAfterAuth } from '../../src/lib/onboarding';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { Screen } from '../../src/components/ui/screen';
import { colors, radius, spacing, typography } from '../../src/theme';
import { useAuthStore } from '../../src/store/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithOtp, loginWithEmail, requestOtp, apiFetch } = useAuthStore();
  const [mode, setMode] = useState<'otp' | 'email'>('otp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('customer@lunara.dev');
  const [password, setPassword] = useState('password123');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');

  async function handleSendOtp() {
    setError('');
    try {
      const code = await requestOtp(phone);
      if (code) setDevOtp(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send OTP');
    }
  }

  async function handleLogin() {
    setError('');
    try {
      if (mode === 'email') {
        await loginWithEmail(email, password);
      } else {
        await loginWithOtp(phone, otp);
      }
      await redirectAfterAuth(apiFetch, router);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <BrandMark size="sm" />
        <Text style={styles.brand}>{appConfig.name}</Text>
      </View>

      <Card elevated style={styles.formCard}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to book and track your laundry</Text>

        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeBtn, mode === 'otp' && styles.modeBtnActive]}
            onPress={() => setMode('otp')}
          >
            <Text style={mode === 'otp' ? styles.modeTextActive : styles.modeText}>Phone OTP</Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === 'email' && styles.modeBtnActive]}
            onPress={() => setMode('email')}
          >
            <Text style={mode === 'email' ? styles.modeTextActive : styles.modeText}>Email</Text>
          </Pressable>
        </View>

        {mode === 'email' ? (
          <>
            <Input
              style={styles.field}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              style={styles.field}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </>
        ) : null}

        {mode === 'otp' ? (
          <>
            <Input
              style={styles.field}
              placeholder="Phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <View style={styles.row}>
              <Input
                style={[styles.field, styles.otpInput]}
                placeholder="OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
              />
              <Button label="Send" variant="secondary" onPress={handleSendOtp} style={styles.sendBtn} />
            </View>
            {devOtp ? <Text style={styles.devOtp}>Dev OTP: {devOtp}</Text> : null}
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Sign in" onPress={handleLogin} style={styles.submitBtn} />
      </Card>

      <Text style={styles.footer}>
        New here?{' '}
        <Link href="/(auth)/signup" style={styles.footerLink}>
          Create account
        </Link>
      </Text>

      <Text style={styles.devHint}>
        Dev OTP is always 123456 · email: customer@lunara.dev / password123
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginBottom: spacing.xxl,
  },
  brand: { fontSize: 18, fontWeight: '700', color: colors.primary },
  formCard: { borderWidth: 0 },
  title: { ...typography.title, fontSize: 22 },
  subtitle: { ...typography.bodySm, marginTop: spacing.xs, marginBottom: spacing.xl },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  modeText: { color: colors.muted, fontWeight: '500' },
  modeTextActive: { color: colors.primary, fontWeight: '600' },
  field: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  otpInput: { flex: 1, marginBottom: 0 },
  sendBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  devOtp: { color: colors.accent, marginBottom: spacing.sm, fontSize: 13, fontWeight: '500' },
  error: { color: colors.destructive, marginBottom: spacing.sm, fontSize: 14 },
  submitBtn: { marginTop: spacing.sm },
  footer: { ...typography.bodySm, textAlign: 'center', marginTop: spacing.xxl },
  footerLink: { color: colors.primary, fontWeight: '600' },
  devHint: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
});
