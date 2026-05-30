import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Notification, NotificationSchema } from '../reviews/schemas/notification.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletsModule } from '../wallets/wallets.module';
import { RefundRequest, RefundRequestSchema } from './schemas/refund-request.schema';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RefundRequest.name, schema: RefundRequestSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
    WalletsModule,
    RealtimeModule,
  ],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
