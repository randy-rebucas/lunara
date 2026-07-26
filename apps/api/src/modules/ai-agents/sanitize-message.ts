/**
 * Strips null bytes and non-printable control characters (keeping newline/tab) from user input
 * before it's persisted or sent to Claude — defends against control-character/log-injection
 * payloads riding along in an otherwise normal-looking chat message.
 */
export function sanitizeMessage(raw: string): string {
  // eslint-disable-next-line no-control-regex -- intentionally stripping control chars
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}
