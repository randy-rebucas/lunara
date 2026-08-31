import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Plan, PlanSchema } from './schemas/plan.schema';
import { BillingSubscription, SubscriptionSchema } from './schemas/subscription.schema';
import { BillingPromotion, BillingPromotionSchema } from './schemas/billing-promotion.schema';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { EntitlementService } from './entitlement.service';
import { BillingPromotionService } from './billing-promotion.service';
import { BillingAdminController } from './billing-admin.controller';
import { BillingController } from './billing.controller';
import { PaymentsModule } from '../payments/payments.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: BillingSubscription.name, schema: SubscriptionSchema },
      { name: BillingPromotion.name, schema: BillingPromotionSchema },
    ]),
    PaymentsModule,
    LedgerModule,
  ],
  controllers: [BillingAdminController, BillingController],
  providers: [PlanService, SubscriptionService, EntitlementService, BillingPromotionService],
  exports: [PlanService, SubscriptionService, EntitlementService, BillingPromotionService],
})
export class BillingModule {}
