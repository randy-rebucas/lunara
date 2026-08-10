export function assertProductionEmailConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.SMTP_USER?.trim() || !process.env.SMTP_PASS?.trim()) {
    throw new Error(
      'SMTP_USER/SMTP_PASS must be set in production — refusing to run with email notifications silently disabled.',
    );
  }
}
