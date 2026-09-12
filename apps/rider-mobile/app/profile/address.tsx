import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { reverseGeocodeAddress } from '../../src/lib/reverse-geocode';
import type { RiderMe } from '../../src/lib/rider-types';
import { colors, radius, spacing } from '../../src/theme';

// ── Home address screen ─────────────────────────────────────────────────────────

export default function AddressScreen() {
  const router = useRouter();
  const { refresh } = useRiderOperations();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await riderFetch<RiderMe>('/riders/me');
      setLine1(data.homeAddress?.line1 ?? '');
      setLine2(data.homeAddress?.line2 ?? '');
      setCity(data.homeAddress?.city ?? '');
      setProvince(data.homeAddress?.province ?? '');
      setPostalCode(data.homeAddress?.postalCode ?? '');
      setLat(data.homeAddress?.lat);
      setLng(data.homeAddress?.lng);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load address');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function useCurrentLocation() {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location access needed', 'Allow location access to pick your current address.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      setLat(latitude);
      setLng(longitude);

      const geocoded = await reverseGeocodeAddress(latitude, longitude);
      if (geocoded) {
        setLine1(geocoded.line1);
        if (geocoded.line2) setLine2(geocoded.line2);
        setCity(geocoded.city);
        setProvince(geocoded.province);
        if (geocoded.postalCode) setPostalCode(geocoded.postalCode);
      }
    } catch (e) {
      Alert.alert('Could not get location', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLocating(false);
    }
  }

  async function saveAddress() {
    setError('');
    setSaving(true);
    try {
      await riderFetch('/riders/me', {
        method: 'PATCH',
        body: JSON.stringify({
          homeAddress: {
            line1: line1.trim() || undefined,
            line2: line2.trim() || undefined,
            city: city.trim() || undefined,
            province: province.trim() || undefined,
            postalCode: postalCode.trim() || undefined,
            lat,
            lng,
          },
        }),
      });
      refresh();
      Alert.alert('Address saved', 'Your home address has been updated.');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save address');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen inStack scroll={false}>
        <DataLoadState loading error="" loadingMessage="Loading address…" />
      </Screen>
    );
  }

  if (error && !loaded) {
    return (
      <Screen inStack scroll={false}>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen inStack scroll={false}>
      <KeyboardSafeScrollView contentContainerStyle={styles.content}>
        <Section icon="location-outline" title="Home Address">
          <Pressable
            style={({ pressed }) => [localStyles.locateBtn, pressed && localStyles.locateBtnPressed]}
            onPress={useCurrentLocation}
            disabled={locating}
            accessibilityRole="button"
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="locate-outline" size={15} color={colors.primary} />
            )}
            <Text style={localStyles.locateBtnText}>
              {locating ? 'Getting your location…' : 'Use current location'}
            </Text>
          </Pressable>
          <Field label="ADDRESS LINE 1">
            <Input
              placeholder="House no., street name"
              value={line1}
              onChangeText={setLine1}
              autoCapitalize="words"
              textContentType="streetAddressLine1"
            />
          </Field>
          <Field label="ADDRESS LINE 2">
            <Input
              placeholder="Barangay, subdivision (optional)"
              value={line2}
              onChangeText={setLine2}
              autoCapitalize="words"
              textContentType="streetAddressLine2"
            />
          </Field>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Field label="CITY">
                <Input
                  placeholder="City"
                  value={city}
                  onChangeText={setCity}
                  autoCapitalize="words"
                  textContentType="addressCity"
                />
              </Field>
            </View>
            <View style={styles.nameField}>
              <Field label="PROVINCE">
                <Input
                  placeholder="Province"
                  value={province}
                  onChangeText={setProvince}
                  autoCapitalize="words"
                  textContentType="addressState"
                />
              </Field>
            </View>
          </View>
          <Field label="POSTAL CODE">
            <Input
              placeholder="0000"
              value={postalCode}
              onChangeText={setPostalCode}
              keyboardType="number-pad"
              textContentType="postalCode"
            />
          </Field>
        </Section>

        <FormErrorBanner message={error} />
        <SaveButton saving={saving} onPress={saveAddress} />
      </KeyboardSafeScrollView>
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  locateBtnPressed: { opacity: 0.85 },
  locateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
