import { Injectable } from '@nestjs/common';
import { OtpService } from './otp.service';

@Injectable()
export class SmsService {
  constructor(private readonly otpService: OtpService) {}

  async sendOtp(phone: string) {
    await this.otpService.sendOtp(phone);
  }
}
