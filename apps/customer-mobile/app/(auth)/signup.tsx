import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appConfig } from '@lunara/config';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { OnboardingProgress } from '../../src/components/onboarding-progress';
import { Screen } from '../../src/components/ui/screen';
import { redirectAfterAuth } from '../../src/lib/onboarding';
import { useAuthStore } from '../../src/store/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

type Step = 'phone' | 'otp';

export default function SignUpScreen() {
  const router = useRouter();
  const { loginWithOtp, requestOtp, apiFetch } = useAuthStore();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSendOtp() {
    setError('');
    setSubmitting(true);
    try {
      const code = await requestOtp(phone);
      if (__DEV__ && code) setDevOtp(code);
      setStep('otp');
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
      await loginWithOtp(phone, otp);
      await redirectAfterAuth(apiFetch, router);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired OTP');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <BrandMark size="sm" />
        <Text style={styles.brand}>{appConfig.name}</Text>
      </View>

      <Card elevated style={styles.formCard}>
        <OnboardingProgress current={step === 'phone' ? 'phone' : 'profile'} />
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Sign up with your mobile number to book laundry</Text>

        {step === 'phone' ? (
          <>
            <Input
              style={styles.field}
              placeholder="Phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={submitting ? 'Sending…' : 'Send OTP'}
              onPress={handleSendOtp}
              disabled={submitting || !phone.trim()}
            />
          </>
        ) : (
          <>
            <Text style={styles.phoneHint}>Code sent to {phone}</Text>
            <Input
              style={styles.field}
              placeholder="OTP"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
            />
            {__DEV__ && devOtp ? <Text style={styles.devOtp}>Dev OTP: {devOtp}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={submitting ? 'Verifying…' : 'Verify & continue'}
              onPress={handleVerifyOtp}
              disabled={submitting || !otp.trim()}
            />
            <Pressable onPress={() => setStep('phone')} style={styles.backLink}>
              <Text style={styles.backLinkText}>Change phone number</Text>
            </Pressable>
          </>
        )}
      </Card>

      <Text style={styles.footer}>
        Already have an account?{' '}
        <Link href="/(auth)/login" style={styles.footerLink}>
          Sign in
        </Link>
      </Text>

      {__DEV__ ? <Text style={styles.devHint}>Dev OTP is always 123456</Text> : null}
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
  formCard: { borderWidth: 0, gap: spacing.md },
  title: { ...typography.title, fontSize: 22, marginTop: spacing.lg },
  subtitle: { ...typography.bodySm, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  phoneHint: { ...typography.bodySm, marginBottom: spacing.sm },
  devOtp: { color: colors.accent, marginBottom: spacing.sm, fontSize: 13, fontWeight: '500' },
  error: { color: colors.destructive, marginBottom: spacing.sm, fontSize: 14 },
  backLink: { marginTop: spacing.md, alignItems: 'center' },
  backLinkText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  footer: { ...typography.bodySm, textAlign: 'center', marginTop: spacing.xxl },
  footerLink: { color: colors.primary, fontWeight: '600' },
  devHint: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
});
