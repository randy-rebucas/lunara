import { getApiOrigin } from '../api-config';
import { useAuthStore } from '../store/auth';

/**
 * Resolve API-hosted media paths to a full URL.
 *
 * The API may bake an absolute URL using its own `API_URL` env (e.g. `http://localhost:3001/...`),
 * which is unreachable from a physical device/emulator since "localhost" there means the device
 * itself. Always rebuild against the app's own (possibly LAN-rewritten) API origin, using only
 * the path from whatever the server returned.
 */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const origin = getApiOrigin();
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const { pathname, search } = new URL(path);
      return `${origin}${pathname}${search}`;
    } catch {
      return path;
    }
  }
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
