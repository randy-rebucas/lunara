import { IsEmail, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

/** Rejects known spam-signup markers anywhere in the email, case-insensitive. Keep in sync with
 *  SPAM_EMAIL_MARKERS in users.service.ts. */
const SPAM_EMAIL_MARKERS = ['APPSBUILDERSPH', 'BITCHASSNIGGA'];
const NOT_SPAM_EMAIL = new RegExp(`^(?!.*(?:${SPAM_EMAIL_MARKERS.join('|')})).*$`, 'i');

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  @Matches(NOT_SPAM_EMAIL, { message: 'email is not allowed' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}

export class LoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  otp?: string;
}

export class OtpRequestDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  phone!: string;

  @IsString()
  otp!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  email!: string;
}
