import { getApiOrigin } from '../api-config';

/**
 * Resolve API-hosted media paths (e.g. avatar uploads) to a full URL.
 *
 * Uploads are served from the API's own local storage (see storage.module.ts), which bakes
 * absolute URLs against its own `API_URL` env — a hostname the device may not be able to reach
 * (e.g. "localhost" from the API's own perspective, or an internal service name in a deployed
 * env). Always rebuild against the app's own (possibly LAN-rewritten) API origin rather than
 * trusting the host the API embedded.
 */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      return `${getApiOrigin()}${url.pathname}${url.search}`;
    } catch {
      return path;
    }
  }
  return `${getApiOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}
