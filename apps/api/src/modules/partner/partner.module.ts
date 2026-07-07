import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UserProfile, UserProfileSchema } from '../users/schemas/user-profile.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { LaundryService, LaundryServiceSchema } from '../catalog/schemas/laundry-service.schema';
import { LaundryAddon, LaundryAddonSchema } from '../catalog/schemas/laundry-addon.schema';
import { RidersModule } from '../riders/riders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PartnerController } from './partner.controller';
import { PartnerOperationsService } from './partner-operations.service';
import { ProcessingService } from './processing.service';
import { ShopReceivingService } from './shop-receiving.service';
import { PartnerNotificationsService } from './partner-notifications.service';
import { ShopInventoryItem, ShopInventorySchema } from './schemas/shop-inventory.schema';
import { PartnerSettlement, PartnerSettlementSchema } from './schemas/partner-settlement.schema';
import { Notification, NotificationSchema } from '../reviews/schemas/notification.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { BranchesModule } from '../branches/branches.module';
import { PartnerSettingsService } from './partner-settings.service';
import { PartnerProfileService } from './partner-profile.service';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { LedgerModule } from '../ledger/ledger.module';
import { LaundryTagsModule } from '../laundry-tags/laundry-tags.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: ShopInventoryItem.name, schema: ShopInventorySchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: PartnerSettlement.name, schema: PartnerSettlementSchema },
      { name: LaundryService.name, schema: LaundryServiceSchema },
      { name: LaundryAddon.name, schema: LaundryAddonSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    RealtimeModule,
    RidersModule,
    LedgerModule,
    BranchesModule,
    LaundryTagsModule,
  ],
  controllers: [PartnerController],
  providers: [
    ProcessingService,
    PartnerOperationsService,
    ShopReceivingService,
    PartnerNotificationsService,
    PartnerSettingsService,
    PartnerProfileService,
  ],
  exports: [ProcessingService, PartnerOperationsService, ShopReceivingService],
})
export class PartnerModule {}
