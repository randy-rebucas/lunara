import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { CustomerPromo, CustomerPromoSchema } from '../promotions/schemas/customer-promo.schema';
import { PointsTransaction, PointsTransactionSchema } from './schemas/points-transaction.schema';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: CustomerPromo.name, schema: CustomerPromoSchema },
      { name: PointsTransaction.name, schema: PointsTransactionSchema },
    ]),
  ],
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
