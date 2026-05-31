import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { PushModule } from '../push/push.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { RiderSosService } from './rider-sos.service';
import { SosIncident, SosIncidentSchema } from './schemas/sos-incident.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SosIncident.name, schema: SosIncidentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Rider.name, schema: RiderSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PushModule,
    forwardRef(() => RealtimeModule),
  ],
  providers: [RiderSosService],
  exports: [RiderSosService, MongooseModule],
})
export class SosModule {}
