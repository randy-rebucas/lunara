import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Address, AddressSchema } from '../addresses/schemas/address.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { RidersController } from './riders.controller';
import { DeliveryService } from './delivery.service';
import { PickupService } from './pickup.service';
import { RiderAssignmentService } from './rider-assignment.service';
import { RidersService } from './riders.service';
import { Notification, NotificationSchema } from '../reviews/schemas/notification.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { RiderNotificationService } from './rider-notification.service';
import { Rider, RiderSchema } from './schemas/rider.schema';
import {
  RiderWalletTransaction,
  RiderWalletTransactionSchema,
  RiderWithdrawal,
  RiderWithdrawalSchema,
} from './schemas/rider-wallet.schema';
import { RiderWalletService } from './rider-wallet.service';
import { HandoffModule } from '../handoff/handoff.module';
import { PaymentsModule } from '../payments/payments.module';
import { SosModule } from '../sos/sos.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rider.name, schema: RiderSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Address.name, schema: AddressSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: RiderWalletTransaction.name, schema: RiderWalletTransactionSchema },
      { name: RiderWithdrawal.name, schema: RiderWithdrawalSchema },
    ]),
    RealtimeModule,
    ReviewsModule,
    HandoffModule,
    PaymentsModule,
    SosModule,
  ],
  controllers: [RidersController],
  providers: [RidersService, PickupService, DeliveryService, RiderAssignmentService, RiderNotificationService, RiderWalletService],
  exports: [RidersService, PickupService, DeliveryService, RiderAssignmentService, RiderNotificationService, RiderWalletService],
})
export class RidersModule {}
