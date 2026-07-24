import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { SosModule } from '../sos/sos.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Conversation, ConversationSchema } from '../messaging/schemas/conversation.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    forwardRef(() => SosModule),
  ],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class RealtimeModule {}