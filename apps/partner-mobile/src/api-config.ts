import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiV1BaseUrl } from '@lunara/utils';

/** Dev machine LAN IP from Expo (e.g. 192.168.1.5:8083 → 192.168.1.5). */
function devMachineHost(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return hostUri.split(':')[0];

  const linkingUri = Constants.linkingUri;
  if (linkingUri) {
    try {
      return new URL(linkingUri).hostname;
    } catch {
      /* ignore */
    }
  }

  return undefined;
}

function rewriteLocalhost(url: string): string {
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) return url;

  const host = devMachineHost();
  if (!host || host === 'localhost' || host === '127.0.0.1') return url;

  return url.replace(/localhost|127\.0\.0\.1/g, host);
}

/** API base URL for fetch (includes `/api/v1`). Rewrites localhost on device. */
export function getApiV1BaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!__DEV__ && !raw) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not configured. Set it in EAS secrets before building for production.',
    );
  }
  const base = resolveApiV1BaseUrl(raw);
  if (Platform.OS === 'web') return base;
  return rewriteLocalhost(base);
}
