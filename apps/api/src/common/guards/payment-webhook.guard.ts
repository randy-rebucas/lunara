import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class PaymentWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const secret = req.headers['x-payment-webhook-secret'];
    const expected = process.env.PAYMENT_WEBHOOK_SECRET ?? 'dev-payment-webhook-secret';
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid payment webhook secret');
    }
    return true;
  }
}
