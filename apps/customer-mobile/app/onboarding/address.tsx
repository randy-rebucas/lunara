import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { MapPickerModal } from '../../src/components/map-picker-modal';
import { OnboardingProgress } from '../../src/components/onboarding-progress';
import { Screen } from '../../src/components/ui/screen';
import { fetchOnboardingStatus, getOnboardingPath } from '../../src/lib/onboarding';
import type { GeocodedAddressFields } from '../../src/lib/reverse-geocode';
import { reverseGeocodeAddress } from '../../src/lib/reverse-geocode';
import { useAuthStore } from '../../src/store/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

type InputMethod = 'manual' | 'location' | 'map';

export default function OnboardingAddressScreen() {
  const router = useRouter();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const tokens = useAuthStore((s) => s.tokens);
  const [checking, setChecking] = useState(true);
  const [method, setMethod] = useState<InputMethod>('manual');
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tokens?.accessToken) {
      router.replace('/(auth)/signup');
      return;
    }
    fetchOnboardingStatus(apiFetch)
      .then((status) => {
        if (status.needsProfile) {
          router.replace('/onboarding/profile');
        } else if (status.isComplete) {
          router.replace('/(tabs)');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [apiFetch, router, tokens?.accessToken]);

  function clearAddressFields() {
    setLine1('');
    setLine2('');
    setCity('');
    setProvince('');
    setPostalCode('');
    setLatitude(null);
    setLongitude(null);
    setError('');
  }

  function selectMethod(m: InputMethod) {
    setMethod(m);
    if (m === 'manual') clearAddressFields();
    if (m === 'location') handleUseLocation();
    if (m === 'map') setShowMap(true);
  }

  async function handleUseLocation() {
    setLocating(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location access needed',
          'Allow location access so Lunara can pin your pickup address accurately.',
        );
        setMethod('manual');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng } = pos.coords;
      setLatitude(lat);
      setLongitude(lng);

      try {
        const geocoded = await reverseGeocodeAddress(lat, lng);
        if (geocoded) {
          setLine1(geocoded.line1 || '');
          setLine2(geocoded.line2 || '');
          setCity(geocoded.city || '');
          setProvince(geocoded.province || '');
          setPostalCode(geocoded.postalCode || '');
        } else {
          setError('Location pinned. Review or complete the address fields below.');
        }
      } catch {
        setError('Location pinned. Review or complete the address fields below.');
      }
    } catch {
      setError('Could not get your location. Try again or enter the address manually.');
      setMethod('manual');
    } finally {
      setLocating(false);
    }
  }

  function handleMapConfirm(lat: number, lng: number, geocoded: GeocodedAddressFields | null) {
    setShowMap(false);
    setLatitude(lat);
    setLongitude(lng);
    if (geocoded) {
      setLine1(geocoded.line1 || '');
      setLine2(geocoded.line2 || '');
      setCity(geocoded.city || '');
      setProvince(geocoded.province || '');
      setPostalCode(geocoded.postalCode || '');
    } else {
      setError('Location pinned. Review or complete the address fields below.');
    }
  }

  async function handleSubmit() {
    if (!line1.trim()) {
      setError('Enter your street address.');
      return;
    }
    if (!city.trim() || !province.trim()) {
      setError('Enter your city and province.');
      return;
    }
    if (!/^\d{4}$/.test(postalCode.trim())) {
      setError('Enter a valid 4-digit postal code.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiFetch('/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: 'Home',
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          province: province.trim(),
          postalCode: postalCode.trim(),
          ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
          isDefault: true,
        }),
      });
      const status = await fetchOnboardingStatus(apiFetch);
      router.replace(getOnboardingPath(status));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save address');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return null;

  const hasCoords = latitude != null && longitude != null;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <BrandMark size="sm" />
      </View>

      <Card elevated style={styles.card}>
        <OnboardingProgress current="address" />
        <Text style={styles.title}>Add your address</Text>
        <Text style={styles.sub}>We need a pickup and delivery location for laundry services</Text>

        {/* Method selector */}
        <View style={styles.methodRow}>
          <Pressable
            style={[styles.methodBtn, method === 'manual' && styles.methodBtnActive]}
            onPress={() => selectMethod('manual')}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={method === 'manual' ? colors.primary : colors.muted}
            />
            <Text style={[styles.methodText, method === 'manual' && styles.methodTextActive]}>
              Manual
            </Text>
          </Pressable>

          <Pressable
            style={[styles.methodBtn, method === 'location' && styles.methodBtnActive]}
            onPress={() => selectMethod('location')}
            disabled={locating}
          >
            {locating ? (
              <Ionicons name="sync-outline" size={16} color={colors.primary} />
            ) : (
              <Ionicons
                name="navigate-outline"
                size={16}
                color={method === 'location' ? colors.primary : colors.muted}
              />
            )}
            <Text style={[styles.methodText, method === 'location' && styles.methodTextActive]}>
              {locating ? 'Locating…' : 'My location'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.methodBtn, method === 'map' && styles.methodBtnActive]}
            onPress={() => selectMethod('map')}
          >
            <Ionicons
              name="map-outline"
              size={16}
              color={method === 'map' ? colors.primary : colors.muted}
            />
            <Text style={[styles.methodText, method === 'map' && styles.methodTextActive]}>
              Pin on map
            </Text>
          </Pressable>
        </View>

        {/* Coords chip */}
        {hasCoords ? (
          <View style={styles.coordsChip}>
            <Ionicons name="location" size={13} color={colors.primary} />
            <Text style={styles.coordsText}>
              {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
            </Text>
            <Pressable onPress={() => setShowMap(true)} hitSlop={8}>
              <Text style={styles.coordsAdjust}>Adjust</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Address form fields */}
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
        <Input
          style={styles.field}
          placeholder="Postal code (4 digits)"
          value={postalCode}
          onChangeText={(v) => setPostalCode(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={submitting ? 'Saving…' : 'Finish setup'}
          onPress={handleSubmit}
          disabled={submitting || locating}
        />
      </Card>

      <MapPickerModal
        visible={showMap}
        initialLatitude={latitude}
        initialLongitude={longitude}
        onClose={() => {
          setShowMap(false);
          if (method === 'map' && !hasCoords) setMethod('manual');
        }}
        onConfirm={handleMapConfirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xxl },
  card: { borderWidth: 0, gap: spacing.sm },
  title: { ...typography.title, fontSize: 22, marginTop: spacing.lg },
  sub: { ...typography.bodySm, marginBottom: spacing.md },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  methodText: { fontSize: 12, fontWeight: '500', color: colors.muted },
  methodTextActive: { color: colors.primary, fontWeight: '700' },
  coordsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  coordsText: { fontSize: 11, fontWeight: '600', color: colors.primaryDark },
  coordsAdjust: { fontSize: 11, fontWeight: '700', color: colors.primary, marginLeft: spacing.xs },
  field: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  half: { flex: 1 },
  error: { color: colors.destructive, marginBottom: spacing.sm, fontSize: 14 },
});
