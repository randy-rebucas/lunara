import { Injectable, Logger } from '@nestjs/common';
import Twilio from 'twilio';

/** Generic outbound SMS via Twilio's Messages API — separate from TwilioVerifyService, which only
 *  speaks the Verify API used for OTP codes. */
@Injectable()
export class TwilioSmsService {
  private readonly logger = new Logger(TwilioSmsService.name);
  private client: ReturnType<typeof Twilio> | null = null;

  isConfigured(): boolean {
    return !!(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_SMS_FROM_NUMBER?.trim()
    );
  }

  async send(to: string, body: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.debug(`SMS skipped (Twilio SMS not configured): ${to}`);
      return;
    }
    try {
      await this.getClient().messages.create({
        to,
        from: process.env.TWILIO_SMS_FROM_NUMBER!.trim(),
        body,
      });
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${to}: ${err}`);
    }
  }

  private getClient() {
    if (!this.client) {
      this.client = Twilio(
        process.env.TWILIO_ACCOUNT_SID!.trim(),
        process.env.TWILIO_AUTH_TOKEN!.trim(),
      );
    }
    return this.client;
  }
}
