import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class PaymentWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const secret = req.headers['x-payment-webhook-secret'];
    const expected = process.env.PAYMENT_WEBHOOK_SECRET;

    if (!expected) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('PAYMENT_WEBHOOK_SECRET must be set in production');
      }
      if (!secret || !this.matches(secret, 'dev-payment-webhook-secret')) {
        throw new UnauthorizedException('Invalid payment webhook secret');
      }
      return true;
    }

    if (!secret || !this.matches(secret, expected)) {
      throw new UnauthorizedException('Invalid payment webhook secret');
    }
    return true;
  }

  private matches(provided: string, expected: string): boolean {
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(providedBuf, expectedBuf);
  }
}
