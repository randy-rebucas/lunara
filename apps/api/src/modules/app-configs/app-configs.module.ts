import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret } from '../../common/config/jwt-config';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PartnerAppConfig, PartnerAppConfigSchema } from './schemas/partner-app-config.schema';
import {
  PublicAppConfigsController,
  AdminAppConfigsController,
  MyAppConfigsController,
} from './app-configs.controller';
import { AppConfigsService } from './app-configs.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PartnerAppConfig.name, schema: PartnerAppConfigSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [PublicAppConfigsController, AdminAppConfigsController, MyAppConfigsController],
  providers: [AppConfigsService],
})
export class AppConfigsModule {}
