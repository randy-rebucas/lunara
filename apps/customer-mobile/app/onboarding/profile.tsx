import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { OnboardingProgress } from '../../src/components/onboarding-progress';
import { Screen } from '../../src/components/ui/screen';
import {
  fetchOnboardingStatus,
  getOnboardingPath,
} from '../../src/lib/onboarding';
import { useAuthStore } from '../../src/store/auth';
import { colors, spacing, typography } from '../../src/theme';

export default function OnboardingProfileScreen() {
  const router = useRouter();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const tokens = useAuthStore((s) => s.tokens);
  const [checking, setChecking] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tokens?.accessToken) {
      router.replace('/(auth)/signup');
      return;
    }
    fetchOnboardingStatus(apiFetch)
      .then((status) => {
        if (!status.needsProfile && status.needsAddress) {
          router.replace('/onboarding/address');
        } else if (status.isComplete) {
          router.replace('/(tabs)');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [apiFetch, router, tokens?.accessToken]);

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      // `email` is intentionally NOT sent here: UpdateCustomerDto has no email field (email lives
      // on the User model, a different module), and the API's global ValidationPipe uses
      // forbidNonWhitelisted — sending it rejects the entire request with a 400, which was
      // blocking onboarding completion outright for anyone who filled in this optional field.
      // See docs/audits/customer-mobile/onboarding.md, Finding #1.
      await apiFetch('/customers/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      const status = await fetchOnboardingStatus(apiFetch);
      router.replace(getOnboardingPath(status));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return null;

  return (
    <Screen scroll padded={false}>
      <View style={styles.formSection}>
        <View style={styles.header}>
          <BrandMark size="sm" />
        </View>

        <Card elevated style={styles.card}>
          <OnboardingProgress current="profile" />

          <Text style={styles.title}>Tell us about you</Text>
          <Text style={styles.sub}>We&apos;ll use this to personalize your experience</Text>

          <Text style={styles.inputLabel}>First name</Text>
          <Input
            style={styles.field}
            placeholder="Juan"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            maxLength={80}
          />

          <Text style={styles.inputLabel}>Last name</Text>
          <Input
            style={styles.field}
            placeholder="Dela Cruz"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            maxLength={80}
          />

          <Text style={styles.inputLabel}>
            Email address <Text style={styles.optional}>(optional)</Text>
          </Text>
          <Input
            style={styles.field}
            placeholder="juan@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <View style={styles.emailHintRow}>
            <Ionicons name="information-circle-outline" size={13} color={colors.muted} />
            <Text style={styles.emailHint}>
              We&apos;ll send updates about your orders and promotions.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={submitting ? 'Saving…' : 'Continue'}
            onPress={handleSubmit}
            disabled={submitting}
            style={styles.submitBtn}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formSection: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  header: { marginBottom: spacing.xl },
  card: { borderWidth: 0, gap: spacing.xs },
  title: { ...typography.title, fontSize: 22, marginTop: spacing.md },
  sub: { ...typography.bodySm, color: colors.slate700, marginBottom: spacing.md },
  inputLabel: { fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: spacing.xs },
  optional: { fontWeight: '400', color: colors.muted },
  field: { marginBottom: spacing.md },
  emailHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  emailHint: { ...typography.caption, color: colors.muted, flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  error: { color: colors.destructive, fontSize: 13, flex: 1 },
  submitBtn: { marginTop: spacing.sm },
});
