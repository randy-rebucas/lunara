import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { SettingsModule } from '../settings/settings.module';
import { RidersModule } from '../riders/riders.module';
import { PartnerModule } from '../partner/partner.module';
import { AutomationSchedulerService } from './automation-scheduler.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SettingsModule,
    RidersModule,
    PartnerModule,
  ],
  providers: [AutomationSchedulerService],
})
export class AutomationModule {}
