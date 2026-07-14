/**
 * Throws when a production build has no API URL configured, instead of silently falling back
 * to localhost — a missing NEXT_PUBLIC_API_URL in a production build would otherwise ship a
 * build that "succeeds" but talks to nothing.
 */
export function assertApiUrlConfigured(raw: string | undefined, context: string): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!raw?.trim()) {
    throw new Error(
      `${context}: no API URL is configured for this production build (env var is empty/missing). ` +
        'Refusing to silently fall back to localhost.',
    );
  }
}

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
