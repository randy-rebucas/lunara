import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

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
  private readonly transporter: Transporter | null;

  constructor() {
    const host = process.env.SMTP_HOST ?? 'smtp.hostinger.com';
    const port = Number(process.env.SMTP_PORT ?? 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.from = process.env.SMTP_FROM_EMAIL ?? user ?? 'noreply@lunara.app';

    if (user && pass) {
      this.transporter = createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
      this.logger.warn('SMTP_USER/SMTP_PASS not set — email notifications disabled');
    }
  }

  async send(payload: EmailPayload): Promise<void> {
    if (!this.transporter) {
      this.logger.debug(`Email skipped (SMTP disabled): ${payload.subject} → ${payload.to}`);
      return;
    }
    try {
      await this.transporter.sendMail({
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

  async sendRiderInvite(to: string, password: string): Promise<void> {
    await this.send({
      to,
      subject: "You've been invited to ride for Lunara",
      text: `An account has been created for you on Lunara.\n\nEmail: ${to}\nTemporary password: ${password}\n\nSign in on the Lunara rider app, complete your profile, and upload your KYC documents to get started.`,
    });
  }

  async sendPartnerInvite(to: string, password: string): Promise<void> {
    await this.send({
      to,
      subject: "You've been invited to join Lunara as a partner",
      text: `A partner account has been created for you on Lunara.\n\nEmail: ${to}\nTemporary password: ${password}\n\nSign in on the Lunara partner portal to manage your branch. You can change your password after logging in.`,
    });
  }
}
