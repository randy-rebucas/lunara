import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Address, AddressSchema } from '../addresses/schemas/address.schema';
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
import { Rider, RiderSchema } from './schemas/rider.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rider.name, schema: RiderSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Address.name, schema: AddressSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
    RealtimeModule,
    ReviewsModule,
  ],
  controllers: [RidersController],
  providers: [RidersService, PickupService, DeliveryService, RiderAssignmentService],
  exports: [RidersService, PickupService, DeliveryService, RiderAssignmentService],
})
export class RidersModule {}
