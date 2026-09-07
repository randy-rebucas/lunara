import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GeocodedAddressFields } from '../lib/reverse-geocode';
import { reverseGeocodeAddress } from '../lib/reverse-geocode';
import { colors, radius, spacing, typography } from '../theme';

const PH_DEFAULT_REGION: Region = {
  latitude: 14.5995,
  longitude: 120.9842,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

interface MapPickerModalProps {
  visible: boolean;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  onClose: () => void;
  onConfirm: (lat: number, lng: number, geocoded: GeocodedAddressFields | null) => void;
}

export function MapPickerModal({
  visible,
  initialLatitude,
  initialLongitude,
  onClose,
  onConfirm,
}: MapPickerModalProps) {
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<Region>(() => ({
    ...(initialLatitude != null && initialLongitude != null
      ? { latitude: initialLatitude, longitude: initialLongitude }
      : { latitude: PH_DEFAULT_REGION.latitude, longitude: PH_DEFAULT_REGION.longitude }),
    latitudeDelta: PH_DEFAULT_REGION.latitudeDelta,
    longitudeDelta: PH_DEFAULT_REGION.longitudeDelta,
  }));
  const [confirming, setConfirming] = useState(false);
  const regionRef = useRef(region);

  function handleRegionChange(r: Region) {
    regionRef.current = r;
    setRegion(r);
  }

  async function handleConfirm() {
    setConfirming(true);
    const { latitude, longitude } = regionRef.current;
    let geocoded: GeocodedAddressFields | null = null;
    try {
      geocoded = await reverseGeocodeAddress(latitude, longitude);
    } catch {
      /* coords still usable without geocoded text */
    }
    setConfirming(false);
    onConfirm(latitude, longitude, geocoded);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={styles.title}>Pin your location</Text>
          <View style={styles.closeBtn} />
        </View>

        <View style={styles.mapWrap}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={region}
            onRegionChangeComplete={handleRegionChange}
            showsUserLocation
            showsMyLocationButton={Platform.OS === 'android'}
          />
          {/* Static center pin */}
          <View style={styles.pinWrap} pointerEvents="none">
            <Ionicons name="location" size={40} color={colors.primary} style={styles.pinIcon} />
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Text style={styles.hint}>Move the map to place the pin on your address</Text>
          <View style={styles.coordsRow}>
            <Ionicons name="navigate-outline" size={14} color={colors.muted} />
            <Text style={styles.coordsText}>
              {region.latitude.toFixed(5)}, {region.longitude.toFixed(5)}
            </Text>
          </View>
          <Pressable
            style={[styles.confirmBtn, confirming && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.confirmBtnText}>Confirm location</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: { width: 36 },
  title: { ...typography.heading, fontSize: 17 },
  mapWrap: { flex: 1 },
  pinWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: {
    marginBottom: 36, // offset so tip of pin aligns with center
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  hint: { ...typography.bodySm, textAlign: 'center' },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  coordsText: { fontSize: 12, color: colors.muted },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
});
