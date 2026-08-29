import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { getShareWebsiteUrl } from '@lunara/config';
import { formatPhone } from '@lunara/utils';
import {
  COUNTRIES,
  buildE164,
  isValidLocalNumber,
  type Country,
} from '../../src/lib/country-codes';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { OnboardingProgress } from '../../src/components/onboarding-progress';
import { Screen } from '../../src/components/ui/screen';
import { redirectAfterAuth } from '../../src/lib/onboarding';
import { useAuthStore } from '../../src/store/auth';
import { brandName, colors, radius, spacing, typography } from '../../src/theme';

type Step = 'phone' | 'otp';

function formatCooldown(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function SignUpScreen() {
  const router = useRouter();
  const { signupWithOtp, requestOtp, apiFetch } = useAuthStore();
  const [step, setStep] = useState<Step>('phone');

  // Country picker
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  const [localPhone, setLocalPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');

  // OTP digit boxes
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);

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

  const otpValue = otpDigits.join('');

  function startResendCooldown() {
    setResendCooldown(30);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function handleOtpDigit(value: string, index: number) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      const next = [...otpDigits];
      next[index - 1] = '';
      setOtpDigits(next);
      otpRefs.current[index - 1]?.focus();
    }
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
      setOtpDigits(Array(6).fill(''));
      setStep('otp');
      startResendCooldown();
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
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
      const targetPhone = verifiedPhone || formatPhone(e164);
      await signupWithOtp(targetPhone, otpValue);
      await redirectAfterAuth(apiFetch, router);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired OTP');
    } finally {
      setSubmitting(false);
    }
  }

  function handleChangeNumber() {
    setStep('phone');
    setOtpDigits(Array(6).fill(''));
    setVerifiedPhone('');
    setError('');
    setResendCooldown(0);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  }

  const displayPhone = verifiedPhone || buildE164(country.dialCode, localPhone);

  const privacyUrl =
    (Constants.expoConfig?.extra?.privacyUrl as string | undefined) ?? `${getShareWebsiteUrl()}/privacy`;
  const termsUrl =
    (Constants.expoConfig?.extra?.termsUrl as string | undefined) ?? `${getShareWebsiteUrl()}/terms`;

  function openUrl(url: string) {
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open link', url);
    });
  }

  return (
    <Screen scroll padded={false}>
      <View style={styles.formSection}>
        {/* Brand header */}
        <View style={styles.header}>
          <BrandMark size="sm" />
          <Text style={styles.brandName}>{brandName}</Text>
        </View>

        <Card elevated style={styles.formCard}>
          <OnboardingProgress current="profile" />

          {step === 'phone' ? (
            <>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>Sign up with your mobile number to book laundry</Text>

              {/* Phone input with country picker */}
              <Text style={styles.inputLabel}>Mobile number</Text>
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
                {localPhone.length > 0 && isValidLocalNumber(country, localPhone) ? (
                  <Ionicons name="checkmark" size={16} color={colors.accent} style={styles.phoneCheck} />
                ) : null}
              </View>
              <Text style={styles.phoneNote}>
                Enter without the leading 0 — country code is already applied.
              </Text>

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              <Button
                label={submitting ? 'Sending…' : 'Send OTP'}
                onPress={handleSendOtp}
                disabled={submitting || !localPhone.trim()}
                style={styles.submitBtn}
              />

              <Text style={styles.termsText}>
                By continuing, you agree to our{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => openUrl(termsUrl)}
                  accessibilityRole="link"
                >
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => openUrl(privacyUrl)}
                  accessibilityRole="link"
                >
                  Privacy Policy.
                </Text>
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Verify your number</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to{' '}
                <Text style={styles.phoneHighlight}>{displayPhone}</Text>
              </Text>

              {/* 6-box OTP input */}
              <View style={styles.otpRow}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TextInput
                    key={i}
                    ref={(ref) => { otpRefs.current[i] = ref; }}
                    style={[styles.otpBox, otpDigits[i] ? styles.otpBoxFilled : null]}
                    value={otpDigits[i] || ''}
                    onChangeText={(v) => handleOtpDigit(v, i)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                  />
                ))}
              </View>

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              <Button
                label={submitting ? 'Verifying…' : 'Continue'}
                onPress={handleVerifyOtp}
                disabled={submitting || otpValue.length < 6}
                style={styles.submitBtn}
              />

              <View style={styles.resendRow}>
                <Text style={styles.resendBase}>Didn&apos;t receive the code?{' '}</Text>
                <Pressable
                  onPress={handleSendOtp}
                  disabled={submitting || resendCooldown > 0}
                  accessibilityRole="button"
                >
                  <Text style={[styles.resendLink, resendCooldown > 0 && styles.resendDisabled]}>
                    Resend OTP
                  </Text>
                </Pressable>
                {resendCooldown > 0 ? (
                  <Text style={styles.resendTimer}> in {formatCooldown(resendCooldown)}</Text>
                ) : null}
              </View>

              <Pressable
                onPress={handleChangeNumber}
                style={({ pressed }) => [styles.changeNumBtn, pressed && styles.changeNumBtnPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.changeNumText}>Change phone number</Text>
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
                  style={({ pressed }) => [
                    styles.countryRow,
                    pressed && styles.countryRowPressed,
                    item.code === country.code && styles.countryRowActive,
                  ]}
                  onPress={() => { setCountry(item); setPickerOpen(false); }}
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
  formSection: { padding: spacing.xl, paddingBottom: spacing.xxxl },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  brandName: { fontSize: 16, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },

  /* Card */
  formCard: { borderWidth: 0, gap: spacing.xs },
  title: { ...typography.title, fontSize: 22, marginTop: spacing.md },
  subtitle: { ...typography.bodySm, color: colors.slate700, marginBottom: spacing.md },

  /* Phone input */
  inputLabel: { fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: spacing.xs },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
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
  phoneCheck: { marginRight: spacing.md },
  phoneNote: { fontSize: 11, color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.sm },

  /* Error */
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  error: { color: colors.destructive, fontSize: 13, flex: 1 },

  submitBtn: { marginTop: spacing.md },

  /* Terms */
  termsText: { ...typography.caption, textAlign: 'center', marginTop: spacing.md, color: colors.muted },
  termsLink: { color: colors.primary, fontWeight: '600' },

  /* OTP boxes */
  otpRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginVertical: spacing.lg },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
  },
  otpBoxFilled: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  phoneHighlight: { color: colors.primary, fontWeight: '600' },

  /* Resend */
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  resendBase: { ...typography.bodySm, color: colors.muted },
  resendLink: { ...typography.bodySm, color: colors.primary, fontWeight: '600' },
  resendDisabled: { color: colors.muted },
  resendTimer: { ...typography.bodySm, color: colors.muted },
  changeNumBtn: { marginTop: spacing.sm, alignItems: 'center', paddingVertical: spacing.xs },
  changeNumBtnPressed: { opacity: 0.6 },
  changeNumText: { color: colors.muted, fontSize: 13 },

  /* Footer */
  footer: { ...typography.bodySm, textAlign: 'center', marginTop: spacing.xl },
  footerLink: { color: colors.primary, fontWeight: '600' },

  /* Country picker modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '75%',
    paddingBottom: spacing.xxxl,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceMuted, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.foreground },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  countryRowPressed: { backgroundColor: colors.surfaceMuted },
  countryRowActive: { backgroundColor: colors.primaryLight },
  countryRowFlag: { fontSize: 22, width: 32, textAlign: 'center' },
  countryRowName: { flex: 1, fontSize: 14, color: colors.foreground, fontWeight: '500' },
  countryRowDial: { fontSize: 13, color: colors.muted, fontWeight: '600' },
});
