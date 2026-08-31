import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BranchesModule } from '../branches/branches.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PaymongoService } from './paymongo.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { WebhookEvent, WebhookEventSchema } from './schemas/webhook-event.schema';
import { LedgerModule } from '../ledger/ledger.module';
import { SettingsModule } from '../settings/settings.module';
import { AuditLogModule } from '../audit/audit-log.module';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: WebhookEvent.name, schema: WebhookEventSchema },
    ]),
    WalletsModule,
    RealtimeModule,
    forwardRef(() => BranchesModule),
    LedgerModule,
    SettingsModule,
    AuditLogModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymongoService],
  exports: [PaymentsService, PaymongoService],
})
export class PaymentsModule {}
