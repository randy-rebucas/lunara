import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRiderOperations } from '../../src/context/rider-operations';
import { Input } from '../../src/components/ui/input';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { Screen } from '../../src/components/ui/screen';
import { DataLoadState } from '../../src/components/data-load-state';
import {
  Field,
  FormErrorBanner,
  SaveButton,
  Section,
  profileFormStyles as styles,
} from '../../src/components/profile-form';
import { riderFetch } from '../../src/api';
import type { RiderMe } from '../../src/lib/rider-types';
import { colors } from '../../src/theme';

// ── Edit profile screen (name, email, mobile number) ───────────────────────────

export default function EditProfileScreen() {
  const router = useRouter();
  const { refresh } = useRiderOperations();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await riderFetch<RiderMe>('/riders/me');
      setFirstName(data.firstName ?? data.user?.firstName ?? '');
      setLastName(data.lastName ?? data.user?.lastName ?? '');
      setEmail(data.user?.email ?? '');
      setPhone(data.user?.phone ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile() {
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!phone.trim()) {
      setError('Mobile number is required.');
      return;
    }
    setSaving(true);
    try {
      await riderFetch('/riders/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        }),
      });
      refresh();
      Alert.alert('Profile saved', 'Your rider profile has been updated.');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen inStack scroll={false}>
        <DataLoadState loading error="" loadingMessage="Loading profile…" />
      </Screen>
    );
  }

  if (error && !firstName) {
    return (
      <Screen inStack scroll={false}>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen inStack scroll={false}>
      <KeyboardSafeScrollView contentContainerStyle={styles.content}>
        <Section icon="person-outline" title="Rider Information">
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Field label="FIRST NAME" required>
                <Input
                  placeholder="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  textContentType="givenName"
                />
              </Field>
            </View>
            <View style={styles.nameField}>
              <Field label="LAST NAME" required>
                <Input
                  placeholder="Last name"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  textContentType="familyName"
                />
              </Field>
            </View>
          </View>
          <Field label="EMAIL ADDRESS" locked>
            <Input
              placeholder="Email"
              value={email}
              editable={false}
              style={{ opacity: 0.55, backgroundColor: colors.surfaceMuted }}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </Field>
          <Field label="MOBILE NUMBER" required>
            <Input
              placeholder="+639..."
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />
          </Field>
        </Section>

        <FormErrorBanner message={error} />
        <SaveButton saving={saving} onPress={saveProfile} />
      </KeyboardSafeScrollView>
    </Screen>
  );
}
