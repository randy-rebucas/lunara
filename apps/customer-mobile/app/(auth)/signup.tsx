import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appConfig } from '@lunara/config';
import { formatPhone, isValidPhilippineMobile } from '@lunara/utils';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { OnboardingProgress } from '../../src/components/onboarding-progress';
import { Screen } from '../../src/components/ui/screen';
import { redirectAfterAuth } from '../../src/lib/onboarding';
import { useAuthStore } from '../../src/store/auth';
import { colors, spacing, typography } from '../../src/theme';

type Step = 'phone' | 'otp';

export default function SignUpScreen() {
  const router = useRouter();
  const { signupWithOtp, requestOtp, apiFetch } = useAuthStore();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      const targetPhone = verifiedPhone || formatPhone(phone);
      await signupWithOtp(targetPhone, otp);
      await redirectAfterAuth(apiFetch, router);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired OTP');
    } finally {
      setSubmitting(false);
    }
  }

  function handleChangeNumber() {
    setStep('phone');
    setOtp('');
    setVerifiedPhone('');
    setError('');
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
              placeholder="Mobile number (+639...)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
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
            <Text style={styles.phoneHint}>Code sent to {verifiedPhone || formatPhone(phone)}</Text>
            <Input
              style={styles.field}
              placeholder="6-digit OTP"
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="sms-otp"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={submitting ? 'Verifying…' : 'Verify & continue'}
              onPress={handleVerifyOtp}
              disabled={submitting || otp.length < 6}
            />
            <Pressable onPress={handleSendOtp} style={styles.backLink} disabled={submitting}>
              <Text style={styles.backLinkText}>Resend code</Text>
            </Pressable>
            <Pressable onPress={handleChangeNumber} style={styles.backLink}>
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
  error: { color: colors.destructive, marginBottom: spacing.sm, fontSize: 14 },
  backLink: { marginTop: spacing.md, alignItems: 'center' },
  backLinkText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  footer: { ...typography.bodySm, textAlign: 'center', marginTop: spacing.xxl },
  footerLink: { color: colors.primary, fontWeight: '600' },
});
