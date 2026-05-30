import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

const OTP_TTL = 300; // 5 minutes
const OTP_PREFIX = 'otp:';
const REFRESH_PREFIX = 'refresh:';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private readonly redis: RedisService) {}

  async generate(phone: string): Promise<string> {
    const code = process.env.NODE_ENV === 'production'
      ? String(Math.floor(100000 + Math.random() * 900000))
      : '123456';
    await this.redis.set(`${OTP_PREFIX}${phone}`, code, OTP_TTL);
    this.logger.log(`OTP for ${phone}: ${code}`);
    return code;
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const stored = await this.redis.get(`${OTP_PREFIX}${phone}`);
    if (!stored || stored !== code) return false;
    await this.redis.del(`${OTP_PREFIX}${phone}`);
    return true;
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
}
