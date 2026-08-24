import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Address, AddressSchema } from '../addresses/schemas/address.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletsModule } from '../wallets/wallets.module';
import { RidersModule } from '../riders/riders.module';
import { BranchesModule } from '../branches/branches.module';
import { HandoffModule } from '../handoff/handoff.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { LedgerModule } from '../ledger/ledger.module';
import { LaundryTagsModule } from '../laundry-tags/laundry-tags.module';
import { RewardsModule } from '../rewards/rewards.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: User.name, schema: UserSchema },
      { name: Address.name, schema: AddressSchema },
      { name: Rider.name, schema: RiderSchema },
    ]),
    RealtimeModule,
    WalletsModule,
    BranchesModule,
    RidersModule,
    HandoffModule,
    PromotionsModule,
    LedgerModule,
    LaundryTagsModule,
    RewardsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
