import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { OrdersModule } from '../orders/orders.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

@Module({
  imports: [AddressesModule, OrdersModule],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
