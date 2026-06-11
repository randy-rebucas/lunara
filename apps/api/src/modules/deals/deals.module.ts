import { Module } from '@nestjs/common';
import { PromotionsModule } from '../promotions/promotions.module';
import { DealsController } from './deals.controller';

@Module({
  imports: [PromotionsModule],
  controllers: [DealsController],
})
export class DealsModule {}
