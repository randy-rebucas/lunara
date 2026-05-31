import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { OnboardingProgress } from '../../src/components/onboarding-progress';
import { Screen } from '../../src/components/ui/screen';
import { fetchOnboardingStatus } from '../../src/lib/onboarding';
import { useAuthStore } from '../../src/store/auth';
import { colors, spacing, typography } from '../../src/theme';

export default function OnboardingAddressScreen() {
  const router = useRouter();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const tokens = useAuthStore((s) => s.tokens);
  const [label, setLabel] = useState('Home');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('Manila');
  const [province, setProvince] = useState('Metro Manila');
  const [postalCode, setPostalCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tokens?.accessToken) {
      router.replace('/(auth)/signup');
      return;
    }
    fetchOnboardingStatus(apiFetch).then((status) => {
      if (status.needsProfile) router.replace('/onboarding/profile');
      else if (status.isComplete) router.replace('/(tabs)');
    });
  }, [apiFetch, router, tokens?.accessToken]);

  async function handleSubmit() {
    if (!line1.trim() || !postalCode.trim()) {
      setError('Enter your street address and postal code.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: label.trim() || 'Home',
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          province: province.trim(),
          postalCode: postalCode.trim(),
          isDefault: true,
        }),
      });
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save address');
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
        <OnboardingProgress current="address" />
        <Text style={styles.title}>Add your address</Text>
        <Text style={styles.sub}>We need a pickup and delivery location for laundry services</Text>

        <Input style={styles.field} placeholder="Label (e.g. Home)" value={label} onChangeText={setLabel} />
        <Input style={styles.field} placeholder="Street address" value={line1} onChangeText={setLine1} />
        <Input
          style={styles.field}
          placeholder="Unit / building (optional)"
          value={line2}
          onChangeText={setLine2}
        />
        <View style={styles.row}>
          <Input style={styles.half} placeholder="City" value={city} onChangeText={setCity} />
          <Input style={styles.half} placeholder="Province" value={province} onChangeText={setProvince} />
        </View>
        <Input style={styles.field} placeholder="Postal code" value={postalCode} onChangeText={setPostalCode} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={submitting ? 'Saving…' : 'Finish setup'}
          onPress={handleSubmit}
          disabled={submitting}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xxl },
  card: { borderWidth: 0, gap: spacing.sm },
  title: { ...typography.title, fontSize: 22, marginTop: spacing.lg },
  sub: { ...typography.bodySm, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  half: { flex: 1 },
  error: { color: colors.destructive, marginBottom: spacing.sm, fontSize: 14 },
});
