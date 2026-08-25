import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  OtpRequestDto,
  RegisterDto,
  RefreshTokenDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const COOKIE_NAME = 'portal_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// Tighter than the global 120/min default — these routes are brute-force/credential-stuffing/
// OTP-spam targets, so they get a much smaller budget per IP.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
const OTP_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    const token = (result as { data?: { tokens?: { accessToken?: string } } })?.data?.tokens?.accessToken;
    if (token) {
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
    }
    return result;
  }

  @Post('verify-email')
  @Throttle(AUTH_THROTTLE)
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(dto.token);
    const token = (result as { data?: { tokens?: { accessToken?: string } } })?.data?.tokens?.accessToken;
    if (token) {
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
    }
    return result;
  }

  @Post('resend-verification')
  @Throttle(OTP_THROTTLE)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Post('otp/request')
  @Throttle(OTP_THROTTLE)
  requestOtp(@Body() dto: OtpRequestDto) {
    return this.authService.requestOtp(dto.phone, dto.recaptchaToken);
  }

  @Post('forgot-password')
  @Throttle(OTP_THROTTLE)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle(AUTH_THROTTLE)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refreshTokens(dto.refreshToken);
    const token = (result as { data?: { tokens?: { accessToken?: string } } })?.data?.tokens?.accessToken;
    if (token) {
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
    }
    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: { user: { sub: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return this.authService.logout(req.user.sub);
  }
}
