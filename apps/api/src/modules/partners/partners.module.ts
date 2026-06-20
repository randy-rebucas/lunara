import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Partner, PartnerSchema } from './schemas/partner.schema';
import { PartnersAdminController } from './partners-admin.controller';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Partner.name, schema: PartnerSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PartnersController, PartnersAdminController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
