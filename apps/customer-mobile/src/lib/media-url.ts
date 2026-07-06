import { getApiOrigin } from '../api-config';

/**
 * Resolve API-hosted media paths (e.g. avatar uploads) to a full URL.
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
