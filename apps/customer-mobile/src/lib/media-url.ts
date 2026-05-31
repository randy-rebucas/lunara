import { getApiOrigin } from '../api-config';

/** Resolve API-hosted media paths (e.g. avatar uploads) to a full URL. */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const origin = getApiOrigin();
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
