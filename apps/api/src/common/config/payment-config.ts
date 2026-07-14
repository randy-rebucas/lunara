import { Logger } from '@nestjs/common';

const logger = new Logger('PaymentConfig');

/**
 * Guards against the most common PayMongo misconfiguration: deploying production with a
 * test-mode secret key (silent "successful" payments that never move real money), or a
 * non-production environment accidentally holding a live key (real money at risk from a
 * dev/staging environment). Mirrors assertProductionJwtSecrets/assertProductionCorsOrigins.
 */
export function assertProductionPaymentConfig(): void {
  const key = process.env.PAYMONGO_SECRET_KEY?.trim();

  if (process.env.NODE_ENV === 'production') {
    if (!key) return; // PayMongo is optional — payments.service falls back to other methods when unconfigured.
    if (!key.startsWith('sk_live_')) {
      throw new Error(
        'PAYMONGO_SECRET_KEY must be a live key (sk_live_...) in production — found a non-live key.',
      );
    }
    if (!process.env.PAYMONGO_WEBHOOK_SECRET?.trim()) {
      throw new Error('PAYMONGO_WEBHOOK_SECRET must be set in production when PayMongo is configured.');
    }
    return;
  }

  if (key?.startsWith('sk_live_')) {
    logger.warn(
      'PAYMONGO_SECRET_KEY is a LIVE key (sk_live_...) outside production (NODE_ENV=' +
        `${process.env.NODE_ENV ?? 'undefined'}). Real payments can be charged from this environment.`,
    );
  }
}
