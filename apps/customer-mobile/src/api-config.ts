import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiV1BaseUrl } from '@lunara/utils';

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

export function getApiV1BaseUrl(): string {
  const base = resolveApiV1BaseUrl(process.env.EXPO_PUBLIC_API_URL);
  if (Platform.OS === 'web') return base;
  return rewriteLocalhost(base);
}

export function getApiOrigin(): string {
  return getApiV1BaseUrl().replace(/\/api\/v1$/, '');
}
