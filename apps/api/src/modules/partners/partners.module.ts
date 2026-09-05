import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Partner, PartnerSchema } from './schemas/partner.schema';
import { PartnerTerritory, PartnerTerritorySchema } from './schemas/partner-territory.schema';
import { PartnersAdminController } from './partners-admin.controller';
import { PartnersController, PartnerBrandingController } from './partners.controller';
import { PartnersService } from './partners.service';
import { PartnerTerritoriesService } from './partner-territories.service';
import { PartnerProvisioningService } from './partner-provisioning.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Partner.name, schema: PartnerSchema },
      { name: PartnerTerritory.name, schema: PartnerTerritorySchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [PartnersController, PartnerBrandingController, PartnersAdminController],
  providers: [PartnersService, PartnerTerritoriesService, PartnerProvisioningService],
  exports: [PartnersService, PartnerTerritoriesService],
})
export class PartnersModule {}
