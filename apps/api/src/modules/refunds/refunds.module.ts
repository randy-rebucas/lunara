import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletsModule } from '../wallets/wallets.module';
import { RefundRequest, RefundRequestSchema } from './schemas/refund-request.schema';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { LedgerModule } from '../ledger/ledger.module';
import { PartnerModule } from '../partner/partner.module';
import { SettingsModule } from '../settings/settings.module';
import { AuditLogModule } from '../audit/audit-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RefundRequest.name, schema: RefundRequestSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    WalletsModule,
    RealtimeModule,
    LedgerModule,
    PartnerModule,
    SettingsModule,
    AuditLogModule,
  ],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
