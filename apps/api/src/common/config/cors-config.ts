function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const DEV_DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3003',
];

export function getAllowedOrigins(): string[] {
  const configured = parseOrigins(process.env.CORS_ORIGINS);
  if (configured.length > 0) return configured;

  const fallbacks = [process.env.CUSTOMER_WEB_URL, process.env.ADMIN_WEB_URL, process.env.PARTNER_WEB_URL].filter(
    (value): value is string => Boolean(value),
  );
  if (fallbacks.length > 0) return fallbacks;

  return process.env.NODE_ENV === 'production' ? [] : DEV_DEFAULT_ORIGINS;
}

export function assertProductionCorsOrigins(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (getAllowedOrigins().length === 0) {
    throw new Error(
      'CORS_ORIGINS (or CUSTOMER_WEB_URL/ADMIN_WEB_URL/PARTNER_WEB_URL) must be set in production',
    );
  }
}
