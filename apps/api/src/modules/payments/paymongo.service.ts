import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentMethod } from '@lunara/types';

const PAYMONGO_API = 'https://api.paymongo.com/v1';

export interface PaymongoCheckoutParams {
  amount: number;
  description: string;
  lineItemName: string;
  paymentMethod: PaymentMethod;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export interface PaymongoCheckoutResult {
  sessionId: string;
  checkoutUrl: string;
}

@Injectable()
export class PaymongoService {
  private readonly logger = new Logger(PaymongoService.name);

  isConfigured(): boolean {
    return Boolean(process.env.PAYMONGO_SECRET_KEY?.trim());
  }

  private get secretKey(): string {
    const key = process.env.PAYMONGO_SECRET_KEY?.trim();
    if (!key) throw new Error('PAYMONGO_SECRET_KEY is not configured');
    return key;
  }

  private get webhookSecret(): string | undefined {
    return process.env.PAYMONGO_WEBHOOK_SECRET?.trim() || undefined;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`;
  }

  paymentMethodTypes(method: PaymentMethod): string[] {
    switch (method) {
      case PaymentMethod.GCASH:
        return ['gcash'];
      case PaymentMethod.MAYA:
        return ['paymaya'];
      case PaymentMethod.STRIPE:
        return ['card'];
      default:
        return ['gcash', 'paymaya', 'card'];
    }
  }

  toCentavos(amountPhp: number): number {
    return Math.round(amountPhp * 100);
  }

  async createCheckoutSession(params: PaymongoCheckoutParams): Promise<PaymongoCheckoutResult> {
    const body = {
      data: {
        attributes: {
          billing: null,
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              currency: 'PHP',
              amount: this.toCentavos(params.amount),
              name: params.lineItemName,
              quantity: 1,
              description: params.description,
            },
          ],
          payment_method_types: this.paymentMethodTypes(params.paymentMethod),
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          description: params.description,
          metadata: params.metadata,
        },
      },
    };

    const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      data?: { id: string; attributes: { checkout_url: string } };
      errors?: { detail: string }[];
    };

    if (!res.ok) {
      const detail = json.errors?.map((e) => e.detail).join('; ') || res.statusText;
      this.logger.error(`PayMongo checkout session failed: ${detail}`);
      throw new Error(detail || 'PayMongo checkout session failed');
    }

    const session = json.data;
    if (!session?.attributes?.checkout_url) {
      throw new Error('PayMongo did not return a checkout URL');
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.attributes.checkout_url,
    };
  }

  async getCheckoutSession(sessionId: string): Promise<{
    sessionStatus: string;
    isPaid: boolean;
    paymentId?: string;
    metadata: Record<string, string>;
  }> {
    const res = await fetch(`${PAYMONGO_API}/checkout_sessions/${sessionId}`, {
      headers: { Authorization: this.authHeader() },
    });

    const json = (await res.json()) as {
      data?: {
        attributes: {
          status: string;
          metadata?: Record<string, string>;
          payments?: Array<
            | { id: string; attributes?: { status?: string } }
            | { id?: string; status?: string }
          >;
        };
      };
      errors?: { detail: string }[];
    };

    if (!res.ok || !json.data) {
      const detail = json.errors?.map((e) => e.detail).join('; ') || 'Session not found';
      throw new Error(detail);
    }

    const attrs = json.data.attributes;
    const paidEntry = attrs.payments?.find((p) => {
      const status =
        'attributes' in p && p.attributes?.status
          ? p.attributes.status
          : 'status' in p
            ? p.status
            : undefined;
      return status === 'paid';
    });
    const firstPayment = paidEntry ?? attrs.payments?.[0];
    const paymentId =
      firstPayment && 'id' in firstPayment && firstPayment.id
        ? firstPayment.id
        : undefined;

    return {
      sessionStatus: attrs.status,
      isPaid: Boolean(paidEntry),
      paymentId,
      metadata: attrs.metadata ?? {},
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const secret = this.webhookSecret;
    if (!secret) {
      this.logger.warn('PAYMONGO_WEBHOOK_SECRET not set — skipping webhook verification');
      return process.env.NODE_ENV !== 'production';
    }
    if (!signatureHeader) return false;

    const parts = Object.fromEntries(
      signatureHeader.split(',').map((segment) => {
        const [key, value] = segment.trim().split('=');
        return [key, value ?? ''];
      }),
    ) as Record<string, string>;

    const timestamp = parts.t;
    const testSignature = parts.te;
    const liveSignature = parts.li;
    if (!timestamp || (!testSignature && !liveSignature)) {
      return false;
    }

    const payload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expectedTest = createHmac('sha256', secret).update(payload).digest('hex');
    const expectedLive = expectedTest;

    const candidates = [testSignature, liveSignature, signatureHeader].filter(Boolean);
    for (const candidate of candidates) {
      try {
        if (
          timingSafeEqual(Buffer.from(expectedTest), Buffer.from(candidate)) ||
          timingSafeEqual(Buffer.from(expectedLive), Buffer.from(candidate))
        ) {
          return true;
        }
      } catch {
        // length mismatch — try next candidate
      }
    }

    return false;
  }

  parseWebhookEvent(rawBody: Buffer): {
    type: string;
    metadata: Record<string, string>;
    paymongoPaymentId?: string;
  } | null {
    try {
      const payload = JSON.parse(rawBody.toString('utf8')) as {
        data?: {
          attributes?: {
            type?: string;
            data?: {
              id?: string;
              attributes?: {
                metadata?: Record<string, string>;
                payments?: Array<
                  | { id: string; attributes?: { status?: string } }
                  | { id?: string; status?: string }
                >;
              };
            };
          };
        };
      };

      const type = payload.data?.attributes?.type ?? '';
      const inner = payload.data?.attributes?.data?.attributes;
      const metadata = inner?.metadata ?? {};

      const paidEntry = inner?.payments?.find((p) => {
        const status =
          'attributes' in p && p.attributes?.status
            ? p.attributes.status
            : 'status' in p
              ? p.status
              : undefined;
        return status === 'paid';
      });
      const firstPayment = paidEntry ?? inner?.payments?.[0];
      const paymongoPaymentId =
        firstPayment && 'id' in firstPayment && firstPayment.id ? firstPayment.id : undefined;

      // payment.paid events nest a single payment resource
      if (!paymongoPaymentId && payload.data?.attributes?.data?.id) {
        const resource = payload.data.attributes.data;
        if (resource.id?.startsWith('pay_')) {
          return { type, metadata, paymongoPaymentId: resource.id };
        }
      }

      return { type, metadata, paymongoPaymentId };
    } catch {
      return null;
    }
  }

  isPaidWebhookEvent(type: string): boolean {
    return type === 'checkout_session.payment.paid' || type === 'payment.paid';
  }
}
