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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tokens?.accessToken) {
      router.replace('/(auth)/signup');
      return;
    }
    fetchOnboardingStatus(apiFetch).then((status) => {
      if (!status.needsProfile && status.needsAddress) {
        router.replace('/onboarding/address');
      } else if (status.isComplete) {
        router.replace('/(tabs)');
      }
    });
  }, [apiFetch, router, tokens?.accessToken]);

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
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

  return (
    <Screen scroll>
      <View style={styles.header}>
        <BrandMark size="sm" />
      </View>

      <Card elevated style={styles.card}>
        <OnboardingProgress current="profile" />
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.sub}>Tell us your name so we can personalize your orders</Text>

        <View style={styles.nameRow}>
          <Input
            style={styles.nameField}
            placeholder="First name"
            value={firstName}
            onChangeText={setFirstName}
          />
          <Input
            style={styles.nameField}
            placeholder="Last name"
            value={lastName}
            onChangeText={setLastName}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={submitting ? 'Saving…' : 'Continue'}
          onPress={handleSubmit}
          disabled={submitting}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xxl },
  card: { borderWidth: 0, gap: spacing.md },
  title: { ...typography.title, fontSize: 22, marginTop: spacing.lg },
  sub: { ...typography.bodySm, marginBottom: spacing.lg },
  nameRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  nameField: { flex: 1 },
  error: { color: colors.destructive, marginBottom: spacing.sm, fontSize: 14 },
});
