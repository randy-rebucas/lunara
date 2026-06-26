import { Link, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appConfig } from '@lunara/config';
import { isValidPhilippineMobile } from '@lunara/utils';
import { redirectAfterAuth } from '../../src/lib/onboarding';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { Screen } from '../../src/components/ui/screen';
import { colors, radius, spacing, typography } from '../../src/theme';
import { useAuthStore } from '../../src/store/auth';

const DEV_EMAIL = __DEV__ ? 'customer@lunara.dev' : '';
const DEV_PASSWORD = __DEV__ ? 'password123' : '';

type OtpStep = 'phone' | 'code';

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithOtp, loginWithEmail, requestOtp, apiFetch } = useAuthStore();
  const [mode, setMode] = useState<'otp' | 'email'>('otp');
  const [otpStep, setOtpStep] = useState<OtpStep>('phone');
  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  function startResendCooldown() {
    setResendCooldown(30);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSendOtp() {
    setError('');
    if (!isValidPhilippineMobile(phone)) {
      setError('Enter a valid Philippine mobile number (e.g. +639171234567).');
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestOtp(phone);
      setVerifiedPhone(result.phone);
      setOtp('');
      setOtpStep('code');
      startResendCooldown();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    setError('');
    setSubmitting(true);
    try {
      await loginWithOtp(verifiedPhone || phone, otp);
      await redirectAfterAuth(apiFetch, router);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmailLogin() {
    setError('');
    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
      await redirectAfterAuth(apiFetch, router);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: 'otp' | 'email') {
    setMode(next);
    setError('');
    setOtpStep('phone');
    setOtp('');
    setVerifiedPhone('');
    setResendCooldown(0);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
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
            onPress={() => switchMode('otp')}
          >
            <Text style={mode === 'otp' ? styles.modeTextActive : styles.modeText}>Phone OTP</Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === 'email' && styles.modeBtnActive]}
            onPress={() => switchMode('email')}
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
            <Button
              label={submitting ? 'Signing in…' : 'Sign in'}
              onPress={handleEmailLogin}
              disabled={submitting}
              style={styles.submitBtn}
            />
          </>
        ) : otpStep === 'phone' ? (
          <>
            <Input
              style={styles.field}
              placeholder="Mobile number (+639...)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <Button
              label={submitting ? 'Sending…' : 'Send OTP'}
              onPress={handleSendOtp}
              disabled={submitting || !phone.trim()}
              style={styles.submitBtn}
            />
          </>
        ) : (
          <>
            <Text style={styles.phoneHint}>Code sent to {verifiedPhone || phone}</Text>
            <Input
              style={styles.field}
              placeholder="6-digit OTP"
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="sms-otp"
            />
            <Button
              label={submitting ? 'Verifying…' : 'Verify & sign in'}
              onPress={handleVerifyOtp}
              disabled={submitting || otp.length < 6}
              style={styles.submitBtn}
            />
            <Pressable onPress={handleSendOtp} style={styles.linkBtn} disabled={submitting || resendCooldown > 0}>
              <Text style={[styles.linkText, resendCooldown > 0 && styles.linkTextDisabled]}>
                {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setOtpStep('phone');
                setOtp('');
                setError('');
                setResendCooldown(0);
                if (cooldownRef.current) clearInterval(cooldownRef.current);
              }}
              style={styles.linkBtn}
            >
              <Text style={styles.mutedLinkText}>Change number</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Text style={styles.footer}>
        New here?{' '}
        <Link href="/(auth)/signup" style={styles.footerLink}>
          Create account
        </Link>
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
  phoneHint: { ...typography.bodySm, marginBottom: spacing.sm },
  error: { color: colors.destructive, marginTop: spacing.sm, fontSize: 14 },
  submitBtn: { marginTop: spacing.sm },
  linkBtn: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  linkTextDisabled: { color: colors.muted },
  mutedLinkText: { color: colors.muted, fontSize: 14 },
  footer: { ...typography.bodySm, textAlign: 'center', marginTop: spacing.xxl },
  footerLink: { color: colors.primary, fontWeight: '600' },
});
