import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer }[];
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

  /** Returns whether the email was actually sent — false (never throws) if SMTP is disabled or
   * sending failed, so most callers can just fire-and-forget while callers that need to know
   * (e.g. recording emailedAt/emailError on an invoice) can check the result. */
  async send(payload: EmailPayload): Promise<boolean> {
    if (!this.transporter) {
      this.logger.debug(`Email skipped (SMTP disabled): ${payload.subject} → ${payload.to}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        to: payload.to,
        from: this.from,
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? `<p>${payload.text.replace(/\n/g, '<br>')}</p>`,
        attachments: payload.attachments,
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${payload.to}: ${err}`);
      return false;
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

  async sendEmailVerification(to: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'Verify your email — Lunara',
      text: `Welcome to Lunara! Confirm your email address to activate your account:\n\n${link}\n\nThis link expires in 24 hours. If you didn't create a Lunara account, you can ignore this email.`,
      html: `<p>Welcome to Lunara! Confirm your email address to activate your account:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours. If you didn't create a Lunara account, you can ignore this email.</p>`,
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

  async sendAdminNewOrderNotice(to: string, orderId: string, total: number): Promise<void> {
    await this.send({
      to,
      subject: `New paid order #${orderId} — Lunara`,
      text: `A new order has been paid and is awaiting dispatch.\n\nOrder: #${orderId}\nTotal: ₱${total.toFixed(2)}\n\nAssign a laundry shop in the admin dispatch queue.`,
    });
  }

  async sendAdminNewApplicationNotice(
    to: string,
    businessName: string,
    ownerFullName: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `New partner application — ${businessName}`,
      text: `A new partner application was submitted.\n\nBusiness: ${businessName}\nOwner: ${ownerFullName}\n\nReview it in the admin applications queue.`,
    });
  }

  async sendAdminNewTicketNotice(to: string, ticketId: string, subject: string): Promise<void> {
    await this.send({
      to,
      subject: `New support ticket — ${subject}`,
      text: `A new support ticket was submitted.\n\nTicket: #${ticketId}\nSubject: ${subject}\n\nReview it in the admin support queue.`,
    });
  }

  async sendAdminNewMessageNotice(to: string, senderName: string, preview: string): Promise<void> {
    await this.send({
      to,
      subject: `New message from ${senderName} — Lunara`,
      text: `${senderName} sent a new message:\n\n"${preview}"\n\nReply in the admin messages inbox.`,
    });
  }

  /** Auto-sent when a weekly partner invoice is generated (see PartnerOperationsService.createInvoice).
   * Returns whether the send succeeded so the caller can record emailedAt/emailError on the invoice. */
  async sendPartnerInvoice(
    to: string,
    invoice: { invoiceNumber: string; amountDue: number; dueDate?: Date },
    pdfBuffer: Buffer,
  ): Promise<boolean> {
    const dueLine = invoice.dueDate
      ? ` Payment is due by ${invoice.dueDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}.`
      : '';
    return this.send({
      to,
      subject: `Invoice ${invoice.invoiceNumber} — ₱${invoice.amountDue.toFixed(2)} due — Lunara`,
      text: `Your Lunara invoice ${invoice.invoiceNumber} for ₱${invoice.amountDue.toFixed(2)} is attached.${dueLine}\n\nThis covers Lunara's commission and any delivery costs fronted on your behalf for orders your shop completed this period. Please settle it via your usual payment channel (bank transfer/GCash) and we'll mark it paid on our end.`,
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }],
    });
  }

  /** "Talk to a human" hand-off from the AI chat widget — always goes to the fixed support inbox. */
  async sendChatEscalation(params: {
    fromName?: string;
    fromEmail: string;
    message: string;
    transcript?: string;
    ticketId?: string;
  }): Promise<void> {
    const to = process.env.CHAT_ESCALATION_EMAIL ?? 'admin@localpro.asia';
    const who = params.fromName ? `${params.fromName} <${params.fromEmail}>` : params.fromEmail;
    const ticketLine = params.ticketId ? `Ticket: #${params.ticketId}\n` : '';
    const transcriptBlock = params.transcript
      ? `\n\nRecent chat transcript:\n${params.transcript}`
      : '';
    await this.send({
      to,
      subject: `Chat escalation — ${who}`,
      text: `A visitor asked to talk to a human from the AI chat widget.\n\n${ticketLine}From: ${who}\nMessage: ${params.message}${transcriptBlock}`,
    });
  }
}
