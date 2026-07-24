import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { BranchesModule } from '../branches/branches.module';
import { OrdersModule } from '../orders/orders.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { SettingsModule } from '../settings/settings.module';
import { ServiceAreasModule } from '../service-areas/service-areas.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

@Module({
  imports: [
    AddressesModule,
    BranchesModule,
    OrdersModule,
    CatalogModule,
    PromotionsModule,
    SettingsModule,
    ServiceAreasModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
