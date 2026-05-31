import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RealtimeModule } from '../realtime/realtime.module';
import { RidersModule } from '../riders/riders.module';
import { HandoffModule } from '../handoff/handoff.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    RealtimeModule,
    RidersModule,
    HandoffModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
