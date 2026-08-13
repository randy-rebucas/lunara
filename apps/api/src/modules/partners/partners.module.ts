import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Partner, PartnerSchema } from './schemas/partner.schema';
import { PartnerTerritory, PartnerTerritorySchema } from './schemas/partner-territory.schema';
import { PartnersAdminController } from './partners-admin.controller';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';
import { PartnerTerritoriesService } from './partner-territories.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Partner.name, schema: PartnerSchema },
      { name: PartnerTerritory.name, schema: PartnerTerritorySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PartnersController, PartnersAdminController],
  providers: [PartnersService, PartnerTerritoriesService],
  exports: [PartnersService, PartnerTerritoriesService],
})
export class PartnersModule {}
