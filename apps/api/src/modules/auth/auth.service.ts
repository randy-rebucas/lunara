import {

  ConflictException,

  Injectable,

  UnauthorizedException,

} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { InjectModel } from '@nestjs/mongoose';

import * as bcrypt from 'bcrypt';

import { Model } from 'mongoose';

import { UserRole } from '@lunara/types';

import { formatPhone, getPermissionsForRole } from '@lunara/utils';

import {
  OTP_PROFILE_PLACEHOLDER_FIRST_NAME,
  OTP_PROFILE_PLACEHOLDER_LAST_NAME,
} from '../customers/customers.constants';

import { getJwtRefreshSecret } from '../../common/config/jwt-config';

import { CustomersService } from '../customers/customers.service';
import { PromotionsService } from '../promotions/promotions.service';
import { RewardsService } from '../rewards/rewards.service';

import { User, UserDocument } from '../users/schemas/user.schema';

import { LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

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

  ) {}



  async register(dto: RegisterDto) {

    const orConditions = [{ email: dto.email }, { phone: dto.phone }].filter((q) =>

      Object.values(q).some(Boolean),

    );

    if (orConditions.length) {

      const existing = await this.userModel.findOne({ $or: orConditions });

      if (existing) throw new ConflictException('User already exists');

    }



    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;

    const role = UserRole.CUSTOMER;

    const user = await this.userModel.create({

      email: dto.email,

      phone: dto.phone,

      passwordHash,

      role,

      isActive: true,

    });



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



    user.lastLoginAt = new Date();

    await user.save();

    return this.buildAuthResponse(user);

  }



  async requestOtp(phone: string) {
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

      secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',

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


