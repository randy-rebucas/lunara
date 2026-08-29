import { getApiOrigin } from '../api-config';

/**
 * Resolve API-hosted media paths (e.g. avatar uploads) to a full URL.
 *
 * The API may bake an absolute URL against `localhost`/`127.0.0.1` using its own `API_URL` env,
 * which is unreachable from a physical device/emulator since "localhost" there means the device
 * itself — rebuild those against the app's own (possibly LAN-rewritten) API origin. Uploads now
 * live on Cloudinary (see media/cloudinary migration), so any other absolute URL is already a
 * real, reachable host and must be passed through untouched — rewriting its origin to the API's
 * own host silently breaks the image.
 */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return path;
      return `${getApiOrigin()}${url.pathname}${url.search}`;
    } catch {
      return path;
    }
  }
  return `${getApiOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}
