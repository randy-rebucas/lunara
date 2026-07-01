import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from '../src/components/ui/input';
import { Screen } from '../src/components/ui/screen';
import { riderForgotPassword, riderResetPassword } from '../src/auth';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-open-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.pageTitle}>Reset password</Text>
        <Text style={styles.pageSubtitle}>
          We'll send a verification code to the mobile number linked to your rider account.
        </Text>
      </View>

      {/* ── Step indicator ── */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDotActive]}>
          <Text style={styles.stepDotText}>1</Text>
        </View>
        <View style={[styles.stepLine, step === 'reset' && styles.stepLineActive]} />
        <View style={[styles.stepDot, step === 'reset' && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, step !== 'reset' && styles.stepDotTextInactive]}>2</Text>
        </View>
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabel, styles.stepLabelLeft]}>Verify email</Text>
          <Text style={[styles.stepLabel, styles.stepLabelRight]}>New password</Text>
        </View>
      </View>

      {/* ── Step: email ── */}
      {step === 'email' ? (
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>WORK EMAIL</Text>
            <Input
              placeholder="your@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              (loading || !email.trim()) && styles.submitBtnDisabled,
              pressed && email.trim() && !loading && styles.submitBtnPressed,
            ]}
            onPress={handleRequestReset}
            disabled={loading || !email.trim()}
          >
            {loading ? (
              <Ionicons name="hourglass-outline" size={18} color="#fff" />
            ) : (
              <Ionicons name="send-outline" size={18} color="#fff" />
            )}
            <Text style={styles.submitBtnText}>
              {loading ? 'Sending…' : 'Send verification code'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          {/* OTP sent banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="phone-portrait-outline" size={14} color={colors.primary} />
            <Text style={styles.infoText}>
              Code sent to <Text style={styles.infoPhone}>{phone}</Text>
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>VERIFICATION CODE</Text>
            <Input
              placeholder="6-digit OTP"
              keyboardType="number-pad"
              autoComplete="sms-otp"
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
            <View style={styles.passwordRow}>
              <Input
                style={styles.passwordInput}
                placeholder="Min. 8 characters"
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
            {password.length > 0 && password.length < 8 ? (
              <Text style={styles.passwordHint}>At least 8 characters required</Text>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              (loading || !otp.trim() || password.length < 8) && styles.submitBtnDisabled,
              pressed && otp.trim() && password.length >= 8 && !loading && styles.submitBtnPressed,
            ]}
            onPress={handleResetPassword}
            disabled={loading || !otp.trim() || password.length < 8}
          >
            {loading ? (
              <Ionicons name="hourglass-outline" size={18} color="#fff" />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            )}
            <Text style={styles.submitBtnText}>
              {loading ? 'Updating…' : 'Update password'}
            </Text>
          </Pressable>

          <Pressable onPress={() => setStep('email')} style={styles.backLink}>
            <Ionicons name="arrow-back-outline" size={14} color={colors.mutedForeground} />
            <Text style={styles.backLinkText}>Use a different email</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  pageSubtitle: {
    ...typography.bodySm,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  stepDotTextInactive: { color: colors.mutedForeground },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  stepLineActive: { backgroundColor: colors.primary },
  stepLabels: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepLabel: { ...typography.caption },
  stepLabelLeft: { marginLeft: -6 },
  stepLabelRight: { marginRight: -6 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.xl,
    ...shadow.card,
  },

  fieldGroup: { gap: spacing.xs },
  fieldLabel: { ...typography.label },

  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: { paddingRight: 44 },
  eyeBtn: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.xs,
  },
  passwordHint: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '500',
    marginTop: spacing.xs,
  },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  infoText: { fontSize: 13, fontWeight: '500', color: colors.primary },
  infoPhone: { fontWeight: '800' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    marginTop: spacing.xs,
    ...shadow.elevated,
  },
  submitBtnDisabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  submitBtnPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  backLinkText: { ...typography.bodySm, color: colors.mutedForeground },
});
