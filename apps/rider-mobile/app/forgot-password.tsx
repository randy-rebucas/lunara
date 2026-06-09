import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { Input } from '../src/components/ui/input';
import { Screen } from '../src/components/ui/screen';
import { SectionHeader } from '../src/components/ui/section-header';
import { riderForgotPassword, riderResetPassword } from '../src/auth';
import { spacing, typography } from '../src/theme';

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRequestReset() {
    setLoading(true);
    try {
      const result = await riderForgotPassword(email.trim());
      if (result.phone) {
        setPhone(result.phone);
        setStep('reset');
        Alert.alert('Check your phone', result.message);
      } else {
        Alert.alert('Request submitted', result.message);
      }
    } catch (e) {
      Alert.alert('Could not continue', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setLoading(true);
    try {
      await riderResetPassword(phone.trim(), otp.trim(), password);
      Alert.alert('Password updated', 'You can sign in with your new password.', [
        { text: 'Sign in', onPress: () => router.replace('/login') },
      ]);
    } catch (e) {
      Alert.alert('Reset failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen inStack scroll>
      <SectionHeader
        title="Reset password"
        hint="We send a verification code to the mobile number linked to your rider account."
      />

      {step === 'email' ? (
        <Card style={styles.card}>
          <Input
            placeholder="Work email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.field}
          />
          <Button
            label={loading ? 'Sending…' : 'Send verification code'}
            onPress={handleRequestReset}
            disabled={loading || !email.trim()}
          />
        </Card>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.hint}>Code sent to {phone}</Text>
          <Input
            placeholder="6-digit OTP"
            keyboardType="number-pad"
            autoComplete="sms-otp"
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
            style={styles.field}
          />
          <Input
            placeholder="New password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.field}
          />
          <Button
            label={loading ? 'Updating…' : 'Update password'}
            onPress={handleResetPassword}
            disabled={loading || !otp.trim() || password.length < 8}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md, gap: spacing.md },
  field: { marginBottom: spacing.sm },
  hint: { ...typography.bodySm, marginBottom: spacing.sm },
});
