import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BranchesModule } from '../branches/branches.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PaymongoService } from './paymongo.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { LedgerModule } from '../ledger/ledger.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    WalletsModule,
    RealtimeModule,
    BranchesModule,
    LedgerModule,
    SettingsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymongoService],
  exports: [PaymentsService, PaymongoService],
})
export class PaymentsModule {}
