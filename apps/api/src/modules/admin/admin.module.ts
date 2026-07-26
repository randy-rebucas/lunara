import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { Address, AddressSchema } from '../addresses/schemas/address.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { SupportModule } from '../support/support.module';
import { RefundsModule } from '../refunds/refunds.module';
import { BranchesModule } from '../branches/branches.module';
import { OrdersModule } from '../orders/orders.module';
import { RidersModule } from '../riders/riders.module';
import { SosModule } from '../sos/sos.module';
import { AdminController } from './admin.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminDispatchService } from './admin-dispatch.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { CatalogModule } from '../catalog/catalog.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { AdminService } from './admin.service';
import { Promotion, PromotionSchema } from './schemas/promotion.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { PartnerModule } from '../partner/partner.module';
import { ServiceAreasModule } from '../service-areas/service-areas.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Rider.name, schema: RiderSchema },
      { name: Address.name, schema: AddressSchema },
      { name: Promotion.name, schema: PromotionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
    SupportModule,
    RefundsModule,
    BranchesModule,
    OrdersModule,
    RidersModule,
    SosModule,
    PromotionsModule,
    CatalogModule,
    PartnerModule,
    ServiceAreasModule,
  ],
  controllers: [AdminController, MaintenanceController],
  providers: [AdminService, AdminOperationsService, AdminDispatchService, MaintenanceService],
  exports: [AdminService, AdminDispatchService],
})
export class AdminModule {}
