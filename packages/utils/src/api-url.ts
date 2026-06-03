/** Nest API base including global prefix `/api/v1`. */
export function resolveApiV1BaseUrl(raw?: string): string {
  const base = (raw?.trim() || 'http://localhost:3001').replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) return base;
  return `${base}/api/v1`;
}

/** Origin for Socket.IO (no `/api/v1` suffix). */
export function resolveApiOrigin(raw?: string): string {
  return resolveApiV1BaseUrl(raw).replace(/\/api\/v1$/, '');
}

/** Resolve API-hosted media paths (e.g. `/api/v1/uploads/avatars/...`) to a full URL. */
export function resolveMediaUrl(path?: string | null, apiUrlEnv?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const origin = resolveApiOrigin(apiUrlEnv);
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
