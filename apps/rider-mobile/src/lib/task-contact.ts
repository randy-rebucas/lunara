import { Alert, Linking, Platform } from 'react-native';

export type NavigableAddress = {
  line1: string;
  city: string;
  province?: string;
  latitude?: number;
  longitude?: number;
};

function mapsQuery(addr: NavigableAddress) {
  return encodeURIComponent([addr.line1, addr.city, addr.province].filter(Boolean).join(', '));
}

export function openGoogleMaps(addr: NavigableAddress) {
  const q = mapsQuery(addr);
  const url =
    addr.latitude != null && addr.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${addr.latitude},${addr.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`;
  void Linking.openURL(url);
}

export function openWaze(addr: NavigableAddress) {
  const q = mapsQuery(addr);
  const url =
    addr.latitude != null && addr.longitude != null
      ? `https://waze.com/ul?ll=${addr.latitude},${addr.longitude}&navigate=yes`
      : `https://waze.com/ul?q=${q}&navigate=yes`;
  void Linking.openURL(url);
}

export function promptNavigate(addr: NavigableAddress) {
  const options = [
    { text: 'Google Maps', onPress: () => openGoogleMaps(addr) },
    { text: 'Waze', onPress: () => openWaze(addr) },
    { text: 'Cancel', style: 'cancel' as const },
  ];
  if (Platform.OS === 'ios') {
    Alert.alert('Navigate with', 'Choose a maps app', options);
  } else {
    Alert.alert('Navigate with', undefined, options);
  }
}

/** @deprecated use promptNavigate */
export function openMapsAddress(addr: NavigableAddress) {
  promptNavigate(addr);
}

export function callPhone(phone?: string) {
  if (!phone) return;
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return;
  void Linking.openURL(`tel:${digits}`);
}
