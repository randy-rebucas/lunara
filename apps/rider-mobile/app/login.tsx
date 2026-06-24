import { useRouter, type Href } from 'expo-router';

import { useState } from 'react';

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { appConfig } from '@lunara/config';

import { isValidPhilippineMobile } from '@lunara/utils';

import { BrandMark } from '../src/components/ui/brand-mark';

import { Button } from '../src/components/ui/button';

import { Card } from '../src/components/ui/card';

import { Input } from '../src/components/ui/input';

import { Screen } from '../src/components/ui/screen';

import { riderLogin, riderLoginWithOtp, riderRequestOtp } from '../src/auth';

import { colors, spacing, typography } from '../src/theme';



const DEV_EMAIL = __DEV__ ? 'rider@lunara.dev' : '';

const DEV_PASSWORD = __DEV__ ? 'password123' : '';

const DEV_PHONE = __DEV__ ? '+639172222222' : '';



type LoginMode = 'password' | 'otp';



export default function LoginScreen() {

  const router = useRouter();

  const [mode, setMode] = useState<LoginMode>('password');

  const [email, setEmail] = useState(DEV_EMAIL);

  const [password, setPassword] = useState(DEV_PASSWORD);

  const [phone, setPhone] = useState(DEV_PHONE);

  const [otp, setOtp] = useState('');

  const [otpSent, setOtpSent] = useState(false);

  const [status, setStatus] = useState('');

  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);



  async function handlePasswordLogin() {

    setError('');

    setStatus('');

    setLoading(true);

    try {

      await riderLogin(email.trim(), password);

      router.replace('/(tabs)' as Href);

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Try again');

    } finally {

      setLoading(false);

    }

  }



  async function handleSendOtp() {

    if (!phone.trim()) return;

    setError('');

    setStatus('');

    if (!isValidPhilippineMobile(phone)) {

      setError('Enter a valid Philippine mobile number linked to your rider account.');

      return;

    }

    setLoading(true);

    try {

      await riderRequestOtp(phone.trim());

      setOtpSent(true);

      setStatus('Verification code sent to your mobile number.');

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Could not send code');

    } finally {

      setLoading(false);

    }

  }



  async function handleOtpLogin() {

    setError('');

    setStatus('');

    setLoading(true);

    try {

      await riderLoginWithOtp(phone.trim(), otp.trim());

      router.replace('/(tabs)' as Href);

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Invalid or expired code');

    } finally {

      setLoading(false);

    }

  }



  function switchMode(next: LoginMode) {

    setMode(next);

    setError('');

    setStatus('');

    setOtpSent(false);

    setOtp('');

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



      <View style={styles.modeRow}>

        <Pressable

          style={[styles.modeBtn, mode === 'password' && styles.modeBtnActive]}

          onPress={() => switchMode('password')}

        >

          <Text style={[styles.modeText, mode === 'password' && styles.modeTextActive]}>

            Email

          </Text>

        </Pressable>

        <Pressable

          style={[styles.modeBtn, mode === 'otp' && styles.modeBtnActive]}

          onPress={() => switchMode('otp')}

        >

          <Text style={[styles.modeText, mode === 'otp' && styles.modeTextActive]}>Mobile OTP</Text>

        </Pressable>

      </View>



      <Card elevated style={styles.formCard}>

        <Text style={styles.title}>Sign in to your shift</Text>

        <Text style={styles.subtitle}>

          Access pickups, deliveries, and earnings for today&apos;s route.

        </Text>



        {mode === 'password' ? (

          <>

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

            <Pressable onPress={() => router.push('/forgot-password')} style={styles.forgotLink}>

              <Text style={styles.forgotText}>Forgot password?</Text>

            </Pressable>

            <Button

              label={loading ? 'Signing in…' : 'Start session'}

              onPress={handlePasswordLogin}

              disabled={loading || !email.trim() || !password}

              size="lg"

              style={styles.submitBtn}

            />

          </>

        ) : (

          <>

            <Input

              style={styles.field}

              placeholder="Mobile number (+639...)"

              keyboardType="phone-pad"

              autoComplete="tel"

              value={phone}

              onChangeText={setPhone}

              editable={!otpSent || loading}

            />

            {otpSent ? (

              <Input

                style={styles.field}

                placeholder="6-digit OTP"

                keyboardType="number-pad"

                autoComplete="sms-otp"

                value={otp}

                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}

              />

            ) : null}

            {status ? <Text style={styles.status}>{status}</Text> : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button

              label={

                loading ? 'Please wait…' : otpSent ? 'Verify & sign in' : 'Send OTP'

              }

              onPress={otpSent ? handleOtpLogin : handleSendOtp}

              disabled={loading || !phone.trim() || (otpSent && otp.length < 6)}

              size="lg"

              style={styles.submitBtn}

            />

            {otpSent ? (

              <>

                <Pressable onPress={handleSendOtp} style={styles.forgotLink}>

                  <Text style={styles.forgotText}>Resend code</Text>

                </Pressable>

                <Pressable

                  onPress={() => {

                    setOtpSent(false);

                    setOtp('');

                    setStatus('');

                    setError('');

                  }}

                  style={styles.forgotLink}

                >

                  <Text style={styles.changeNumber}>Change number</Text>

                </Pressable>

              </>

            ) : null}

          </>

        )}



        {mode === 'password' && error ? <Text style={styles.error}>{error}</Text> : null}

      </Card>



      {__DEV__ ? (

        <Text style={styles.devHint}>

          Dev: rider@lunara.dev / password123 · OTP phone +639172222222

        </Text>

      ) : null}

    </Screen>

  );

}



const styles = StyleSheet.create({

  header: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: spacing.lg,

    marginBottom: spacing.lg,

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

  modeRow: {

    flexDirection: 'row',

    gap: spacing.sm,

    marginBottom: spacing.lg,

    width: '100%',

  },

  modeBtn: {

    flex: 1,

    paddingVertical: spacing.sm + 2,

    borderRadius: 999,

    backgroundColor: colors.surfaceMuted,

    alignItems: 'center',

  },

  modeBtnActive: {

    backgroundColor: colors.primary,

  },

  modeText: {

    fontWeight: '600',

    color: colors.muted,

    fontSize: 13,

  },

  modeTextActive: {

    color: colors.onPrimary,

  },

  formCard: { borderWidth: 0, width: '100%' },

  title: { ...typography.title, fontSize: 22 },

  subtitle: { ...typography.bodySm, marginTop: spacing.xs, marginBottom: spacing.xl },

  field: { marginBottom: spacing.md },

  status: { ...typography.bodySm, color: colors.accent, marginBottom: spacing.sm },

  error: { color: colors.destructive, marginBottom: spacing.sm, fontSize: 14 },

  forgotLink: { alignSelf: 'flex-end', marginBottom: spacing.md },

  forgotText: { color: colors.primary, fontWeight: '600', fontSize: 13 },

  changeNumber: { color: colors.muted, fontSize: 13 },

  submitBtn: { marginTop: spacing.sm },

  devHint: {

    ...typography.caption,

    textAlign: 'center',

    marginTop: spacing.xxl,

    paddingHorizontal: spacing.lg,

  },

});


