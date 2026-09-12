/** Thrown when the request never reached the server (device offline, API down, wrong URL) —
 * distinct from a server-returned error so callers can offer offline queuing instead of just
 * showing a failure message. */
export class NetworkUnreachableError extends Error {}

export function apiUnreachableMessage(baseUrl: string): string {
  if (__DEV__) {
    return `Cannot reach API at ${baseUrl}. Start the API (npm run dev --workspace=@lunara/api) and use the same Wi‑Fi as your phone.`;
  }
  return 'Unable to connect. Check your internet connection and try again.';
}
