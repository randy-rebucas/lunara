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

import { getPermissionsForRole } from '@lunara/utils';

import { getJwtRefreshSecret } from '../../common/config/jwt-config';

import { CustomersService } from '../customers/customers.service';

import { User, UserDocument } from '../users/schemas/user.schema';

import { LoginDto, RegisterDto } from './dto/auth.dto';

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

      await this.customersService.create(user._id.toString(), dto.firstName, dto.lastName);

    }



    return this.buildAuthResponse(user);

  }



  async login(dto: LoginDto) {

    const orConditions = [{ email: dto.email }, { phone: dto.phone }].filter((q) =>

      Object.values(q).some(Boolean),

    );

    let user = orConditions.length

      ? await this.userModel.findOne({ $or: orConditions })

      : null;



    if (dto.otp && dto.phone) {

      const valid = await this.otpService.verify(dto.phone, dto.otp);

      if (!valid) throw new UnauthorizedException('Invalid OTP');



      if (!user) {

        user = await this.userModel.create({

          phone: dto.phone,

          role: UserRole.CUSTOMER,

          isActive: true,

        });

        await this.customersService.create(user._id.toString(), 'Customer', dto.phone);

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

    const code = await this.otpService.generate(phone);

    await this.smsService.sendOtp(phone, code);

    return {

      success: true,

      data: {

        message: 'OTP sent',

        phone,

        ...(process.env.NODE_ENV !== 'production' ? { devOtp: code } : {}),

      },

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


