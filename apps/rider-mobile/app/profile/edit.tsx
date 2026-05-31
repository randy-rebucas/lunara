import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRiderOperations } from '../../src/context/rider-operations';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { Screen } from '../../src/components/ui/screen';
import { DataLoadState } from '../../src/components/data-load-state';
import { riderFetch } from '../../src/api';
import { VEHICLE_TYPES, type RiderMe, type VehicleType } from '../../src/lib/rider-types';
import { colors, spacing, typography } from '../../src/theme';

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
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
  const [plateNumber, setPlateNumber] = useState('');
  const [orCrNumber, setOrCrNumber] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await riderFetch<RiderMe>('/riders/me');
      setFirstName(data.firstName ?? data.user?.firstName ?? '');
      setLastName(data.lastName ?? data.user?.lastName ?? '');
      setEmail(data.user?.email ?? '');
      setPhone(data.user?.phone ?? '');
      setLine1(data.homeAddress?.line1 ?? '');
      setLine2(data.homeAddress?.line2 ?? '');
      setCity(data.homeAddress?.city ?? '');
      setProvince(data.homeAddress?.province ?? '');
      setPostalCode(data.homeAddress?.postalCode ?? '');
      setVehicleType((data.vehicleType as VehicleType) ?? 'motorcycle');
      setPlateNumber(data.plateNumber ?? '');
      setOrCrNumber(data.orCrNumber ?? '');
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
          homeAddress: {
            line1: line1.trim(),
            line2: line2.trim() || undefined,
            city: city.trim(),
            province: province.trim(),
            postalCode: postalCode.trim(),
          },
          vehicleType,
          plateNumber: plateNumber.trim(),
          orCrNumber: orCrNumber.trim(),
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
      <Screen scroll={false}>
        <DataLoadState loading error="" loadingMessage="Loading profile…" />
      </Screen>
    );
  }

  if (error && !firstName) {
    return (
      <Screen scroll={false}>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <KeyboardSafeScrollView contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Rider information</Text>
          <Input placeholder="First name" value={firstName} onChangeText={setFirstName} />
          <Input placeholder="Last name" value={lastName} onChangeText={setLastName} style={styles.fieldGap} />
          <Input placeholder="Email (read-only)" value={email} editable={false} style={styles.readOnly} />
          <Input
            placeholder="Mobile number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.fieldGap}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Home address</Text>
          <Input placeholder="Address line 1" value={line1} onChangeText={setLine1} />
          <Input placeholder="Address line 2 (optional)" value={line2} onChangeText={setLine2} style={styles.fieldGap} />
          <Input placeholder="City" value={city} onChangeText={setCity} style={styles.fieldGap} />
          <Input placeholder="Province" value={province} onChangeText={setProvince} style={styles.fieldGap} />
          <Input placeholder="Postal code" value={postalCode} onChangeText={setPostalCode} style={styles.fieldGap} />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle information</Text>
          <View style={styles.vehicleRow}>
            {VEHICLE_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.vehicleChip, vehicleType === type && styles.vehicleChipActive]}
                onPress={() => setVehicleType(type)}
              >
                <Text
                  style={[
                    styles.vehicleChipText,
                    vehicleType === type && styles.vehicleChipTextActive,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
          <Input placeholder="Plate number" value={plateNumber} onChangeText={setPlateNumber} style={styles.fieldGap} />
          <Input placeholder="OR/CR number" value={orCrNumber} onChangeText={setOrCrNumber} style={styles.fieldGap} />
        </Card>

        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        <Button
          label={saving ? 'Saving…' : 'Save profile'}
          onPress={saveProfile}
          disabled={saving}
          style={styles.saveBtn}
        />
      </KeyboardSafeScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl, gap: spacing.md },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.subheading, fontSize: 16, marginBottom: spacing.xs },
  fieldGap: { marginTop: spacing.sm },
  readOnly: { opacity: 0.7 },
  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vehicleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  vehicleChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  vehicleChipText: { ...typography.bodySm, textTransform: 'capitalize' },
  vehicleChipTextActive: { color: colors.primary, fontWeight: '700' },
  inlineError: { ...typography.bodySm, color: colors.destructive },
  saveBtn: { marginTop: spacing.sm },
});
