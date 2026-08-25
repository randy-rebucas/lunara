import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { SettingsModule } from '../settings/settings.module';
import { RidersModule } from '../riders/riders.module';
import { PartnerModule } from '../partner/partner.module';
import { AuditLogModule } from '../audit/audit-log.module';
import { UsersModule } from '../users/users.module';
import { AutomationController } from './automation.controller';
import { AutomationSchedulerService } from './automation-scheduler.service';
import { SpamCleanupSchedulerService } from './spam-cleanup-scheduler.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: User.name, schema: UserSchema },
      { name: Rider.name, schema: RiderSchema },
    ]),
    SettingsModule,
    RidersModule,
    PartnerModule,
    AuditLogModule,
    UsersModule,
  ],
  controllers: [AutomationController],
  providers: [AutomationSchedulerService, SpamCleanupSchedulerService],
})
export class AutomationModule {}
