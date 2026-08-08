import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { appConfig } from '@lunara/config';
import {
  COUNTRIES,
  buildE164,
  detectCountry,
  isValidLocalNumber,
  type Country,
} from '../../src/lib/country-codes';
import { redirectAfterAuth } from '../../src/lib/onboarding';
import { brandIconSource } from '../../src/lib/brand-icon';
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

const TRUST_ITEMS = [
  { icon: 'shield-checkmark-outline' as const, title: 'Secure & private', body: 'Your data is safe with us.' },
  { icon: 'flash-outline' as const, title: 'Quick & easy', body: 'Sign in in seconds with OTP.' },
  { icon: 'notifications-outline' as const, title: 'Stay updated', body: 'Get order updates instantly.' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithOtp, loginWithEmail, requestOtp, apiFetch } = useAuthStore();
  const [mode, setMode] = useState<'otp' | 'email'>('otp');
  const [otpStep, setOtpStep] = useState<OtpStep>('phone');
  const [country, setCountry] = useState<Country>(() => detectCountry());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [localPhone, setLocalPhone] = useState('');
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

  const filteredCountries = useMemo(() => {
    const q = pickerQuery.toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [pickerQuery]);

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
    if (!isValidLocalNumber(country, localPhone)) {
      setError(`Enter a valid ${country.name} mobile number.`);
      return;
    }
    const e164 = buildE164(country.dialCode, localPhone);
    setSubmitting(true);
    try {
      const result = await requestOtp(e164);
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
      const e164 = buildE164(country.dialCode, localPhone);
      await loginWithOtp(verifiedPhone || e164, otp);
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
    <Screen scroll padded={false}>
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <View style={styles.heroBlob} />

        <View style={styles.heroTop}>
          <View style={styles.brandRow}>
            <BrandMark size="sm" />
            <View>
              <Text style={styles.brandName}>{appConfig.name}</Text>
              <Text style={styles.tagline}>Laundry made simple</Text>
            </View>
          </View>
          <Image
            source={brandIconSource}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.heroBottom}>
          <Text style={styles.heroTitle}>Welcome back!</Text>
          <Text style={styles.heroSub}>Sign in to book and track your laundry.</Text>
        </View>
      </View>

      {/* ── Form ── */}
      <View style={styles.formSection}>
        <Card elevated style={styles.formCard}>
          {/* Mode tabs */}
          <View style={styles.modeRow}>
            <Pressable
              style={({ pressed }) => [styles.modeBtn, mode === 'otp' && styles.modeBtnActive, pressed && styles.modeBtnPressed]}
              onPress={() => switchMode('otp')}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Phone OTP"
              accessibilityState={{ selected: mode === 'otp' }}
            >
              <Ionicons name="phone-portrait-outline" size={14} color={mode === 'otp' ? colors.primary : colors.muted} />
              <Text style={mode === 'otp' ? styles.modeTextActive : styles.modeText}>Phone OTP</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.modeBtn, mode === 'email' && styles.modeBtnActive, pressed && styles.modeBtnPressed]}
              onPress={() => switchMode('email')}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Email"
              accessibilityState={{ selected: mode === 'email' }}
            >
              <Ionicons name="mail-outline" size={14} color={mode === 'email' ? colors.primary : colors.muted} />
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
              {/* Phone input with country picker */}
              <View style={styles.phoneInputWrap}>
                <Pressable
                  style={({ pressed }) => [styles.countryBtn, pressed && styles.countryBtnPressed]}
                  onPress={() => { setPickerQuery(''); setPickerOpen(true); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Country code ${country.dialCode}, ${country.name}. Tap to change.`}
                >
                  <Text style={styles.flag}>{country.flag}</Text>
                  <Text style={styles.dialCode}>{country.dialCode}</Text>
                  <Ionicons name="chevron-down" size={12} color={colors.muted} />
                </Pressable>
                <Input
                  style={styles.phoneInput}
                  placeholder="Mobile number"
                  value={localPhone}
                  onChangeText={(v) => setLocalPhone(v.replace(/^0+/, '').replace(/\D/g, ''))}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>
              <Text style={styles.phoneNote}>
                Enter your number without the leading 0 — country code is already applied.
              </Text>

              {/* Trust row */}
              <View style={styles.trustRow}>
                {TRUST_ITEMS.map((item) => (
                  <View key={item.title} style={styles.trustItem}>
                    <View style={styles.trustIconWrap}>
                      <Ionicons name={item.icon} size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.trustTitle}>{item.title}</Text>
                    <Text style={styles.trustBody}>{item.body}</Text>
                  </View>
                ))}
              </View>

              <Button
                label={submitting ? 'Sending…' : 'Send OTP'}
                onPress={handleSendOtp}
                disabled={submitting || !localPhone.trim()}
                style={styles.submitBtn}
              />
            </>
          ) : (
            <>
              <View style={styles.phoneHintRow}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.accent} />
                <Text style={styles.phoneHint}>Code sent to {verifiedPhone || buildE164(country.dialCode, localPhone)}</Text>
              </View>
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
              <Pressable
                onPress={handleSendOtp}
                style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
                disabled={submitting || resendCooldown > 0}
                accessibilityRole="button"
                accessibilityLabel={resendCooldown > 0 ? `Resend code, wait ${resendCooldown} seconds` : 'Resend code'}
              >
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
                style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Change phone number"
              >
                <Text style={styles.mutedLinkText}>Change number</Text>
              </Pressable>
            </>
          )}

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}
        </Card>

        <Text style={styles.footer}>
          New here?{' '}
          <Link href="/(auth)/signup" style={styles.footerLink}>
            Create account
          </Link>
        </Text>
      </View>

      {/* ── Country picker modal ── */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select country</Text>

            {/* Search */}
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={16} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search country or code…"
                placeholderTextColor={colors.muted}
                value={pickerQuery}
                onChangeText={setPickerQuery}
                autoCapitalize="none"
              />
              {pickerQuery.length > 0 ? (
                <Pressable onPress={() => setPickerQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.countryRow, pressed && styles.countryRowPressed, item.code === country.code && styles.countryRowActive]}
                  onPress={() => {
                    setCountry(item);
                    setPickerOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} ${item.dialCode}`}
                  accessibilityState={{ selected: item.code === country.code }}
                >
                  <Text style={styles.countryRowFlag}>{item.flag}</Text>
                  <Text style={styles.countryRowName}>{item.name}</Text>
                  <Text style={styles.countryRowDial}>{item.dialCode}</Text>
                  {item.code === country.code ? (
                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                  ) : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* ── Hero ── */
  hero: {
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
    paddingBottom: spacing.xxl,
  },
  heroBlob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.primary + '18',
    right: -60,
    top: -60,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  brandName: { fontSize: 16, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
  tagline: { fontSize: 11, color: colors.primary + 'AA', fontWeight: '500', marginTop: 1 },
  heroImage: { width: 140, height: 140, marginTop: -spacing.md, marginRight: -spacing.md },
  heroBottom: { paddingHorizontal: spacing.xl, marginTop: spacing.md },
  heroTitle: { fontSize: 28, fontWeight: '800', color: colors.foreground, letterSpacing: -0.5 },
  heroSub: { ...typography.bodySm, color: colors.slate700, marginTop: spacing.xs },

  /* ── Form section ── */
  formSection: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  formCard: { borderWidth: 0, gap: spacing.xs },

  /* Mode tabs */
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  modeBtnPressed: { opacity: 0.75 },
  modeText: { color: colors.muted, fontWeight: '500', fontSize: 13 },
  modeTextActive: { color: colors.primary, fontWeight: '600', fontSize: 13 },

  /* Phone input with country picker */
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  countryBtnPressed: { backgroundColor: colors.primaryLight },
  flag: { fontSize: 18, lineHeight: 22 },
  dialCode: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  phoneInput: { flex: 1, borderWidth: 0, borderRadius: 0 },

  /* Trust row */
  trustRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, marginTop: spacing.xs },
  trustItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  trustIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  trustTitle: { fontSize: 11, fontWeight: '700', color: colors.foreground, textAlign: 'center' },
  trustBody: { fontSize: 10, color: colors.muted, textAlign: 'center', lineHeight: 14 },

  /* Misc */
  field: { marginBottom: spacing.md },
  phoneHintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  phoneHint: { ...typography.bodySm, flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  error: { color: colors.destructive, fontSize: 14, flex: 1 },
  submitBtn: { marginTop: spacing.xs },
  linkBtn: { marginTop: spacing.md, alignItems: 'center' },
  linkBtnPressed: { opacity: 0.6 },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  linkTextDisabled: { color: colors.muted },
  mutedLinkText: { color: colors.muted, fontSize: 14 },
  footer: { ...typography.bodySm, textAlign: 'center', marginTop: spacing.xl },
  footerLink: { color: colors.primary, fontWeight: '600' },

  /* ── Country picker modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '75%',
    paddingBottom: spacing.xxxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.foreground },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  countryRowPressed: { backgroundColor: colors.surfaceMuted },
  countryRowActive: { backgroundColor: colors.primaryLight },
  countryRowFlag: { fontSize: 22, width: 32, textAlign: 'center' },
  countryRowName: { flex: 1, fontSize: 14, color: colors.foreground, fontWeight: '500' },
  countryRowDial: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  phoneNote: { fontSize: 11, color: colors.muted, marginTop: -spacing.xs, marginBottom: spacing.md },
});
