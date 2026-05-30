export function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? 'dev-secret';
}

export function getJwtRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret';
}

export function assertProductionJwtSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.JWT_SECRET?.trim() || !process.env.JWT_REFRESH_SECRET?.trim()) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in production');
  }
}
