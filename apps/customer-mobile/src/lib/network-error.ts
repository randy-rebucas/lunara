export function apiUnreachableMessage(baseUrl: string): string {
  if (__DEV__) {
    return `Cannot reach API at ${baseUrl}. Start the API (npm run dev --workspace=@lunara/api) and use the same Wi‑Fi as your phone.`;
  }
  return 'Unable to connect. Check your internet connection and try again.';
}
