import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingModule } from '../booking/booking.module';
import { OrdersModule } from '../orders/orders.module';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsSchedulerService } from './subscriptions-scheduler.service';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    BookingModule,
    OrdersModule,
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsSchedulerService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
