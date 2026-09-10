import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { appConfig } from '@lunara/config';
import { BrandMark } from '../src/components/ui/brand-mark';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { Input } from '../src/components/ui/input';
import { KeyboardSafeScrollView } from '../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../src/store/auth';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

const DEV_EMAIL = __DEV__ ? 'staff@lunara.dev' : '';
const DEV_PASSWORD = __DEV__ ? 'password123' : '';

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
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)' as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }

  function contactSupport() {
    void Linking.openURL(`mailto:${appConfig.supportEmail}?subject=Lunara%20Partner%20Support`);
  }

  const disabled = loading || !email.trim() || !password;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <KeyboardSafeScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
          useTopSafeInset={false}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={styles.heroBlobOuter} pointerEvents="none" />
            <View style={styles.heroBlobInner} pointerEvents="none" />
            <Image
              source={require('../assets/hero-towels.png')}
              style={styles.heroPhoto}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              resizeMode="cover"
            />
            <Text
              style={styles.heroDecoration}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              Clean{'\n'}Operations{'\n'}Happier{'\n'}Communities
            </Text>
            <View style={styles.brandRow}>
              <BrandMark size="md" />
              <View>
                <Text style={styles.brandName}>{appConfig.name.toUpperCase()}</Text>
                <Text style={styles.brandSub}>PARTNER · SHOP OPS</Text>
              </View>
            </View>
            <Text style={styles.heroHeading}>
              Welcome back,{'\n'}
              <Text style={styles.heroAccent}>Team!</Text>
            </Text>
            <Text style={styles.heroBody}>
              Sign in to manage orders,{'\n'}staff, and scans for your shop.
            </Text>
          </View>

          {/* ── White sheet ── */}
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xxxl }]}>
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

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            <Button
              label={loading ? 'Signing in…' : 'Sign in'}
              icon={loading ? undefined : 'arrow-forward'}
              size="lg"
              onPress={handleLogin}
              disabled={disabled}
              style={styles.submitBtn}
            />

            {/* ── Support footer ── */}
            <Pressable onPress={contactSupport} accessibilityRole="button">
              <Card primary style={styles.supportRow}>
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
              </Card>
            </Pressable>

            {__DEV__ ? (
              <Text style={styles.devHint}>Dev: staff@lunara.dev / password123</Text>
            ) : null}
          </View>
        </KeyboardSafeScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primaryLight },
  safeTop: { flex: 1 },
  scroll: { flexGrow: 1 },

  hero: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl + spacing.lg,
    overflow: 'hidden',
  },
  heroBlobOuter: {
    position: 'absolute',
    top: -60,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: radius.full,
    backgroundColor: colors.primaryBorder,
    opacity: 0.35,
  },
  heroBlobInner: {
    position: 'absolute',
    top: 20,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    opacity: 0.12,
  },
  heroPhoto: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 170,
    height: 191,
    opacity: 0.9,
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
  heroAccent: { color: colors.primary },
  heroDecoration: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    width: 110,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 19,
    color: colors.primaryBorder,
    textAlign: 'right',
    transform: [{ rotate: '-4deg' }],
  },
  heroBody: {
    ...typography.body,
    color: colors.slate700,
    lineHeight: 22,
  },

  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl + 4,
    borderTopRightRadius: radius.xxl + 4,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    ...shadow.elevated,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
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

  submitBtn: {
    borderRadius: radius.xl,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    ...shadow.elevated,
  },

  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
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
  supportTextWrap: { flex: 1 },
  supportMain: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  supportLink: { color: colors.primary },
  supportSub: { ...typography.caption, marginTop: 1 },

  devHint: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
