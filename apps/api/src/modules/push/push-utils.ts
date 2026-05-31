export function stringifyPushData(data?: Record<string, unknown>): Record<string, string> {
  if (!data) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}

export const INVALID_FCM_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export function isInvalidFcmTokenError(code: string): boolean {
  return INVALID_FCM_TOKEN_CODES.has(code);
}
