import { getApiOrigin } from '../api-config';
import { useAuthStore } from '../store/auth';

/** Resolve API-hosted media paths to a full URL. */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const origin = getApiOrigin();
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function pathNeedsAuth(path: string) {
  return path.includes('/uploads/rider-documents/') || path.includes('/uploads/task-photos/');
}

/** Image source with Authorization headers for protected uploads. */
export function resolveAuthenticatedMediaSource(path?: string | null): {
  uri: string;
  headers?: Record<string, string>;
} | undefined {
  const url = resolveMediaUrl(path);
  if (!url || !path) return undefined;
  if (!pathNeedsAuth(path)) return { uri: url };

  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { uri: url, headers: { Authorization: `Bearer ${token}` } } : { uri: url };
}
