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
