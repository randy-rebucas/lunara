import { BadRequestException, Injectable, Logger } from '@nestjs/common';

const VERIFY_URL = 'https://www.recaptcha.net/recaptcha/api/siteverify';
const MIN_SCORE = 0.5;

interface SiteverifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

/** Verifies Google reCAPTCHA v3 tokens from public signup-abuse-prone endpoints (register,
 *  OTP request). No-ops (allows the request through) when RECAPTCHA_SECRET_KEY isn't set, so
 *  local dev doesn't need a real key — mirrors EmailService/TwilioVerifyService. */
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly secretKey?: string;

  constructor() {
    this.secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!this.secretKey) {
      this.logger.warn('RECAPTCHA_SECRET_KEY not set — reCAPTCHA verification disabled');
    }
  }

  isConfigured(): boolean {
    return !!this.secretKey;
  }

  /** Throws BadRequestException if the token is missing, invalid, or scores below the bot threshold. */
  async assertHuman(token: string | undefined, action: string): Promise<void> {
    if (!this.secretKey) return;

    if (!token) {
      throw new BadRequestException('reCAPTCHA verification required');
    }

    let result: SiteverifyResponse;
    try {
      const params = new URLSearchParams({ secret: this.secretKey, response: token });
      const res = await fetch(VERIFY_URL, { method: 'POST', body: params });
      result = (await res.json()) as SiteverifyResponse;
    } catch (err) {
      this.logger.error(`reCAPTCHA verification request failed: ${err}`);
      throw new BadRequestException('reCAPTCHA verification failed, please try again');
    }

    if (!result.success || (result.action && result.action !== action)) {
      throw new BadRequestException('reCAPTCHA verification failed');
    }

    if (typeof result.score === 'number' && result.score < MIN_SCORE) {
      throw new BadRequestException('reCAPTCHA verification failed');
    }
  }
}
