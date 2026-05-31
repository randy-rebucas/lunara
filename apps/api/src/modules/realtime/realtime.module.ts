import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { SosModule } from '../sos/sos.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    forwardRef(() => SosModule),
  ],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class RealtimeModule {}