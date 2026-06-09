import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { formatPhone } from '@lunara/utils';
import Twilio from 'twilio';

@Injectable()
export class TwilioVerifyService {
  private readonly logger = new Logger(TwilioVerifyService.name);
  private client: ReturnType<typeof Twilio> | null = null;

  isConfigured(): boolean {
    return !!(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      this.getServiceSid()
    );
  }

  async sendVerification(phone: string): Promise<void> {
    const to = formatPhone(phone);
    try {
      const verification = await this.getClient()
        .verify.v2.services(this.getServiceSid())
        .verifications.create({ to, channel: 'sms' });

      this.logger.log(`Twilio Verify started for ${to} (status: ${verification.status})`);
    } catch (error) {
      throw this.mapTwilioError(error, 'Failed to send verification code');
    }
  }

  async checkVerification(phone: string, code: string): Promise<boolean> {
    const to = formatPhone(phone);
    try {
      const check = await this.getClient()
        .verify.v2.services(this.getServiceSid())
        .verificationChecks.create({ to, code });

      return check.status === 'approved';
    } catch (error) {
      throw this.mapTwilioError(error, 'Failed to verify code');
    }
  }

  private getServiceSid(): string {
    return process.env.TWILIO_VERIFY_SERVICE_SID?.trim() ?? '';
  }

  private getClient() {
    if (!this.client) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
      const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
      if (!accountSid || !authToken) {
        throw new ServiceUnavailableException('SMS verification is not configured');
      }
      this.client = Twilio(accountSid, authToken);
    }
    return this.client;
  }

  private mapTwilioError(error: unknown, fallback: string): Error {
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      const twilioError = error as { code: number; message: string; status?: number };
      this.logger.warn(`Twilio error ${twilioError.code}: ${twilioError.message}`);

      if (twilioError.code === 20429 || twilioError.status === 429) {
        return new BadRequestException('Too many verification attempts. Please try again later.');
      }
      if (twilioError.code === 60200 || twilioError.code === 60203) {
        return new BadRequestException('Invalid phone number format. Use E.164 (e.g. +639171234567).');
      }
      if (twilioError.code === 60202) {
        return new BadRequestException('Maximum verification attempts reached. Request a new code.');
      }
      return new BadRequestException(twilioError.message || fallback);
    }

    this.logger.error(fallback, error);
    return new ServiceUnavailableException(fallback);
  }
}
