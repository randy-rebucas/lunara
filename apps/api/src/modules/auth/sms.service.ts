import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtp(phone: string, code: string) {
    if (process.env.NODE_ENV === 'production' && process.env.TWILIO_ACCOUNT_SID) {
      // Production: integrate Twilio or local SMS provider
      this.logger.log(`[SMS] Would send OTP to ${phone}`);
      return;
    }
    this.logger.log(`[DEV SMS] OTP ${code} sent to ${phone}`);
  }
}
