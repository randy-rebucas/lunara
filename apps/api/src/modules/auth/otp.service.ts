import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { formatPhone } from '@lunara/utils';
import { RedisService } from '../../common/redis/redis.service';
import { TwilioVerifyService } from './twilio-verify.service';

const REFRESH_PREFIX = 'refresh:';
const EMAIL_VERIFY_PREFIX = 'emailverify:';
const EMAIL_VERIFY_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly twilioVerify: TwilioVerifyService,
  ) {}

  async sendOtp(phone: string): Promise<void> {
    this.assertConfigured();
    await this.twilioVerify.sendVerification(formatPhone(phone));
  }

  async verify(phone: string, code: string): Promise<boolean> {
    this.assertConfigured();
    return this.twilioVerify.checkVerification(formatPhone(phone), code);
  }

  async storeRefreshToken(userId: string, token: string) {
    await this.redis.set(`${REFRESH_PREFIX}${userId}`, token, 30 * 24 * 60 * 60);
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const stored = await this.redis.get(`${REFRESH_PREFIX}${userId}`);
    return stored === token;
  }

  async revokeRefreshToken(userId: string) {
    await this.redis.del(`${REFRESH_PREFIX}${userId}`);
  }

  async storeEmailVerificationToken(token: string, userId: string) {
    await this.redis.set(`${EMAIL_VERIFY_PREFIX}${token}`, userId, EMAIL_VERIFY_TTL_SECONDS);
  }

  async consumeEmailVerificationToken(token: string): Promise<string | null> {
    const key = `${EMAIL_VERIFY_PREFIX}${token}`;
    const userId = await this.redis.get(key);
    if (userId) await this.redis.del(key);
    return userId;
  }

  private assertConfigured() {
    if (!this.twilioVerify.isConfigured()) {
      throw new ServiceUnavailableException(
        'SMS verification is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.',
      );
    }
  }
}
