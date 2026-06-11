import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { Address, AddressSchema } from '../addresses/schemas/address.schema';
import { SupportModule } from '../support/support.module';
import { RefundsModule } from '../refunds/refunds.module';
import { BranchesModule } from '../branches/branches.module';
import { OrdersModule } from '../orders/orders.module';
import { RidersModule } from '../riders/riders.module';
import { SosModule } from '../sos/sos.module';
import { AdminController } from './admin.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminDispatchService } from './admin-dispatch.service';
import { AdminService } from './admin.service';
import { Promotion, PromotionSchema } from './schemas/promotion.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Rider.name, schema: RiderSchema },
      { name: Address.name, schema: AddressSchema },
      { name: Promotion.name, schema: PromotionSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    SupportModule,
    RefundsModule,
    BranchesModule,
    OrdersModule,
    RidersModule,
    SosModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminOperationsService, AdminDispatchService],
  exports: [AdminService],
})
export class AdminModule {}
