import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { RidersModule } from '../riders/riders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PartnerController } from './partner.controller';
import { PartnerOperationsService } from './partner-operations.service';
import { ProcessingService } from './processing.service';
import { ShopReceivingService } from './shop-receiving.service';
import { PartnerNotificationsService } from './partner-notifications.service';
import { ShopInventoryItem, ShopInventorySchema } from './schemas/shop-inventory.schema';
import { Notification, NotificationSchema } from '../reviews/schemas/notification.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { PartnerSettingsService } from './partner-settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: ShopInventoryItem.name, schema: ShopInventorySchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    RealtimeModule,
    RidersModule,
  ],
  controllers: [PartnerController],
  providers: [
    ProcessingService,
    PartnerOperationsService,
    ShopReceivingService,
    PartnerNotificationsService,
    PartnerSettingsService,
  ],
  exports: [ProcessingService, PartnerOperationsService, ShopReceivingService],
})
export class PartnerModule {}
