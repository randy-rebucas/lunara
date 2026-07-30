import { resolveApiV1BaseUrl } from '@lunara/utils';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);

/** Best-effort crash report — deliberately unauthenticated (a crash may happen before/without a
 *  valid session) and never throws, so a failed report can't compound the original error. */
export function reportClientError(error: Error & { digest?: string }, path?: string) {
  try {
    void fetch(`${API_URL}/errors/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'partner-web',
        message: error.message || 'Unknown error',
        stack: error.stack,
        path: path ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
        digest: error.digest,
      }),
    });
  } catch {
    // swallow — reporting the crash must never itself throw
  }
}
