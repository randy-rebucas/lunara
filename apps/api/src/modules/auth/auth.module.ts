import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailModule } from '../../common/email/email.module';
import { RecaptchaModule } from '../../common/recaptcha/recaptcha.module';
import { CustomersModule } from '../customers/customers.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { RewardsModule } from '../rewards/rewards.module';
import { UsersModule } from '../users/users.module';
import { getJwtSecret } from '../../common/config/jwt-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OtpService } from './otp.service';
import { SmsService } from './sms.service';
import { TwilioVerifyService } from './twilio-verify.service';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    UsersModule,
    CustomersModule,
    EmailModule,
    RecaptchaModule,
    PromotionsModule,
    RewardsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OtpService, SmsService, TwilioVerifyService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
