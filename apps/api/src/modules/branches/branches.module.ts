import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Address, AddressSchema } from '../addresses/schemas/address.schema';
import { CatalogModule } from '../catalog/catalog.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { RidersModule } from '../riders/riders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UserProfile, UserProfileSchema } from '../users/schemas/user-profile.schema';
import { BranchManagementService } from './branch-management.service';
import { BranchesController, PublicBranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { Branch, BranchSchema } from './schemas/branch.schema';
import { BranchCustomService, BranchCustomServiceSchema } from './schemas/branch-custom-service.schema';
import { BranchCustomAddon, BranchCustomAddonSchema } from './schemas/branch-custom-addon.schema';
import { ServiceAreasModule } from '../service-areas/service-areas.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Address.name, schema: AddressSchema },
      { name: BranchCustomService.name, schema: BranchCustomServiceSchema },
      { name: BranchCustomAddon.name, schema: BranchCustomAddonSchema },
      { name: Rider.name, schema: RiderSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    RealtimeModule,
    CatalogModule,
    ServiceAreasModule,
    forwardRef(() => RidersModule),
  ],
  controllers: [BranchesController, PublicBranchesController],
  providers: [BranchesService, BranchManagementService],
  exports: [BranchesService, BranchManagementService],
})
export class BranchesModule {}
