/** Parse Lunara `{ success, error }` and NestJS `{ message }` error bodies. */
export function parseApiError(body: unknown, fallback = 'Request failed'): string {
  if (!body || typeof body !== 'object') return fallback;

  const record = body as Record<string, unknown>;

  if (record.error && typeof record.error === 'object') {
    const message = (record.error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message;
  }

  if (Array.isArray(record.message) && record.message.length > 0) {
    return String(record.message[0]);
  }

  return fallback;
}
