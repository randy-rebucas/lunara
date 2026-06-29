import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from: string;
  private readonly enabled: boolean;

  constructor() {
    const key = process.env.SENDGRID_API_KEY;
    const from = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@lunara.app';
    this.from = from;
    this.enabled = !!key;
    if (key) {
      sgMail.setApiKey(key);
    } else {
      this.logger.warn('SENDGRID_API_KEY not set — email notifications disabled');
    }
  }

  async send(payload: EmailPayload): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`Email skipped (SendGrid disabled): ${payload.subject} → ${payload.to}`);
      return;
    }
    try {
      await sgMail.send({
        to: payload.to,
        from: this.from,
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? `<p>${payload.text.replace(/\n/g, '<br>')}</p>`,
      });
    } catch (err) {
      this.logger.error(`Failed to send email to ${payload.to}: ${err}`);
    }
  }

  async sendOrderConfirmed(to: string, orderId: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your laundry order has been confirmed — Lunara',
      text: `Your order #${orderId} has been confirmed and will be dispatched shortly.\n\nThank you for choosing Lunara!`,
    });
  }

  async sendOrderDispatched(to: string, orderId: string): Promise<void> {
    await this.send({
      to,
      subject: 'A rider is on the way — Lunara',
      text: `Great news! A rider has been assigned to pick up your laundry for order #${orderId}.\n\nYou can track your order in the Lunara app.`,
    });
  }

  async sendOrderDelivered(to: string, orderId: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your laundry has been delivered — Lunara',
      text: `Your laundry order #${orderId} has been delivered. We hope you're happy with the service!\n\nLeave a review in the app to let us know how we did.`,
    });
  }

  async sendRefundApproved(to: string, orderId: string, amount: number): Promise<void> {
    await this.send({
      to,
      subject: 'Your refund has been approved — Lunara',
      text: `Your refund of ₱${amount.toFixed(2)} for order #${orderId} has been approved and credited to your wallet.\n\nThank you for your patience.`,
    });
  }
}
