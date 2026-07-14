import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Promotion, PromotionSchema } from '../admin/schemas/promotion.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { CustomerPromo, CustomerPromoSchema } from './schemas/customer-promo.schema';
import {
  PromotionRedemption,
  PromotionRedemptionSchema,
} from './schemas/promotion-redemption.schema';
import {
  PromotionUsageCounter,
  PromotionUsageCounterSchema,
} from './schemas/promotion-usage-counter.schema';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Promotion.name, schema: PromotionSchema },
      { name: CustomerPromo.name, schema: CustomerPromoSchema },
      { name: PromotionRedemption.name, schema: PromotionRedemptionSchema },
      { name: PromotionUsageCounter.name, schema: PromotionUsageCounterSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
