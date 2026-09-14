import {

  ConflictException,

  ForbiddenException,

  Injectable,

  UnauthorizedException,

} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { InjectModel } from '@nestjs/mongoose';

import * as bcrypt from 'bcrypt';

import { randomBytes } from 'crypto';

import { Model } from 'mongoose';

import { OAuth2Client } from 'google-auth-library';

import { UserRole } from '@lunara/types';

import { formatPhone, getPermissionsForRole } from '@lunara/utils';

import {
  OTP_PROFILE_PLACEHOLDER_FIRST_NAME,
  OTP_PROFILE_PLACEHOLDER_LAST_NAME,
} from '../customers/customers.constants';

import { getJwtRefreshSecret } from '../../common/config/jwt-config';

import { getGoogleOAuthAudiences } from '../../common/config/google-auth-config';

import { decideGoogleLogin } from './google-login.logic';

import { EmailService } from '../../common/email/email.service';

import { RecaptchaService } from '../../common/recaptcha/recaptcha.service';

import { CustomersService } from '../customers/customers.service';
import { PromotionsService } from '../promotions/promotions.service';
import { RewardsService } from '../rewards/rewards.service';

import { User, UserDocument } from '../users/schemas/user.schema';

import { ChangePasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

import { OtpService } from './otp.service';

import { SmsService } from './sms.service';



@Injectable()

export class AuthService {

  constructor(

    @InjectModel(User.name) private userModel: Model<UserDocument>,

    private jwtService: JwtService,

    private otpService: OtpService,

    private smsService: SmsService,

    private customersService: CustomersService,
    private promotionsService: PromotionsService,
    private rewardsService: RewardsService,
    private emailService: EmailService,
    private recaptchaService: RecaptchaService,

  ) {}

  private readonly googleClient = new OAuth2Client();



  async register(dto: RegisterDto, isMobileClient = false) {

    if (!isMobileClient) {
      await this.recaptchaService.assertHuman(dto.recaptchaToken, 'register');
    }

    const orConditions = [{ email: dto.email }, { phone: dto.phone }].filter((q) =>

      Object.values(q).some(Boolean),

    );

    if (orConditions.length) {

      const existing = await this.userModel.findOne({ $or: orConditions });

      if (existing) throw new ConflictException('User already exists');

    }



    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;

    const role = UserRole.CUSTOMER;

    let user;
    try {
      user = await this.userModel.create({
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role,
        isActive: true,
        isEmailVerified: dto.email ? false : true,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException('User already exists');
      }
      throw err;
    }



    if (role === UserRole.CUSTOMER) {

      const customer = await this.customersService.create(user._id.toString(), dto.firstName, dto.lastName);
      await this.promotionsService.grantSignupPromo(user._id.toString());

      if (dto.referralCode) {
        const referrer = await this.rewardsService.resolveReferrerByCode(dto.referralCode);
        if (referrer && referrer.userId.toString() !== user._id.toString()) {
          customer.referredBy = referrer._id;
          await customer.save();
        }
      }

    }



    if (dto.email) {
      await this.sendVerificationEmail(user);
      return {
        success: true,
        data: {
          requiresEmailVerification: true,
          message: `We've sent a verification link to ${dto.email}. Verify your email to sign in.`,
          email: dto.email,
        },
      };
    }

    return this.buildAuthResponse(user);

  }



  async login(dto: LoginDto) {
    const phone = dto.phone ? formatPhone(dto.phone) : undefined;
    const orConditions = [{ email: dto.email }, { phone }].filter((q) =>
      Object.values(q).some(Boolean),
    );

    let user = orConditions.length
      ? await this.userModel.findOne({ $or: orConditions })
      : null;

    if (dto.otp && phone) {
      const valid = await this.otpService.verify(phone, dto.otp);
      if (!valid) throw new UnauthorizedException('Invalid OTP');

      if (!user) {
        try {
          user = await this.userModel.create({
            phone,
            role: UserRole.CUSTOMER,
            isActive: true,
          });

          await this.customersService.create(
            user._id.toString(),
            OTP_PROFILE_PLACEHOLDER_FIRST_NAME,
            OTP_PROFILE_PLACEHOLDER_LAST_NAME,
          );
          await this.promotionsService.grantSignupPromo(user._id.toString());
        } catch (err) {
          if ((err as { code?: number }).code === 11000) {
            // Lost a concurrent OTP-registration race for this phone — the other
            // request already created the account, so fall back to it instead of
            // double-creating a customer profile/signup promo.
            user = await this.userModel.findOne({ phone });
            if (!user) throw err;
          } else {
            throw err;
          }
        }
      }

      user.lastLoginAt = new Date();

      await user.save();

      return this.buildAuthResponse(user);

    }



    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!dto.password || !user.passwordHash) {

      throw new UnauthorizedException('Invalid credentials');

    }



    const valid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.email && !user.isEmailVerified) {
      throw new ForbiddenException('Please verify your email before signing in.');
    }

    user.lastLoginAt = new Date();

    await user.save();

    return this.buildAuthResponse(user);

  }



  /** Customer-facing Google sign-in only (customer-web + customer-mobile) — verifies the ID token
   * Google issued client-side, then finds-or-creates a CUSTOMER account. Every other account type
   * (partner/staff/rider/admin) keeps signing in with a password, so an existing non-customer
   * email is refused here rather than silently reusing that account. */
  async loginWithGoogle(idToken: string) {
    const audiences = getGoogleOAuthAudiences();
    if (!audiences.length) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: audiences });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }

    let user = payload?.sub ? await this.userModel.findOne({ googleId: payload.sub }) : null;
    const existingByEmail =
      !user && payload?.email ? await this.userModel.findOne({ email: payload.email }) : null;
    const matchedExisting = user ?? existingByEmail;

    const decision = decideGoogleLogin(
      payload
        ? {
            sub: payload.sub,
            email: payload.email,
            email_verified: payload.email_verified,
            given_name: payload.given_name,
            family_name: payload.family_name,
          }
        : undefined,
      matchedExisting ? { role: matchedExisting.role, isActive: matchedExisting.isActive } : undefined,
    );

    switch (decision.outcome) {
      case 'invalid-payload':
        throw new UnauthorizedException('Invalid Google credential');
      case 'unverified-email':
        throw new UnauthorizedException('Google account email is not verified');
      case 'non-customer-account':
        throw new ForbiddenException(
          'This account is not a customer account. Use the app for your account type.',
        );
      case 'deactivated-account':
        throw new ForbiddenException('This account has been deactivated');
    }
    // payload.sub/email are guaranteed present past this point — decideGoogleLogin's 'proceed'
    // outcome only occurs when both were checked non-empty.
    const verifiedPayload = payload! as typeof payload & { sub: string; email: string };

    if (!user) {
      if (existingByEmail) {
        existingByEmail.googleId = verifiedPayload.sub;
        existingByEmail.isEmailVerified = true;
        user = existingByEmail;

        // Backfill the avatar only if the customer never set/uploaded one of their own — Google's
        // picture shouldn't clobber a photo they picked deliberately after linking accounts.
        if (payload?.picture) {
          const customer = await this.customersService.findByUserId(user._id.toString());
          if (customer && !customer.avatarUrl) {
            await this.customersService.updateAvatar(user._id.toString(), payload.picture);
          }
        }
      } else {
        try {
          user = await this.userModel.create({
            email: verifiedPayload.email,
            googleId: verifiedPayload.sub,
            role: UserRole.CUSTOMER,
            isActive: true,
            isEmailVerified: true,
          });

          await this.customersService.create(
            user._id.toString(),
            verifiedPayload.given_name || OTP_PROFILE_PLACEHOLDER_FIRST_NAME,
            verifiedPayload.family_name || OTP_PROFILE_PLACEHOLDER_LAST_NAME,
            payload?.picture,
          );
          await this.promotionsService.grantSignupPromo(user._id.toString());
        } catch (err) {
          if ((err as { code?: number }).code === 11000) {
            // Lost a concurrent registration race for this email/googleId.
            user = await this.userModel.findOne({ googleId: verifiedPayload.sub });
            if (!user) throw err;
          } else {
            throw err;
          }
        }
      }
    }

    user.lastLoginAt = new Date();
    await user.save();

    return this.buildAuthResponse(user);
  }

  async requestOtp(phone: string, recaptchaToken?: string, isMobileClient = false) {
    if (!isMobileClient) {
      await this.recaptchaService.assertHuman(recaptchaToken, 'otp_request');
    }
    const normalized = formatPhone(phone);
    await this.smsService.sendOtp(normalized);

    return {
      success: true,
      data: {
        message: 'OTP sent',
        phone: normalized,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email });
    if (user?.phone) {
      await this.requestOtp(user.phone);
    }
    return {
      success: true,
      data: {
        message:
          'If an account exists, a verification code was sent to your registered mobile number.',
        phone: user?.phone ?? null,
      },
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const phone = formatPhone(dto.phone);
    const valid = await this.otpService.verify(phone, dto.otp);
    if (!valid) throw new UnauthorizedException('Invalid OTP');

    const user = await this.userModel.findOne({ phone });
    if (!user) throw new UnauthorizedException('Invalid OTP');

    user.passwordHash = await bcrypt.hash(dto.password, 12);
    await user.save();

    return {
      success: true,
      data: { message: 'Password updated. You can sign in with your new password.' },
    };
  }



  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user || !user.passwordHash) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    return {
      success: true,
      data: { message: 'Password updated.' },
    };
  }

  async verifyEmail(token: string) {
    const userId = await this.otpService.consumeEmailVerificationToken(token);
    if (!userId) throw new UnauthorizedException('Invalid or expired verification link');

    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('Invalid or expired verification link');

    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      user.emailVerifiedAt = new Date();
      user.lastLoginAt = new Date();
      await user.save();
    }

    return this.buildAuthResponse(user);
  }

  /** Lets an already-authenticated user (typically a phone-OTP-onboarded customer with no email
   * on file) add one later, e.g. from the onboarding profile screen. Requires re-verification
   * since email doubles as a login credential. */
  async setEmail(userId: string, email: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException();

    if (user.email === email) {
      return { success: true, data: { requiresEmailVerification: !user.isEmailVerified } };
    }

    const existing = await this.userModel.findOne({ email, _id: { $ne: user._id } });
    if (existing) throw new ConflictException('Email already in use');

    user.email = email;
    user.isEmailVerified = false;
    await user.save();
    await this.sendVerificationEmail(user);

    return {
      success: true,
      data: {
        requiresEmailVerification: true,
        message: `We've sent a verification link to ${email}.`,
      },
    };
  }

  async resendVerification(email: string) {
    const user = await this.userModel.findOne({ email });
    if (user && !user.isEmailVerified) {
      await this.sendVerificationEmail(user);
    }
    return {
      success: true,
      data: {
        message: 'If an account with that email exists and is unverified, a new link was sent.',
      },
    };
  }

  private async sendVerificationEmail(user: UserDocument) {
    if (!user.email) return;
    const token = randomBytes(32).toString('hex');
    await this.otpService.storeEmailVerificationToken(token, user._id.toString());
    const baseUrl = process.env.CUSTOMER_WEB_URL ?? 'http://localhost:3000';
    const link = `${baseUrl}/verify-email?token=${token}`;
    await this.emailService.sendEmailVerification(user.email, link);
  }

  async refreshTokens(refreshToken: string) {

    try {

      const payload = this.jwtService.verify(refreshToken, {

        secret: getJwtRefreshSecret(),

      });

      const valid = await this.otpService.validateRefreshToken(payload.sub, refreshToken);

      if (!valid) throw new UnauthorizedException();



      const user = await this.userModel.findById(payload.sub);

      if (!user) throw new UnauthorizedException();

      return this.buildAuthResponse(user);

    } catch {

      throw new UnauthorizedException('Invalid refresh token');

    }

  }



  async logout(userId: string) {

    await this.otpService.revokeRefreshToken(userId);

    return { success: true, data: { message: 'Logged out' } };

  }



  private async buildAuthResponse(user: UserDocument) {

    const permissions = getPermissionsForRole(user.role);

    const payload = {

      sub: user._id.toString(),

      email: user.email,

      phone: user.phone,

      role: user.role,

      permissions,

    };



    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {

      secret: getJwtRefreshSecret(),

      expiresIn: '30d',

    });



    await this.otpService.storeRefreshToken(user._id.toString(), refreshToken);



    return {

      success: true,

      data: {

        user: {

          id: user._id.toString(),

          email: user.email,

          phone: user.phone,

          role: user.role,

          branchId: user.branchId?.toString(),

          isActive: user.isActive,

          mustChangePassword: user.mustChangePassword,

          lastLoginAt: user.lastLoginAt,

          createdAt: user.createdAt,

          updatedAt: user.updatedAt,

        },

        tokens: {

          accessToken,

          refreshToken,

          expiresIn: 7 * 24 * 60 * 60,

        },

      },

    };

  }

}


