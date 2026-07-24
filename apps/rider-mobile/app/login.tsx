import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { appConfig } from '@lunara/config';
import { isValidPhilippineMobile } from '@lunara/utils';
import { BrandMark } from '../src/components/ui/brand-mark';
import { Input } from '../src/components/ui/input';
import { riderLogin, riderLoginWithOtp, riderRequestOtp } from '../src/auth';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

const DEV_EMAIL = __DEV__ ? 'rider@lunara.dev' : '';
const DEV_PASSWORD = __DEV__ ? 'password123' : '';
const DEV_PHONE = __DEV__ ? '+639172222222' : '';

type LoginMode = 'password' | 'otp';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function FieldRow({
  icon,
  right,
  style,
  ...inputProps
}: {
  icon: IoniconName;
  right?: React.ReactNode;
} & React.ComponentProps<typeof Input>) {
  return (
    <View style={fieldRowStyles.wrap}>
      <Ionicons name={icon} size={18} color={colors.mutedForeground} style={fieldRowStyles.icon} />
      <Input {...inputProps} style={[fieldRowStyles.input, style]} />
      {right ? <View style={fieldRowStyles.right}>{right}</View> : null}
    </View>
  );
}

const fieldRowStyles = StyleSheet.create({
  wrap: { position: 'relative', marginBottom: spacing.md },
  icon: { position: 'absolute', left: spacing.lg, top: 15, zIndex: 1 },
  input: { paddingLeft: 44 },
  right: { position: 'absolute', right: spacing.lg, top: 0, bottom: 0, justifyContent: 'center' },
});

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [phone, setPhone] = useState(DEV_PHONE);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  async function handlePasswordLogin() {
    setError('');
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

  function contactSupport() {
    void Linking.openURL(`mailto:${appConfig.supportEmail}?subject=Lunara%20Rider%20Support`);
  }

  function switchMode(next: LoginMode) {
    setMode(next);
    setError('');
    setStatus('');
    setOtpSent(false);
    setOtp('');
  }

  const passwordDisabled = loading || !email.trim() || !password;
  const otpDisabled = loading || !phone.trim() || (otpSent && otp.length < 6);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxxl }]}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <BrandMark size="md" />
              <View>
                <Text style={styles.brandName}>{appConfig.name.toUpperCase()}</Text>
                <Text style={styles.brandSub}>RIDER · FIELD OPS</Text>
              </View>
            </View>
            <Text style={styles.heroHeading}>
              Welcome back,{'\n'}
              <Text style={styles.heroAccent}>Rider!</Text>
            </Text>
            <Text style={styles.heroBody}>
              Sign in to manage pickups,{'\n'}deliveries, and earnings on the go.
            </Text>
          </View>

          {/* ── White sheet ── */}
          <View style={styles.sheet}>
            {/* Tab toggle */}
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, mode === 'password' && styles.tabActive]}
                onPress={() => switchMode('password')}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'password' }}
              >
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={mode === 'password' ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.tabText, mode === 'password' && styles.tabTextActive]}>
                  Email
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, mode === 'otp' && styles.tabActive]}
                onPress={() => switchMode('otp')}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'otp' }}
              >
                <Ionicons
                  name="call-outline"
                  size={16}
                  color={mode === 'otp' ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.tabText, mode === 'otp' && styles.tabTextActive]}>
                  Mobile OTP
                </Text>
              </Pressable>
            </View>

            {/* ── Password mode ── */}
            {mode === 'password' ? (
              <>
                <FieldRow
                  icon="mail-outline"
                  placeholder="Work email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  value={email}
                  onChangeText={setEmail}
                  accessibilityLabel="Work email"
                />
                <FieldRow
                  icon="lock-closed-outline"
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel="Password"
                  right={
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  }
                />

                <View style={styles.rememberRow}>
                  <Pressable
                    style={styles.rememberBtn}
                    onPress={() => setRememberMe((v) => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: rememberMe }}
                  >
                    <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                      {rememberMe ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
                    </View>
                    <Text style={styles.rememberText}>Remember me</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8}>
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </Pressable>
                </View>

                {error ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
                    <Text style={styles.errorBannerText}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }: PressableStateCallbackType) => [
                    styles.submitBtn,
                    passwordDisabled && styles.submitBtnDisabled,
                    pressed && !passwordDisabled && styles.submitBtnPressed,
                  ]}
                  onPress={handlePasswordLogin}
                  disabled={passwordDisabled}
                  accessibilityRole="button"
                  accessibilityLabel="Start session"
                >
                  <Text style={styles.submitBtnText}>
                    {loading ? 'Signing in…' : 'Start session'}
                  </Text>
                  {!loading ? <Ionicons name="arrow-forward" size={18} color="#fff" /> : null}
                </Pressable>

                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.orLine} />
                </View>

                <Pressable style={[styles.qrBtn, styles.qrBtnDisabled]} disabled accessibilityRole="button">
                  <Ionicons name="qr-code-outline" size={18} color={colors.mutedForeground} />
                  <Text style={styles.qrBtnTextDisabled}>Scan QR code</Text>
                  <View style={styles.comingSoonPill}>
                    <Text style={styles.comingSoonText}>Coming soon</Text>
                  </View>
                </Pressable>
              </>
            ) : (
              /* ── OTP mode ── */
              <>
                {otpSent ? (
                  <>
                    {status ? (
                      <View style={styles.statusBanner}>
                        <Ionicons name="checkmark-circle-outline" size={15} color={colors.accentDark} />
                        <Text style={styles.statusBannerText}>{status}</Text>
                      </View>
                    ) : null}
                    <FieldRow
                      icon="phone-portrait-outline"
                      placeholder="Mobile number (+639...)"
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      value={phone}
                      onChangeText={setPhone}
                      editable={false}
                      accessibilityLabel="Mobile number (locked)"
                      style={styles.inputLocked}
                    />
                    <FieldRow
                      icon="keypad-outline"
                      placeholder="6-digit code"
                      keyboardType="number-pad"
                      autoComplete="sms-otp"
                      textContentType="oneTimeCode"
                      value={otp}
                      onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                      accessibilityLabel="One-time passcode"
                    />
                  </>
                ) : (
                  <FieldRow
                    icon="phone-portrait-outline"
                    placeholder="Mobile number (+639...)"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    value={phone}
                    onChangeText={setPhone}
                    accessibilityLabel="Mobile number"
                  />
                )}

                {error ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
                    <Text style={styles.errorBannerText}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }: PressableStateCallbackType) => [
                    styles.submitBtn,
                    otpDisabled && styles.submitBtnDisabled,
                    pressed && !otpDisabled && styles.submitBtnPressed,
                  ]}
                  onPress={otpSent ? handleOtpLogin : handleSendOtp}
                  disabled={otpDisabled}
                  accessibilityRole="button"
                >
                  <Text style={styles.submitBtnText}>
                    {loading ? 'Please wait…' : otpSent ? 'Verify & sign in' : 'Send OTP'}
                  </Text>
                  {!loading ? <Ionicons name="arrow-forward" size={18} color="#fff" /> : null}
                </Pressable>

                {otpSent ? (
                  <View style={styles.otpActions}>
                    <Pressable onPress={handleSendOtp} hitSlop={8}>
                      <Text style={styles.otpLink}>Resend code</Text>
                    </Pressable>
                    <Text style={styles.otpDot}>·</Text>
                    <Pressable
                      onPress={() => {
                        setOtpSent(false);
                        setOtp('');
                        setStatus('');
                        setError('');
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.otpMuted}>Change number</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}

            {/* ── Support footer ── */}
            <Pressable style={styles.supportRow} onPress={contactSupport} accessibilityRole="button">
              <View style={styles.supportIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.supportTextWrap}>
                <Text style={styles.supportMain}>
                  Need help?{' '}
                  <Text style={styles.supportLink}>Contact support</Text>
                </Text>
                <Text style={styles.supportSub}>We&apos;re here to help 24/7</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </Pressable>

            {__DEV__ ? (
              <Text style={styles.devHint}>
                Dev: rider@lunara.dev / password123 · OTP +639172222222
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Root & scroll ──
  root: {
    flex: 1,
    backgroundColor: colors.primaryLight,
  },
  safeTop: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },

  // ── Hero ──
  hero: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl + spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  brandName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondaryDark,
    letterSpacing: 0.8,
    marginTop: 1,
  },
  heroHeading: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: spacing.md,
  },
  heroAccent: {
    color: colors.primary,
  },
  heroBody: {
    ...typography.body,
    color: colors.slate700,
    lineHeight: 22,
  },

  // ── White sheet ──
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl + 4,
    borderTopRightRadius: radius.xxl + 4,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    ...shadow.elevated,
  },

  // ── Underline tabs ──
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xxl,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
  },

  // ── Remember me ──
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    marginTop: -spacing.xs,
  },
  rememberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberText: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  // ── Banners ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.destructive,
    lineHeight: 18,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.accentDark,
    lineHeight: 18,
  },

  // ── Submit button ──
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    marginBottom: spacing.xl,
    ...shadow.elevated,
  },
  submitBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // ── OR divider ──
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
  },

  // ── QR scan button ──
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: spacing.md + 2,
    backgroundColor: colors.surface,
    marginBottom: spacing.xxl,
  },
  qrBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  qrBtnDisabled: {
    opacity: 0.55,
    backgroundColor: colors.surfaceMuted,
  },
  qrBtnTextDisabled: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  comingSoonPill: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── OTP actions ──
  inputLocked: {
    opacity: 0.6,
    backgroundColor: colors.surfaceMuted,
  },
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  otpLink: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  otpDot: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  otpMuted: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Support footer ──
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  supportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  supportTextWrap: {
    flex: 1,
  },
  supportMain: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  supportLink: {
    color: colors.primary,
  },
  supportSub: {
    ...typography.caption,
    marginTop: 1,
  },

  // ── Dev hint ──
  devHint: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
